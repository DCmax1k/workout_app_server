const { GoogleGenAI } = require("@google/genai");
const instructions = require("./instructions");
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_KEY ,
});

const analyzeFoodGemini = async ({ imageBase64, userPrompt }) => {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  // Define the schema using your OpenAI structure
  const responseSchema = {
    type: "OBJECT",
    properties: {
      image_type: { type: "STRING", enum: ["food", "nutrition_label"] },
      source: { type: "STRING", enum: ["estimated", "label"] },
      foods: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            quantity: { type: "NUMBER" },
            unit: { 
              type: "STRING", 
              enum: ["unit", "units", "slice", "slices", "cup", "cups", "oz", "tbsp", "tsp", "medium", "bars", "pieces", "cans"] 
            },
            color: { type: "STRING", description: "A hex color code representing the food item" },
            nutrition: {
              type: "OBJECT",
              properties: {
                calories: { type: "NUMBER" },
                protein: { type: "NUMBER" },
                carbs: { type: "NUMBER" },
                fat: { type: "NUMBER" }
              },
              required: ["calories", "protein", "carbs", "fat"]
            },
            description: { type: "STRING" }
          },
          required: ["name", "quantity", "unit", "color", "nutrition", "description"]
        }
      },
      confidence: { type: "STRING", enum: ["low", "medium", "high"] }
    },
    required: ["image_type", "source", "foods", "confidence"]
  };

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite", 
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema, // This "locks" the output format
        systemInstruction: instructions.image,
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: userPrompt || "Analyze this food/label." },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
          ],
        },
      ],
    });

    // Reminder: In this SDK, .text is a property, not a function
    return JSON.parse(result.text);

  } catch (error) {
    console.error("Gemini 2.0 Analysis Error:", error.message);
    throw error;
  }
};

module.exports = analyzeFoodGemini;