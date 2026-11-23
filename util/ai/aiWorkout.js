const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_KEY,
});

const MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.5-flash";
const MODEL_TIMEOUT_MS = 12000;

const generateWithFallback = async ({ systemInstruction, responseSchema, contents }) => {
  const generate = async (model) => {
    let timeout;
    try {
      const result = await Promise.race([
        ai.models.generateContent({
          model,
          config: {
            responseMimeType: "application/json",
            responseSchema,
            systemInstruction,
          },
          contents,
        }),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("AI model timed out")), MODEL_TIMEOUT_MS);
        }),
      ]);
      return JSON.parse(result.text);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  try {
    return await generate(MODEL);
  } catch (error) {
    const shouldFallback =
      error.status === 503
      || error.response?.status === 503
      || error.message?.includes("timeout")
      || error.message?.includes("timed out")
      || error instanceof SyntaxError;
    if (!shouldFallback) throw error;
    return await generate(FALLBACK_MODEL);
  }
};

const classifySchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["WORKOUT_QUESTION", "EDIT_WORKOUT", "ADD_EXERCISE"],
    },
    directResponse: { type: "string" },
  },
  required: ["intent"],
};

const executeSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          exerciseUniqueId: { type: "string" },
          id: { type: "string" },
          action: { type: "string", enum: ["update", "existing", "create"] },
          name: { type: "string" },
          tracks: {
            type: "array",
            items: { type: "string", enum: ["weight", "reps", "mile", "incline", "time"] },
          },
          sets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                weight: { type: "integer" },
                reps: { type: "integer" },
                mile: { type: "integer" },
                incline: { type: "integer" },
                time: { type: "integer" },
                complete: { type: "boolean" },
              },
            },
          },
          description: { type: "string" },
          muscleGroups: {
            type: "array",
            items: { type: "string", enum: ["chest", "abs", "back", "bicep", "tricep", "forearm", "shoulder", "leg", "other"] },
          },
          met: { type: "integer" },
          unit: { type: "string", enum: ["imperial", "metric"] },
        },
        required: ["action", "name", "sets"],
      },
    },
  },
  required: ["message", "items"],
};

const classifyWorkoutIntent = async (prompt) => {
  try {
    return await generateWithFallback({
      responseSchema: classifySchema,
      systemInstruction: `
Classify a workout app request. Return only JSON.
- EDIT_WORKOUT: update sets or values for exercises already in the supplied active workout.
- ADD_EXERCISE: add, create, replace, or find exercises.
- WORKOUT_QUESTION: answer a question without changing the workout.
If intent is WORKOUT_QUESTION, put a short directResponse in the JSON. Otherwise directResponse may be empty.
`,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
  } catch (error) {
    if (error.status === 503 || error.response?.status === 503) return { isOverloaded: true };
    if (error.message?.includes("timeout")) return { isTimedOut: true };
    if (error instanceof SyntaxError) return { isInvalidJson: true };
    throw error;
  }
};

const executeWorkoutIntent = async ({ prompt, intent, activeWorkout, activeExercises = [], existingExercises = [] }) => {
  const normalizeAiTracks = tracks => [...new Set((tracks || []).map(track => track === "weightPlus" ? "weight" : track))];

  const formatSetsForAI = (tracks, sets) => {
    return (Array.isArray(sets) ? sets : []).map(set => {
      const result = {};
      (tracks || []).forEach(track => {
        const numericValue = Number(set?.[track]);
        result[track] = Number.isInteger(numericValue) ? numericValue : 0;
      });
      return result;
    });
  };

  const updateContext = (activeExercises || []).map(ex => {
    const tracks = normalizeAiTracks(ex.tracks);
    return {
      exerciseUniqueId: ex.exerciseUniqueId || ex.uniqueId,
      name: ex.name,
      tracks,
      sets: formatSetsForAI(tracks, ex.sets),
    };
  });

  const availableContext = (existingExercises || []).map(ex => ({
    id: ex.id,
    name: ex.name,
    tracks: normalizeAiTracks(ex.tracks),
  }));

  const trackDefinitions = {
    strength: ["weight", "reps"],
    cardio: ["mile", "time"],
    distance: ["mile"],
    repsOnly: ["reps"],
    timeOnly: ["time"],
    treadmill: ["mile", "incline", "time"],
  };

  const defaultSetsForTracks = (tracks) => Array.from({ length: 3 }, () => {
    const set = {};
    (tracks || []).forEach(track => {
      set[track] = 0;
    });
    return set;
  });

  const normalizeSetsForTracks = (tracks, sets) => {
    if (!Array.isArray(sets) || sets.length === 0) return [];
    return sets.map(set => {
      const normalized = {};
      (tracks || []).forEach(track => {
        const numericValue = Number(set?.[track]);
        normalized[track] = Number.isInteger(numericValue) ? numericValue : 0;
      });
      return normalized;
    });
  };

  const combinePartialSets = (tracks, aiSets) => {
    if (!Array.isArray(aiSets) || aiSets.length === 0) return [];

    if (aiSets.every(set => (tracks || []).every(track => Number.isFinite(set?.[track])))) {
      return aiSets;
    }

    const combined = [];
    let current = {};
    aiSets.forEach(set => {
      (tracks || []).forEach(track => {
        if (Number.isFinite(set?.[track])) current[track] = set[track];
      });
      if ((tracks || []).every(track => Number.isFinite(current[track]))) {
        combined.push({ ...current });
        current = {};
      }
    });
    if (Object.keys(current).length > 0) combined.push({ ...current });
    return combined;
  };

  const getExplicitRequestedValues = (text) => {
    const value = {};
    const weightMatch = text.match(/(?:around\s+)?(\d+)\s*(?:pounds?|lbs?|kg|kilograms?)\b/i)
      || text.match(/\bweight(?:\s+(?:is|to|=))?\s*(\d+)\b/i);
    const repsMatch = text.match(/(?:reps?(?:\s+(?:is|to|=))?\s*(\d+)|(\d+)\s*(?:reps?|repetitions?)\b)/i);
    if (weightMatch) value.weight = parseInt(weightMatch[1], 10);
    if (repsMatch) value.reps = parseInt(repsMatch[1] || repsMatch[2], 10);
    return value;
  };

  const getExplicitSetCount = (text) => {
    if (/\b(?:no|zero)\s+sets?\b/i.test(text)) return 0;
    const numberMatch = text.match(/\b(\d+)\s*(?:sets?|rounds?)\b/i);
    if (numberMatch) return Math.max(0, Number(numberMatch[1]));
    if (/\bone\s+(?:set|round)\b/i.test(text)) return 1;
    if (/\btwo\s+(?:sets|rounds)\b/i.test(text)) return 2;
    if (/\bthree\s+(?:sets|rounds)\b/i.test(text)) return 3;
    if (/\bfour\s+(?:sets|rounds)\b/i.test(text)) return 4;
    if (/\bfive\s+(?:sets|rounds)\b/i.test(text)) return 5;
    return null;
  };

  const systemInstruction = intent === "EDIT_WORKOUT"
    ? `
Update only exercises in the active workout that the user explicitly requests.
Use the supplied exerciseUniqueId, name, and tracks exactly.
Output only requested exercises.
If the prompt names one or more exact exercises, output only those exercises.
Do not infer that similar or adjacent exercises were requested.
The singular example "update sit ups" means update only sit ups, not the whole workout.
You MUST include a complete "sets" array in every item.
Every set is one complete object containing exactly the integer keys in that exercise's tracks.
Input sets are complete objects. Output sets in the same complete-object format.
No decimals or decimal notation. Do not use weightPlus.
Only output an exercise if the prompt requests an update to that exercise.
"all", "every", "entire workout", or "fill workout" explicitly requests every exercise.
Otherwise match exact exercise names or exerciseUniqueIds; never update unrelated exercises.
Preserve the original set count unless the prompt explicitly specifies a set count.
Preserve the original set values for tracks not being changed.
Do not output an item without exerciseUniqueId, tracks, or sets. Return valid JSON only.
`
    : `
Create or find exercises requested by the user.
Prefer an existing exercise when a close match is available.
For an existing exercise, output exactly: action="existing", id from availableExercises, exact name, and sets.
Do not output tracks, exerciseUniqueId, uniqueId, description, muscleGroups, met, unit, or any other metadata for existing exercises.
Never add an exercise that is already in the supplied active workout. If the requested exercise is already active, do not return it as an add result.
Never invent or copy an exerciseUniqueId or uniqueId.
For every existing or created exercise, output 3 sets unless the user explicitly specifies set count or values. Every set must contain a value for each track.
For a genuinely new exercise, set action="create" and include name, description, tracks, muscleGroups, and met.
muscleGroups must use: chest, abs, back, bicep, tricep, forearm, shoulder, leg, other.
met must be an integer from 3 through 9.
Track types: ${JSON.stringify(trackDefinitions)}.
Do not invent exerciseUniqueId or set complete=true.
Return valid JSON only.
`;

  try {
    const response = await generateWithFallback({
      responseSchema: executeSchema,
      systemInstruction,
      contents: [{
        role: "user",
        parts: [{ text: JSON.stringify({
          instructions: prompt,
          workoutName: activeWorkout?.name,
          activeExercises: updateContext,
          availableExercises: intent === "ADD_EXERCISE" ? availableContext : undefined,
        }) }],
      }],
    });
    if (intent === "ADD_EXERCISE") {
      const explicitSetCount = getExplicitSetCount(prompt);
      response.items = (response.items || []).map(item => {
        const existing = item.action === "existing"
          ? (existingExercises || []).find(exercise => exercise.id === item.id)
          : null;
        const alreadyActive = existing
          ? (activeExercises || []).some(exercise =>
              exercise.id === existing.id
              || (exercise.name || "").toLowerCase() === (existing.name || "").toLowerCase())
          : false;
        if (alreadyActive) return null;
        const tracks = existing?.tracks || item.tracks || [];
        const normalizedSets = normalizeSetsForTracks(tracks, combinePartialSets(tracks, item.sets));
        const sets = explicitSetCount === 0
          ? []
          : explicitSetCount !== null
            ? Array.from({ length: explicitSetCount }, (_, index) => normalizedSets[index] || normalizedSets[0] || normalizeSetsForTracks(tracks, null)[0])
            : normalizedSets;
        if (existing) {
          return {
            action: "existing",
            id: existing.id,
            name: existing.name,
            sets,
          };
        }
        return {
          ...item,
          exerciseUniqueId: undefined,
          uniqueId: undefined,
          tracks,
          sets,
        };
      }).filter(Boolean);
    }
    if (intent === "EDIT_WORKOUT") {
      const aiItems = Array.isArray(response.items) ? response.items : [];
      const explicitValues = getExplicitRequestedValues(prompt);
      const explicitSetCount = getExplicitSetCount(prompt);
      const normalizedPrompt = prompt.toLowerCase();
      const requestsAll = /\b(?:all|every|entire)\b/i.test(prompt)
        || /\b(?:entire|whole|full)\s+(?:workout|routine)\b/i.test(prompt)
        || /\b(?:fill|update)\s+(?:the\s+)?(?:entire\s+)?(?:whole\s+)?(?:workout|routine|all exercises)\b/i.test(prompt)
        || /\beach\s+(?:exercise|movement)\b/i.test(prompt);
      const normalizedName = name => (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const compactPrompt = normalizedName(normalizedPrompt);
      const explicitlyNamedOriginals = (activeExercises || []).filter(original => {
        const exerciseName = normalizedName(original.name);
        if (!exerciseName) return false;
        if (compactPrompt.includes(exerciseName)) return true;
        return exerciseName.endsWith("s") && compactPrompt.includes(exerciseName.slice(0, -1));
      });

      const normalizeUpdate = (original, aiItem) => {
        const tracks = Array.isArray(original.tracks) && original.tracks.length > 0
          ? original.tracks
          : normalizeAiTracks(aiItem?.tracks || []);
        const originalSets = Array.isArray(original.sets) && original.sets.length > 0
          ? original.sets
          : defaultSetsForTracks(tracks);
        const aiSets = Array.isArray(aiItem?.sets) && aiItem.sets.length > 0
          ? aiItem.sets
          : originalSets;
        const aiTracks = normalizeAiTracks(tracks);
        const combinedAiSets = combinePartialSets(aiTracks, aiSets);
        const setCount = explicitSetCount !== null
          ? explicitSetCount
          : (originalSets.length || aiSets.length || 3);
        const sets = Array.from({ length: setCount }, (_, index) => {
          const aiSet = combinedAiSets[index] || combinedAiSets[0] || {};
          const originalSet = originalSets[index] || originalSets[0] || {};
          const set = { ...originalSet };
          tracks.forEach(track => {
            const aiTrack = track === "weightPlus" ? "weight" : track;
            if (explicitValues[aiTrack] !== undefined) {
              set[track] = explicitValues[aiTrack];
            } else if (Number.isFinite(Number(aiSet[aiTrack]))) {
              set[track] = Number(aiSet[aiTrack]);
            } else if (Number.isFinite(Number(originalSet[track]))) {
              set[track] = Number(originalSet[track]);
            } else {
              set[track] = 0;
            }
          });
          return set;
        });
        return {
          ...original,
          ...aiItem,
          exerciseUniqueId: original.exerciseUniqueId || original.uniqueId,
          uniqueId: original.exerciseUniqueId || original.uniqueId,
          name: original.name,
          tracks,
          sets,
          action: "update",
        };
      };

      if (requestsAll) {
        response.items = (activeExercises || []).map(original => {
          const aiItem = aiItems.find(item =>
            (item.exerciseUniqueId || item.uniqueId) === (original.exerciseUniqueId || original.uniqueId)
            || item.name?.toLowerCase() === original.name?.toLowerCase()
          ) || null;
          return normalizeUpdate(original, aiItem);
        });
      } else if (explicitlyNamedOriginals.length > 0) {
        response.items = explicitlyNamedOriginals.map(original => {
          const aiItem = aiItems.find(item =>
            (item.exerciseUniqueId || item.uniqueId) === (original.exerciseUniqueId || original.uniqueId)
            || item.name?.toLowerCase() === original.name?.toLowerCase()
          ) || null;
          return normalizeUpdate(original, aiItem);
        });
      } else {
        response.items = aiItems.map(aiItem => {
          const uniqueId = aiItem.exerciseUniqueId || aiItem.uniqueId;
          const original = (activeExercises || []).find(ex =>
            (ex.exerciseUniqueId || ex.uniqueId) === uniqueId
            || ex.name?.toLowerCase() === aiItem.name?.toLowerCase()
          );
          return original ? normalizeUpdate(original, aiItem) : null;
        }).filter(Boolean);
      }
    }
    return response;
  } catch (error) {
    if (error.status === 503 || error.response?.status === 503) return { isOverloaded: true };
    if (error.message?.includes("timeout")) return { isTimedOut: true };
    if (error instanceof SyntaxError) return { isInvalidJson: true };
    throw error;
  }
};

module.exports = {
  classifyWorkoutIntent,
  executeWorkoutIntent,
};