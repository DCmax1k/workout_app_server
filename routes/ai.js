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

const analyzeFood = async ({ imageBase64, userPrompt}) => {
  // Strip base64 prefix if it exists
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "user",
        content: [
          // System-style instructions
          {
            type: "input_text",
            text: `
                    You are a nutrition analysis assistant.

                    First, determine whether the image shows:
                    - actual food, OR
                    - a nutrition facts label.

                    If the image is a nutrition facts label:
                    - Read values directly from the label
                    - Do NOT estimate
                    - Use the serving size shown

                    If the image is food:
                    - Visually estimate nutrition
                    - Use the user's description to improve accuracy

                    Return ONLY valid JSON.
                `
          },
          {
            type: "input_text",
            text: `User description: ${userPrompt || "None provided"}`
          },
          {
            type: "input_image",
            image_base64: cleanBase64
          }
        ]
      }
    ],

    response_format: {
      type: "json_schema",
      json_schema: {
        name: "nutrition_result",
        schema: {
          type: "object",
          properties: {
            image_type: {
              type: "string",
              enum: ["food", "nutrition_label"]
            },
            source: {
              type: "string",
              enum: ["estimated", "label"]
            },
            calories: { type: "number" },
            protein: { type: "number" },
            carbs: { type: "number" },
            fat: { type: "number" },
            confidence: {
              type: "string",
              enum: ["low", "medium", "high"]
            }
          },
          required: [
            "image_type",
            "source",
            "calories",
            "protein",
            "carbs",
            "fat",
            "confidence"
          ]
        }
      }
    }
  });

  return response.output_parsed;
}


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


module.exports = router;