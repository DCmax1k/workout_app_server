const { GoogleGenAI } = require("@google/genai");
const instructions = require("./instructions");
const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_KEY 
});

const responseSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "The AI coach's direct response to the user."
    }
  },
  required: ["message"]
};

const aiCoach = async ({ userPrompt, history = [], aiContext, aiModel = "gemini-2.5-flash-lite" }) => {
  const { profile, specs } = aiContext;

  const userDataString = `
    USER BIOMETRICS:
    - Age: ${specs.age || "Unknown"}
    - Gender: ${specs.gender || "Unknown"}
    - Height: ${specs.height || "Unknown"}
    - Weight: ${specs.weight || "Unknown"}

    USER GOALS & HISTORY:
    - Goals: ${profile.goals || "Not specified"}
    - Experience Level: ${profile.experience || "Not specified"}
    - Limitations/Injuries: ${profile.limitations || "None reported"}
  `;

  const dynamicInstructions = `${instructions.coach}\n\n${userDataString}`;

  try {
    const result = await ai.models.generateContent({
      model: aiModel, // Updated to the current 2026 model
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema, 
        systemInstruction: dynamicInstructions,
        // temperature: 0.7,
        safetySettings: [
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_ONLY_HIGH", // Allows more clinical/anatomical terms
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_ONLY_HIGH",
            },
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_ONLY_HIGH",
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_ONLY_HIGH", // Essential for fitness/injury advice
            },
        ],
      },
      contents: [
        ...history, 
        { role: "user", parts: [{ text: userPrompt }] }
      ],
    });

    const response = JSON.parse(result.text);
    return response;

  } catch (error) {
    console.error("Gemini 2.5 API Error:", error);
    // CHECK FOR 503 ERROR
    if (error.status === 503 || error.response?.status === 503) {
        return { isOverloaded: true };
    }
    throw error;
  }
};

module.exports = aiCoach;