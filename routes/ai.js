const express = require('express');
const authToken = require('../util/authToken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const getUserInfo = require('../util/getUserInfo');
const router = express.Router();
const jwt = require('jsonwebtoken');

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

router.post("/aicoach", authToken, async (req, res) => {
  try {

    const { userPrompt, chatId, userContextClient, userSpecs } = req.body;
    const user = await User.findById(req.userId);

    if (!user) return res.json({ status: "error", message: "User not found" });
    if (!user.premium) return res.json({ status: "error", message: "Premium required!" });

    const aiContext = {
      profile: userContextClient || user.extraDetails?.aiProfile || {},
      specs: userSpecs || {} // height, weight, age, gender
    };

    let currentChat;

    console.log("Chat id ", chatId);
    if (chatId) {
      // Scenario: Existing Chat
      console.log("Exitsting chat");
      currentChat = await AICoachChat.findOne({ _id: chatId, userId: user._id });
      if (!currentChat) return res.json({ status: "error", message: "Chat not found" });
    } else {
      // Scenario: First message, create new chat
      console.log("First chat");
      currentChat = new AICoachChat({
        userId: user._id,
        title: userPrompt.substring(0, 30) + "...", // Auto-generate title from first prompt
        messages: []
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
            aiModel: "gemini-3.1-flash-lite"
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


module.exports = router;