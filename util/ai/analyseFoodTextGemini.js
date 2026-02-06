const { GoogleGenAI } = require("@google/genai");
const instructions = require("./instructions");
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_KEY ,
});

const analyzeFoodTextGemini = async ({ userPrompt }) => {

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
            unit: { 
              type: "STRING", 
              enum: ["unit", "units", "slice", "slices", "cup", "cups", "oz", "tbsp", "tsp", "medium", "bars", "pieces", "cans"] 
            },
            quantity: { type: "NUMBER" },
            color: { type: "STRING", description: "A hex color code representing the food item (e.g., #FFA500). Do not use 'unknown'.", },
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
      // model: "gemini-2.0-flash-lite", 
      model: "gemini-2.5-flash-lite",
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
          ],
        },
      ],
    });

    // Reminder: In this SDK, .text is a property, not a function
    const rawParse = JSON.parse(result.text);
    // Divide each nutrition macro value by its quantity to get per-unit values
    rawParse.foods = rawParse.foods.map(food => {
      const quantity = food.quantity || 1;
      return (quantity === 1 || quantity === 0) ? food : {
        ...food,
        nutrition: {
          calories: food.nutrition.calories / quantity,
          protein: food.nutrition.protein / quantity,
          carbs: food.nutrition.carbs / quantity,
          fat: food.nutrition.fat / quantity,
        }
      };
    });
    return rawParse;

  } catch (error) {
    //console.error("Gemini 2.0 Analysis Error:", error.message);
    throw error;
  }
};

module.exports = analyzeFoodTextGemini;