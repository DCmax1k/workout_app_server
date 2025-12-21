const OpenAI = require("openai");
const instructions = require("./instructions");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_TEST_KEY,
});

const analyzeFoodOpenAi = async ({ imageBase64, userPrompt }) => {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      store: true,
      messages: [
        {
          role: "system",
          content: instructions.image,
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

module.exports = analyzeFoodOpenAi;