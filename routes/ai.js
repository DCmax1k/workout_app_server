const express = require('express');
const authToken = require('../util/authToken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const getUserInfo = require('../util/getUserInfo');
const router = express.Router();
const jwt = require('jsonwebtoken');
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_TEST_KEY,
});

const analyzeFood = async ({ imageBase64, userPrompt }) => {
  // 1. Clean the base64 string
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      store: true,
      messages: [
        {
          role: "system",
          content: `You are a professional nutrition analysis assistant.

IDENTIFICATION LOGIC:
1. Detect if the image is a "Nutrition Facts Label" or "Actual Food" or "Other".
2. If Label: Extract data exactly as written.
3. If Food: Identify items and estimate nutrition per serving.
4. If Other: Respond with an empty food array.

COLOR LOGIC:
- For each food, provide a hex color code (e.g., "#DB8854") that represents the food's primary color.
- Choose a vibrant, recognizable color (e.g., a bright green for spinach, a warm brown for toast, a deep red for steak).
- The hex code must be a string starting with "#" followed by 6 characters.

UNIT RULES:
- Only use: unit, units, slice, slices, cup, cups, oz, tbsp, tsp, medium, bars, pieces, cans.
- Nutrition values must be PER SINGLE UNIT.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt || "Analyze this food/label." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${cleanBase64}`,
                detail: "low",
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "nutrition_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              image_type: { type: "string", enum: ["food", "nutrition_label"] },
              source: { type: "string", enum: ["estimated", "label"] },
              foods: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "number" },
                    unit: {
                      type: "string",
                      enum: ["unit", "units", "slice", "slices", "cup", "cups", "oz", "tbsp", "tsp", "medium", "bars", "pieces", "cans"]
                    },
                    color: { 
                      type: "string",
                      description: "A hex color code representing the food item, e.g., #DB8854"
                    },
                    nutrition: {
                      type: "object",
                      properties: {
                        calories: { type: "number" },
                        protein: { type: "number" },
                        carbs: { type: "number" },
                        fat: { type: "number" }
                      },
                      required: ["calories", "protein", "carbs", "fat"],
                      additionalProperties: false
                    },
                    description: { type: "string" }
                  },
                  required: ["name", "quantity", "unit", "color", "nutrition", "description"],
                  additionalProperties: false
                }
              },
              confidence: { type: "string", enum: ["low", "medium", "high"] }
            },
            required: ["image_type", "source", "foods", "confidence"],
            additionalProperties: false
          }
        }
      }
    });

    return JSON.parse(response.choices[0].message.content);

  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
};

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
    const aiUsage = user.extraDetails.ai.image;
    const lastResetDate = new Date(aiUsage.lastReset).toISOString().split('T')[0];

    // 1. PREMIUM CHECK & RESET LOGIC
    if (user.premium) {
      // If it's a new day, reset the credits
      if (todayStr !== lastResetDate) {
        aiUsage.credits = 5;
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
    const analysis = await analyzeFood({ imageBase64, userPrompt });
    console.log("AI Analysis by :" + user.username + JSON.stringify(analysis));


    res.json({ 
      status: "success", 
      analysis, 
      remaining: aiUsage.credits 
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
})


module.exports = router;