const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });
const PRIMARY_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

const intentSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["WORKOUT_QUESTION", "EDIT_WORKOUT", "ADD_EXERCISE"],
    },
    directResponse: {
      type: "string",
      description: "A short direct answer only when no workout data or a second AI request is needed.",
    },
  },
  required: ["intent", "directResponse"],
};

const executionSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          group: { type: "string" },
          tracks: {
            type: "array",
            items: {
              type: "string",
              enum: ["weight", "weightPlus", "reps", "mile", "time", "incline"],
            },
          },
          exerciseUniqueId: { type: "string" },
          muscleGroups: { type: "array", items: { type: "string" } },
          met: { type: "number" },
          exercise: {
            type: "object",
            description: "Complete proposed exercise object for EDIT_WORKOUT.",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              tracks: { type: "array", items: { type: "string" } },
              muscleGroups: { type: "array", items: { type: "string" } },
              met: { type: "number" },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    weight: { type: "string" },
                    weightPlus: { type: "string" },
                    reps: { type: "string" },
                    mile: { type: "string" },
                    time: { type: "string" },
                    incline: { type: "string" },
                  },
                },
              },
            },
          },
          sets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                weight: { type: "string" },
                weightPlus: { type: "string" },
                reps: { type: "string" },
                mile: { type: "string" },
                time: { type: "string" },
                incline: { type: "string" },
              },
            },
          },
          matchedName: { type: "string" },
          exerciseUniqueId: { type: "string" },
          changes: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              tracks: { type: "array", items: { type: "string" } },
              muscleGroups: { type: "array", items: { type: "string" } },
              met: { type: "number" },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    weight: { type: "string" },
                    weightPlus: { type: "string" },
                    reps: { type: "string" },
                    mile: { type: "string" },
                    time: { type: "string" },
                    incline: { type: "string" },
                  },
                },
              },
            },
          },
          actionLabel: { type: "string" },
        },
      },
    },
  },
  required: ["message", "items"],
};

const generateJson = async ({ model = PRIMARY_MODEL, systemInstruction, prompt, responseSchema }) => {
  try {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Gemini timed out")), 20000);
    });
    const result = await Promise.race([
      ai.models.generateContent({
        model,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          systemInstruction,
          safetySettings: [
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      timeoutPromise,
    ]).finally(() => clearTimeout(timeoutId));

    try {
      return JSON.parse(result.text);
    } catch (error) {
      console.error(`Gemini ${model} returned invalid JSON`);
      return { isInvalidJson: true };
    }
  } catch (error) {
    if (error.status === 503 || error.response?.status === 503) {
      return { isOverloaded: true };
    }
    if (error.message === "Gemini timed out") return { isTimedOut: true };
    throw error;
  }
};

const generateWithFallback = async (options) => {
  let response = await generateJson({ ...options, model: PRIMARY_MODEL });
  if (response.isOverloaded || response.isInvalidJson || response.isTimedOut) {
    response = await generateJson({ ...options, model: FALLBACK_MODEL });
  }
  return response;
};

const getExplicitRepEdit = (prompt) => {
  const fromToMatch = prompt.match(/\breps?\s*(?:of\s*)?(?:from\s*)?(\d+(?:\.\d+)?).{0,40}?(?:to|into|->)\s*(\d+(?:\.\d+)?)\b/i);
  if (fromToMatch) return { from: fromToMatch[1], to: fromToMatch[2] };

  const updateToMatch = prompt.match(/\breps?(?:\s+\w+){0,8}?\s*(?:to|at|of)\s*(\d+(?:\.\d+)?)\b/i);
  if (/update|change|set/i.test(prompt) && updateToMatch) {
    return { from: null, to: updateToMatch[1] };
  }
  return null;
};

const normalizeWorkoutEditItems = (prompt, items, activeExercises) => {
  const exercises = Array.isArray(activeExercises) ? activeExercises : [];
  const repEdit = getExplicitRepEdit(prompt);
  const deduplicated = new Map();

  (Array.isArray(items) ? items : []).forEach(rawItem => {
    if (!rawItem || typeof rawItem !== "object") return;
    const target = exercises.find(exercise =>
      exercise.uniqueId === rawItem.exerciseUniqueId
    ) || exercises.find(exercise =>
      typeof rawItem.name === "string"
      && normalizeName(exercise.name) === normalizeName(rawItem.name)
    );
    if (!target?.uniqueId) return;

    const existing = deduplicated.get(target.uniqueId);
    const merged = existing ? {
      ...existing,
      ...rawItem,
      exercise: rawItem.exercise && typeof rawItem.exercise === "object"
        ? { ...existing.exercise, ...rawItem.exercise }
        : existing.exercise,
      changes: rawItem.changes && typeof rawItem.changes === "object"
        ? { ...existing.changes, ...rawItem.changes }
        : existing.changes,
      sets: Array.isArray(rawItem.sets) && rawItem.sets.length ? rawItem.sets : existing.sets,
    } : { ...rawItem };

    const tracks = Array.isArray(target.tracks) && target.tracks.length
      ? target.tracks
      : Array.isArray(merged.changes?.tracks)
        ? merged.changes.tracks
        : Array.isArray(merged.exercise?.tracks)
          ? merged.exercise.tracks
          : ["reps"];
    const incomingSets = Array.isArray(merged.changes?.sets)
      ? merged.changes.sets
      : Array.isArray(merged.exercise?.sets)
        ? merged.exercise.sets
        : Array.isArray(merged.sets)
          ? merged.sets
          : [];
    const setCount = Math.max(
      target.sets?.length ?? 0,
      incomingSets.length,
      0
    );
    const normalizedSets = Array.from({ length: setCount }, (_, index) => {
      const incomingSet = incomingSets[index] || {};
      const targetSet = target.sets?.[index] || {};
      const set = {};

      tracks.forEach(track => {
        let value = incomingSet[track];
        if (value === undefined || value === null || value === "" || value === false || value === "false") {
          value = targetSet[track];
        }
        set[track] = value === undefined || value === null ? "" : String(value);
      });

      if (tracks.includes("reps") && repEdit) {
        set.reps = repEdit.from
          ? (String(set.reps) === repEdit.from ? repEdit.to : set.reps)
          : repEdit.to;
      }
      return set;
    });

    deduplicated.set(target.uniqueId, {
      ...merged,
      exerciseUniqueId: target.uniqueId,
      changes: {
        ...(merged.changes && typeof merged.changes === "object" ? merged.changes : {}),
        tracks,
        sets: normalizedSets,
      },
      exercise: {
        ...(merged.exercise && typeof merged.exercise === "object" ? merged.exercise : {}),
        name: target.name,
        tracks,
        sets: normalizedSets,
      },
    });
  });

  return [...deduplicated.values()];
};

const normalizeName = (name = "") => String(name).toLowerCase().replace(/[^a-z0-9]/g, "");

const getRequestedSetCount = (prompt) => {
  const match = String(prompt).match(/(?:^|\s)(\d+)\s*(?:sets?|rounds?)\b/i);
  return match ? Math.max(1, parseInt(match[1], 10)) : 3;
};

const getFirstNumber = (prompt, pattern) => {
  const match = String(prompt).match(pattern);
  return match ? match[1] : null;
};

const normalizeAddedWorkoutItems = (prompt, items) => {
  return (Array.isArray(items) ? items : []).map(rawItem => {
    if (!rawItem || typeof rawItem !== "object") return rawItem;

    const tracks = Array.isArray(rawItem.tracks) ? rawItem.tracks : [];
    const setCount = getRequestedSetCount(prompt);
    const sets = Array.from({ length: setCount }, () => {
      const set = {};

      tracks.forEach(track => {
        let value = "0";
        if (track === "weight") {
          value = getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)\b/i);
          if (!value && !/reps?|repetitions?/i.test(prompt)) value = "100";
          if (!value) value = "0";
        } else if (track === "weightPlus") {
          value = getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)\b/i) || "0";
        } else if (track === "reps") {
          value = getFirstNumber(prompt, /(?:of\s*)?(\d+)\s*(?:reps?|repetitions?)\b/i)
            || getFirstNumber(prompt, /\b(\d+)\s*x\s*\d+\b/i);
          if (!value && !/weight|lbs?|pounds?|kg|kilograms?/i.test(prompt)) value = "10";
          if (!value) value = "0";
        } else if (track === "mile") {
          value = getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:miles?|mi)\b/i) || "0";
        } else if (track === "time") {
          value = getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|seconds?|secs?|sec)\b/i) || "0";
        } else if (track === "incline") {
          value = getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:%\s*)?(?:incline|grade)\b/i) || "0";
        }
        set[track] = value;
      });

      return set;
    });

    return {
      ...rawItem,
      tracks,
      sets,
    };
  });
};

const classifyWorkoutIntent = async (prompt) => {
  const response = await generateWithFallback({
    systemInstruction: `Classify the user's workout request into exactly one operation.
WORKOUT_QUESTION: asks about or explains the current workout.
EDIT_WORKOUT: changes or replaces existing exercises, sets, reps, weight, rest, or workout details.
ADD_EXERCISE: adds one or more exercises to the workout.
Set directResponse to a short friendly answer only when the prompt is a general greeting, test, or other request that does not need workout data or an execution AI call.
For requests that need workout data or exercise data, set directResponse to an empty string.
Return the intent and directResponse.`,
    prompt,
    responseSchema: intentSchema,
  });

  if (response.isOverloaded || response.isTimedOut || response.isInvalidJson) return { isOverloaded: true };
  if (!["WORKOUT_QUESTION", "EDIT_WORKOUT", "ADD_EXERCISE"].includes(response.intent)) {
    return { intent: "WORKOUT_QUESTION" };
  }
  return response;
};

const executeWorkoutIntent = async ({ prompt, intent, activeWorkout, activeExercises, existingExerciseNames }) => {
  let context = "";
  let instruction = "";

  if (intent === "WORKOUT_QUESTION") {
    const conciseWorkout = {
      name: activeWorkout?.name ?? "",
      exercises: (activeWorkout?.exercises ?? []).map(exercise => ({
        name: exercise.name,
        tracks: exercise.tracks ?? [],
        sets: (exercise.sets ?? []).map(set => {
          const values = {};
          (exercise.tracks ?? []).forEach(track => {
            values[track] = set[track] ?? "";
          });
          return values;
        }),
      })),
    };
    context = `ACTIVE WORKOUT (only names, tracks, and set values):\n${JSON.stringify(conciseWorkout)}`;
    instruction = `Answer the question about the active workout. Return message with concise workout advice and items: [].`;
  } else if (intent === "EDIT_WORKOUT") {
    const conciseExercises = (activeExercises ?? activeWorkout?.exercises ?? []).map(exercise => ({
      exerciseUniqueId: exercise.uniqueId,
      name: exercise.name,
      tracks: exercise.tracks ?? [],
      sets: (exercise.sets ?? []).map(set => {
        const values = {};
        (exercise.tracks ?? []).forEach(track => {
          values[track] = set[track] ?? "";
        });
        return values;
      }),
    }));
    context = `CURRENT EXERCISES (only exercise IDs, names, tracks, and set values):\n${JSON.stringify(conciseExercises)}`;
    instruction = `Propose workout edits only.
For every affected exercise return one item with exerciseUniqueId copied exactly from CURRENT EXERCISES and changes containing only fields that must change.
For every affected exercise also return exercise: {name, description, tracks, muscleGroups, met} with the complete proposed exercise metadata.
    Keep tracks exactly as the CURRENT EXERCISES target. Never change tracks unless the user explicitly asks to change the exercise type.
    Do not use or return weightPlus for normal strength exercises.
    Use ["weight","reps"] for normal barbell, dumbbell, cable, and machine exercises.
    Use ["weightPlus","reps"] only when the target exercise already uses ["weightPlus","reps"].
    If only weight is being updated, return the exact current tracks and set every weight value while preserving each current reps value.
    If only reps are being updated, return the exact current tracks and set every reps value while preserving each current weight value.
    Return sets as an array containing one object per set. Each object must contain only the target exercise's current track keys.
    Never add extra keys such as weightPlus when the target tracks do not include weightPlus.
    Never return the string "false" or boolean false as a set value.
The changes object may contain:
- "tracks": one of the exact track combinations
- "sets": an array with one object per set, containing only keys in that exercise's tracks
- "name" if renamed
For an exercise with no sets or empty set values, generate beginner-level sets. For strength tracks ["weight","reps"], use conservative weight and reps strings. For jumping jacks or rep-only exercises use reps strings.
Every weight/reps value must be a string. Never set a complete property.
One item per affected exercise. Return no direct mutations.`;
  } else {
    context = `EXISTING EXERCISE NAMES ONLY:\n${JSON.stringify(existingExerciseNames ?? [])}`;
    instruction = `Add one or more exercises. Match an existing name when close; set matchedName to that exact existing name. Otherwise generate a complete new exercise using this exact structure:
{name:string, group:"created", tracks:string[], description:string, muscleGroups:string[], id:string, met:number, sets:set[]}
The tracks array is required and MUST use exactly one of these combinations:
- strength: ["weight","reps"]
- strengthPlus: ["weightPlus","reps"]
- cardio: ["mile","time"]
- distance: ["mile"]
- repsOnly: ["reps"]
- timeOnly: ["time"]
- treadmill: ["mile","incline","time"]
Choose repsOnly ["reps"] for jumping jacks and other rep-based bodyweight exercises.
Set count and values follow the request:
- If the user asks for a complete workout or simply adds exercises without specifying set count or strength values, use exactly 3 sets for strength exercises and normal beginner values of "100" weight and "10" reps.
- If the user specifies one track only, set that track to the requested value and set every unspecified strength track to "0".
- If the user specifies a set count, reps, weight, distance, time, or incline, use those values for every set unless they explicitly vary sets.
- Never leave strength track values empty or use "false". Use "0" when not specified and when only another strength track was requested.
Each set must be an object keyed by each track, with string values. Example: tracks ["weight","reps"], sets [{"weight":"100","reps":"3"},{"weight":"100","reps":"3"},{"weight":"100","reps":"3"}].
For jumping jacks with "3 sets of 10", use tracks ["reps"], sets [{"reps":"10"},{"reps":"10"},{"reps":"10"}].
Set group to "created". Set muscleGroups to an array of specific lowercase muscles from Exercises.js, not categories like chest/leg? Existing values include chest, abs, back, biceps, triceps, forearms, shoulders, legs, calves, glutes, hamstrings, quadriceps, core, obliques, etc. Use no invented spelling.
Set a realistic met between 2 and 12. Set description to a concise useful description. id is informational and will be replaced by the client.
MET is required for every distinct exercise. Estimate it from the exercise's actual intensity and type (for example walking 3.5, jumping jacks 8, vigorous running 9.8, strength work 5-6). Never use 6 as a generic placeholder.
Return exactly one items entry for each distinct exercise. Never return the same exercise multiple times, and never make one item per set.
Do not include an image. Use the user's requested set count and values. Existing matches may include matchedName plus tracks and sets.`;
  }

  const response = await generateWithFallback({
    systemInstruction: `You are a workout assistant. Return structured JSON only. ${instruction}`,
    prompt: `REQUEST:\n${prompt}\n\n${context}`,
    responseSchema: executionSchema,
  });

  if (response.isOverloaded || response.isTimedOut || response.isInvalidJson) return response;
  if (intent === "EDIT_WORKOUT") {
    return {
      intent,
      message: typeof response.message === "string" ? response.message : "",
      items: normalizeWorkoutEditItems(prompt, response.items, activeExercises),
    };
  }
  if (intent === "ADD_EXERCISE") {
    return {
      intent,
      message: typeof response.message === "string" ? response.message : "",
      items: normalizeAddedWorkoutItems(prompt, response.items),
    };
  }
  return {
    intent,
    message: typeof response.message === "string" ? response.message : "",
    items: Array.isArray(response.items) ? response.items : [],
  };
};

module.exports = { classifyWorkoutIntent, executeWorkoutIntent };
