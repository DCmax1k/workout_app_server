const OpenAI = require("openai");
const instructions = require("./instructions");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_TEST_KEY,
});

const analyzeFoodTextOpenAi = async ({ userPrompt }) => {
  // Updated instructions specifically for text-only input
  const TEXT_ANALYSIS_INSTRUCTIONS = instructions.foodText;
;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      store: true,
      messages: [
        {
          role: "system",
          content: TEXT_ANALYSIS_INSTRUCTIONS,
        },
        {
          role: "user",
          content: userPrompt,
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
              // Removed "nutrition_label" as an option since there's no image
              image_type: { type: "string", enum: ["food"] }, 
              source: { type: "string", enum: ["estimated"] },
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
                      description: "A hex color code representing the food item"
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
    console.error("AI Text Analysis Error:", error);
    throw error;
  }
};

module.exports = analyzeFoodTextOpenAi;