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
    const aiUsage = user.extraDetails.ai.image ?? {credits: 10, lastReset: now.getTime()};
    const lastResetDate = new Date(aiUsage.lastReset).toISOString().split('T')[0];

    // 1. PREMIUM CHECK & RESET LOGIC
    if (user.premium) {
      // If it's a new day, reset the credits
      if (todayStr !== lastResetDate) {
        console.log("Resetting AI credits for " + user.username);
        aiUsage.credits = 10;
        aiUsage.lastReset = now.getTime();
      }
    } else {
      // NON-PREMIUM: Only allow them to use what they have left (no daily refresh)
      if (aiUsage.credits <= 0) {
        return res.json({ 
          status: "error", 
          message: "Daily scans are a Premium feature. Upgrade to get 5 scans every day!" 
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
    const aiUsage = user.extraDetails.ai.foodText ?? {credits: 30, lastReset: now.getTime()};
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
          message: "Daily scans are a Premium feature. Upgrade to get 30 text scans every day!" 
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
    user.markModified('extraDetails'); 
    await user.save();
    
    const { userPrompt } = req.body;
    const analysis = await analyzeFoodTextOpenAi({ userPrompt });
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


module.exports = router;