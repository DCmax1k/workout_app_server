const express = require('express');
const authToken = require('../util/authToken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const getUserInfo = require('../util/getUserInfo');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const analyzeFoodGemini = require('../util/ai/analyzeFoodGemini');
const analyzeFoodOpenAi = require('../util/ai/analyzeFoodOpenAi');
const analyzeFoodTextOpenAi = require('../util/ai/analyzeFoodTextOpenAi');
const analyzeFoodTextGemini = require('../util/ai/analyseFoodTextGemini');
const AICoachChat = require('../models/AICoachChat');
const aiCoach = require('../util/ai/aiCoach');

// TESTING ROUTE
router.get('/testai', (req, res) => {
	const response = openai.responses.create({
        model: "gpt-4o-mini",
        input: "write a haiku about a cute girl named aliyah",
        store: true,
    });

    response.then((result) => console.log(result.output_text));
    res.json({status: 'success', message: 'Check console for AI response.'});
});

router.post("/analyzefood", authToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.json({status: "error", message: "User not found"});

    // AI usage limits
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // "2025-12-18"
    
    // Get a reference to the nested object for easier typing
    const aiUsage = user.extraDetails.ai.image ?? {credits: 10, lastReset: now.getTime(), used: 0};
    const lastResetDate = new Date(aiUsage.lastReset).toISOString().split('T')[0];

    // 1. PREMIUM CHECK & RESET LOGIC
    if (user.premium) {
      // If it's a new day, reset the credits
      if (todayStr !== lastResetDate) {
        //console.log("Resetting AI credits for " + user.username);
        aiUsage.credits = 10;
        aiUsage.lastReset = now.getTime();
      }
    } else {
      // NON-PREMIUM: Only allow them to use what they have left (no daily refresh)
      if (aiUsage.credits <= 0) {
        return res.json({ 
          status: "error", 
          message: "Daily scans are a Premium feature. Upgrade to get 10 image scans every day!",
          showPremiumButton: true,
        });
      }
    }

    // 2. FINAL CREDIT CHECK
    if (aiUsage.credits <= 0) {
      return res.json({ 
        status: "error", 
        message: "You've used all your credits. Please try again tomorrow!" 
      });
    }

    // 3. DEDUCT CREDIT
    aiUsage.credits -= 1;
    aiUsage.used += 1;
    user.extraDetails.ai.image = aiUsage;
    user.markModified('extraDetails'); 
    await user.save();
    
    const { imageBase64, userPrompt } = req.body;
    //const analysis = await analyzeFoodOpenAi({ imageBase64, userPrompt }); // OPEN AI
    const analysis = await analyzeFoodGemini({ imageBase64, userPrompt }); // GOOGLE GEMINI
    console.log("AI image Analysis by " + user.username + ": " + JSON.stringify(analysis));


    res.json({ 
      status: "success", 
      analysis, 
      remaining: aiUsage.credits 
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

router.post("/analyzefoodtext", authToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.json({status: "error", message: "User not found"});

    // AI usage limits
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // "2025-12-18"
    
    // Get a reference to the nested object for easier typing
    const aiUsage = user.extraDetails.ai.foodText ?? {credits: 30, lastReset: now.getTime(), used: 0};
    const lastResetDate = new Date(aiUsage.lastReset).toISOString().split('T')[0];

    // 1. PREMIUM CHECK & RESET LOGIC
    if (user.premium) {
      // If it's a new day, reset the credits
      if (todayStr !== lastResetDate) {
        console.log("Resetting AI credits for " + user.username);
        aiUsage.credits = 30;
        aiUsage.lastReset = now.getTime();
      }
    } else {
      // NON-PREMIUM: Only allow them to use what they have left (no daily refresh)
      if (aiUsage.credits <= 0) {
        return res.json({ 
          status: "error", 
          message: "Daily scans are a Premium feature. Upgrade to get 30 text scans every day!",
          showPremiumButton: true,
        });
      }
    }

    // 2. FINAL CREDIT CHECK
    if (aiUsage.credits <= 0) {
      return res.json({ 
        status: "error", 
        message: "You've used all your credits. Please try again tomorrow!" 
      });
    }

    // 3. DEDUCT CREDIT
    aiUsage.credits -= 1;
    if (isNaN(aiUsage.used)) aiUsage.used = 0;
    aiUsage.used += 1;
    user.extraDetails.ai.foodText = aiUsage;
    user.markModified('extraDetails'); 
    await user.save();
    
    const { userPrompt } = req.body;
    // const analysis = await analyzeFoodTextOpenAi({ userPrompt });
    const analysis = await analyzeFoodTextGemini({ userPrompt });
    console.log("AI text scan by " + user.username + ": " + JSON.stringify(analysis));


    res.json({ 
      status: "success", 
      analysis, 
      remaining: aiUsage.credits 
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

const coachLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 10, // Limit each IP to 10 requests per window
  message: {
    status: "error",
    message: "Too many requests sent, please allow your coach to cooldown a moment..."
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // If you want to limit by User ID instead of IP (since you use authToken):
  keyGenerator: (req) => req.userId || req.ip,
  statusCode: 200,
  validate: false,
});

const getTotalNutrition = (meal) => {
    const mealNutrition = {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0
    };
    meal.foods.forEach(f => {
        new Array(4).fill(null).map((_, i) => {
            const nutritionKey = ["calories", "protein", "carbs", "fat"][i];
            mealNutrition[nutritionKey] += f.nutrition[nutritionKey]*f.quantity;
        });
    });
    return mealNutrition;
}
router.post("/aicoach", authToken, coachLimiter, async (req, res) => {
  try {

    // await new Promise((res, rej) => {
    //   setTimeout(res, 3000)
    // });
    // return res.json({
    //   status: "success",
    //   message: "hello",
    // })


    const { userPrompt, chatId, userContextClient, userSpecs, randomFirstMessage } = req.body;
    if (!userPrompt.trim()) return res.json({status: "success", analysis: "You didn't say anything..."});
    const user = await User.findById(req.userId);

    if (!user) return res.json({ status: "error", message: "User not found" });
    if (!user.premium) return res.json({ status: "error", message: "Premium required!" });


    const aiContext = {
      profile: userContextClient || user.extraDetails?.aiProfile || {},
      specs: userSpecs || {}, // height, weight, age, gender'
      workoutsForAI: null,
      totalNutritionForAI: null,
    };



    let currentChat;
    console.log("Chat from ", user.username);
    console.log(userPrompt)
    if (chatId) {
      // Scenario: Existing Chat
      currentChat = await AICoachChat.findOne({ _id: chatId, userId: user._id });
      if (!currentChat) return res.json({ status: "error", message: "Chat not found" });
      aiContext.workoutsForAI = currentChat.workoutsForAI;
      aiContext.totalNutritionForAI = currentChat.totalNutritionForAI;
    } else {
      // Scenario: First message, create new chat
       // find workout data (last 3 workouts)
      aiContext.workoutsForAI = JSON.stringify(user.pastWorkouts.slice(3).map(wk => {
        const exercisesArray = wk.exercises.map(ex => {
          const newSets = ex.sets.map(set => {
            const newSet = set;
            delete newSet.complete;
            return newSet;
          })
          return {name: ex.name, sets: newSets, unit: ex.unit || user.extraDetails.preferences.liftUnit || "imperial"};
        });
        return {
          date: new Date(wk.time).toLocaleDateString(),
          exercises: exercisesArray,
        }
      }));
      // find nutrition data (last 7 days)
      aiContext.totalNutritionForAI = JSON.stringify(
        Object.keys(user.consumedMeals).slice(-7).map(k => {
          const meals = user.consumedMeals[k];
          const daySummary = meals.reduce((acc, meal) => {
            const cur = meal.totalNutrition;
            acc.calories += cur.calories;
            acc.protein += cur.protein;
            acc.carbs += cur.carbs;
            acc.fat += cur.fat;
            const mealFoodNames = meal.fullMeal.foods.map(f => f.name);
            acc.foodList.push(...mealFoodNames);
            return acc;
          }, { calories: 0, protein: 0, carbs: 0, fat: 0, foodList: [] });
          return {
            date: k,
            dailyTotals: {
              calories: daySummary.calories,
              protein: daySummary.protein,
              carbs: daySummary.carbs,
              fat: daySummary.fat
            },
            foods: daySummary.foodList.join(", ")
          };
        })
      );
      // Create db object
      currentChat = new AICoachChat({
        userId: user._id,
        title: user.username + " - Coach AI chat", // Auto-generate title from first prompt
        messages: [
          { role: "model", parts: [{ text: randomFirstMessage ?? "None" }] }
        ],
        workoutsForAI: aiContext.workoutsForAI,
        totalNutritionForAI: aiContext.totalNutritionForAI,
      });
    }

    // 1. Prepare history for Gemini (excluding timestamps/mongo IDs)
    const historyForAI = currentChat.messages.map(m => ({
      role: m.role,
      parts: m.parts
    }));

    // 2. Call your Gemini function (passing the history)
    let aiResponse = await aiCoach({ 
        userPrompt, 
        history: historyForAI,
        aiContext,
    });


    // CONDITION FOR OVERLOADED SERVERS
    if (aiResponse.isOverloaded) {
        // Attempt another model
        console.log("Attempting gemini 3.1 model since overloaded.")
        aiResponse = await aiCoach({ 
            userPrompt, 
            history: historyForAI,
            aiContext,
            aiModel: "gemini-3.1-flash-lite",
        });
        if (aiResponse.isOverloaded) {
          return res.json({ 
            status: "error", 
            message: "Too many other users are questioning me at the moment, please try again in 1 minute." 
          });
        }
        
    }

    const coachText = aiResponse.message;

    // 3. Update DB with the new exchange
    const userMessage = { role: "user", parts: [{ text: userPrompt }] };
    // Store the response text, not the whole JSON object, in your history
    const modelMessage = { role: "model", parts: [{ text: coachText }] };

    currentChat.messages.push(userMessage, modelMessage);
    await currentChat.save();

    // 4. Send back the analysis and the chatId (so the client can use it for the next message)
    res.json({ 
      status: "success", 
      analysis: coachText, 
      chatId: currentChat._id 
    });

  } catch (err) {
    console.error("Coach Error:", err);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

router.post("/chathistory", authToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.json({status: "error", message: "User not found"});

    const chats = await AICoachChat.find({userId: user._id}, {dateCreated: 1, messages: 1, title: 1, })
      .sort({ dateCreated: -1 })
    return res.json({status: "success", chats});

  } catch(err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

router.post("/clearchathistory", authToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.json({ status: "error", message: "User not found" });

    // Delete all chats where the userId matches
    const result = await AICoachChat.deleteMany({ userId: user._id });

    return res.json({ 
      status: "success", 
      message: "Chat history cleared", 
      deletedCount: result.deletedCount 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});



module.exports = router;