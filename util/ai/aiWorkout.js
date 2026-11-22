const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });
const PRIMARY_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.5-flash";

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

const sanitizeSetForTracks = (incomingSet, tracks) => {
  const set = {};
  (Array.isArray(tracks) ? tracks : []).forEach(track => {
    const value = incomingSet?.[track];
    if (value === undefined || value === null || value === "" || value === false || value === "false") return;
    if ((track === "weight" || track === "weightPlus" || track === "reps") && String(value).trim() === "0") return;
    set[track] = String(value);
  });
  return set;
};

const mergeSetArrays = (tracks, ...arrays) => {
  const setArrays = arrays.filter(Array.isArray);
  const setCount = setArrays.reduce((max, setArray) => Math.max(max, setArray.length), 0);
  return Array.from({ length: setCount }, (_, index) => (
    setArrays.reduce((merged, setArray) => ({
      ...merged,
      ...sanitizeSetForTracks(setArray[index], tracks),
    }), {})
  ));
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

    const preliminaryTracks = Array.isArray(target.tracks) && target.tracks.length
      ? target.tracks
      : Array.isArray(rawItem.changes?.tracks)
        ? rawItem.changes.tracks
        : Array.isArray(rawItem.exercise?.tracks)
          ? rawItem.exercise.tracks
          : ["reps"];
    const existing = deduplicated.get(target.uniqueId);
    const merged = existing ? {
      ...existing,
      ...rawItem,
      exercise: rawItem.exercise && typeof rawItem.exercise === "object"
        ? {
            ...existing.exercise,
            ...rawItem.exercise,
            sets: mergeSetArrays(preliminaryTracks, existing.exercise?.sets, rawItem.exercise?.sets),
          }
        : existing.exercise,
      changes: rawItem.changes && typeof rawItem.changes === "object"
        ? {
            ...existing.changes,
            ...rawItem.changes,
            sets: mergeSetArrays(preliminaryTracks, existing.changes?.sets, rawItem.changes?.sets),
          }
        : existing.changes,
      sets: mergeSetArrays(preliminaryTracks, existing.sets, rawItem.sets),
    } : { ...rawItem };

    const tracks = Array.isArray(target.tracks) && target.tracks.length
      ? target.tracks
      : Array.isArray(merged.changes?.tracks)
        ? merged.changes.tracks
        : Array.isArray(merged.exercise?.tracks)
          ? merged.exercise.tracks
          : ["reps"];
    const incomingSets = mergeSetArrays(
      tracks,
      merged.sets,
      merged.changes?.sets,
      merged.exercise?.sets,
    );
    const requestedSetCountMatch = String(prompt).match(/(?:^|\s)(\d+)\s*(?:sets?|rounds?)\b/i);
    const requestedSetCount = requestedSetCountMatch
      ? Math.max(1, parseInt(requestedSetCountMatch[1], 10))
      : 0;
    const setCount = Math.max(
      target.sets?.length ?? 0,
      incomingSets.length,
      requestedSetCount,
      0
    );
    const weightProgression = parseProgression(prompt, "weight", setCount);
    const repProgression = parseProgression(prompt, "reps", setCount);
    const normalizedSets = Array.from({ length: setCount }, (_, index) => {
      const incomingSet = incomingSets[index] || {};
      const targetSet = target.sets?.[index] || {};
      const set = {};

      tracks.forEach(track => {
        let value = incomingSet[track];
        if (value === undefined || value === null || value === "" || value === false || value === "false") {
          value = targetSet[track];
        }
        if (track === "weight" && weightProgression) value = weightProgression[index];
        if (track === "reps" && repProgression) value = repProgression[index];
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
  const text = String(prompt).toLowerCase();
  const numericMatch = text.match(/(?:^|\s)(\d+)\s*(?:sets?|rounds?)\b/i);
  if (numericMatch) return Math.max(1, parseInt(numericMatch[1], 10));
  const wordCounts = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:sets?|rounds?)\b/i);
  return wordMatch ? wordCounts[wordMatch[1].toLowerCase()] : 3;
};

const getFirstNumber = (prompt, pattern) => {
  const match = String(prompt).match(pattern);
  return match ? match[1] : null;
};

const parseProgression = (prompt, track, setCount) => {
  const text = String(prompt);
  if (track === "weight") {
    const rangeMatch = text.match(/(?:from\s*)?(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)?\s*(?:to|through|until)\s*(?:the\s+fifth\s+set\s+(?:being|at)\s*)?(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)?/i)
      || text.match(/(?:weight|weighing).{0,40}?(?:from\s*)?(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)?.{0,50}?(?:to|through|until)\s*(?:the\s+(?:\w+)\s+set\s+(?:being|at)\s*)?(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)?/i);
    if (!rangeMatch) {
      const startMatch = text.match(/(?:weight|weighing).{0,30}?(?:from\s*|at\s*|of\s*)(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)?/i);
      if (!startMatch) return null;
      const start = Number(startMatch[1]);
      const fixedMatch = text.match(/(?:fifth|5th|last)\s+set\s+(?:being\s+|at\s*)?(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)?/i);
      if (!fixedMatch) return null;
      const end = Number(fixedMatch[1]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || setCount < 1) return null;
      return Array.from({ length: setCount }, (_, index) => {
        const value = start + ((end - start) * index / Math.max(1, setCount - 1));
        return String(Math.round(value * 10) / 10);
      });
    }
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || setCount < 1) return null;
    return Array.from({ length: setCount }, (_, index) => {
      const value = start + ((end - start) * index / Math.max(1, setCount - 1));
      return String(Math.round(value * 10) / 10);
    });
  }

  if (track === "reps") {
    const startMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:reps?|repetitions?)\s*(?:to\s*start|at\s*the\s*start)/i)
      || text.match(/reps?.{0,30}?(?:go(?:es)?\s*)?(?:from\s*|start(?:s|ing)?\s*(?:at\s*|with\s*)?|at\s*|of\s*)(\d+(?:\.\d+)?)\s*(?:reps?|repetitions?)?/i);
    const endMatch = text.match(/(?:ending|finish(?:es|ing)?|down)\s*(?:with|at|to)?\s*(?:like\s*)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:reps?|repetitions?)?/i)
      || text.match(/(?:to|down\s*to|until)\s*(?:like\s*)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:reps?|repetitions?)?/i);
    if (startMatch && endMatch) {
      const wordNumbers = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
      const start = Number(startMatch[1]);
      const end = /^\d/.test(endMatch[1]) ? Number(endMatch[1]) : wordNumbers[endMatch[1].toLowerCase()];
      if (Number.isFinite(start) && Number.isFinite(end) && setCount > 0) {
        return Array.from({ length: setCount }, (_, index) => {
          const value = start + ((end - start) * index / Math.max(1, setCount - 1));
          return String(Math.max(1, Math.round(value)));
        });
      }
    }

    const rangeMatch = text.match(/(?:reps?|repetitions?).{0,30}?(?:from\s*|start(?:s|ing)?\s*(?:at\s*|with\s*)?|at\s*|of\s*)?(\d+(?:\.\d+)?)\s*(?:reps?|repetitions?)?.{0,60}?(?:to|through|until|ending\s+(?:at|with)).{0,20}?(\d+(?:\.\d+)?)\s*(?:reps?|repetitions?)?/i)
      || text.match(/(\d+(?:\.\d+)?)\s*(?:reps?|repetitions?)\s*(?:to|->)\s*(\d+(?:\.\d+)?)\s*(?:reps?|repetitions?)?/i);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && setCount > 0) {
        return Array.from({ length: setCount }, (_, index) => {
          const value = start + ((end - start) * index / Math.max(1, setCount - 1));
          return String(Math.max(1, Math.round(value)));
        });
      }
    }

    const fallbackStartMatch = text.match(/reps?.{0,30}?(?:start(?:s|ing)?\s*(?:at|from)\s*)(\d+(?:\.\d+)?)/i);
    if (fallbackStartMatch && /(?:go(?:es)?|drop(?:s)?|decreas(?:e|es|ing)|down|descending)/i.test(text)) {
      const start = Number(fallbackStartMatch[1]);
      if (Number.isFinite(start)) {
        return Array.from({ length: setCount }, (_, index) =>
          String(Math.max(1, Math.round(start - (index * 2))))
        );
      }
    }
  }

  return null;
};

const normalizeAddedWorkoutItems = (prompt, items, existingExerciseNames = []) => {
  const deduplicated = new Map();
  const findKnownExercise = (name) => {
    const candidates = Array.isArray(existingExerciseNames) ? existingExerciseNames : [];
    const normalizedName = normalizeName(name);
    if (!normalizedName) return null;
    return candidates.find(exercise =>
      exercise && typeof exercise === "object"
      && normalizeName(exercise.name) === normalizedName
    ) || candidates.find(exercise =>
      exercise && typeof exercise === "object"
      && (normalizeName(exercise.name).includes(normalizedName)
        || normalizedName.includes(normalizeName(exercise.name)))
    ) || null;
  };

  const inferKnownExerciseFromPrompt = () => {
    const candidates = Array.isArray(existingExerciseNames) ? existingExerciseNames : [];
    const text = String(prompt).toLowerCase();
    if (!text) return null;

    const promptMatches = candidates.filter(exercise =>
      exercise && typeof exercise === "object"
      && text.includes(exercise.name.toLowerCase())
    );
    if (promptMatches.length) return promptMatches[0];

    if (/\bbarbell\b/.test(text) && /bench/.test(text)) {
      return candidates.find(exercise => normalizeName(exercise.name) === "barbellbenchpress") || null;
    }
    if (/\bbench(?:press|ing)?\b/.test(text) || /bench/.test(text)) {
      return candidates.find(exercise => normalizeName(exercise.name) === "barbellbenchpress")
        || candidates.find(exercise => /bench/.test(normalizeName(exercise.name)))
        || null;
    }
    return null;
  };

  (Array.isArray(items) ? items : []).forEach(rawItem => {
    if (!rawItem || typeof rawItem !== "object") return;
    const key = normalizeName(rawItem.matchedName || rawItem.name);
    if (!key) return;

    const knownExercise = findKnownExercise(rawItem.matchedName || rawItem.name);
    const canonicalTracks = knownExercise && Array.isArray(knownExercise.tracks)
      ? knownExercise.tracks
      : null;

    const existing = deduplicated.get(key);
    const mergedTracks = canonicalTracks || (
      Array.isArray(rawItem.tracks) && rawItem.tracks.length
        ? rawItem.tracks
        : existing?.tracks
    );
    const merged = existing ? {
      ...existing,
      ...rawItem,
      tracks: mergedTracks,
      sets: mergeSetArrays(mergedTracks, existing.sets, rawItem.sets),
    } : {
      ...rawItem,
      tracks: canonicalTracks || rawItem.tracks,
    };
    deduplicated.set(key, merged);
  });

  if (deduplicated.size === 0) {
    const inferredExercise = inferKnownExerciseFromPrompt();
    if (inferredExercise) {
      deduplicated.set(normalizeName(inferredExercise.name), {
        name: inferredExercise.name,
        matchedName: inferredExercise.name,
        tracks: inferredExercise.tracks,
      });
    }
  }

  return [...deduplicated.values()].map(rawItem => {
    const tracks = Array.isArray(rawItem.tracks) ? rawItem.tracks : [];
    const setCount = getRequestedSetCount(prompt);
    const incomingSets = Array.isArray(rawItem.sets) ? rawItem.sets : [];
    const weightProgression = parseProgression(prompt, "weight", setCount);
    const repProgression = parseProgression(prompt, "reps", setCount);
    const sets = Array.from({ length: setCount }, (_, index) => {
      const set = {};
      tracks.forEach(track => {
        let value = incomingSets[index]?.[track];
        if (track === "weight" && weightProgression) value = weightProgression[index];
        if (track === "reps" && repProgression) value = repProgression[index];

        if (track === "weight" && (value === undefined || value === null || value === "")) {
          value = incomingSets[index]?.weightPlus
            || getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)\b/i);
          if (!value && !/reps?|repetitions?/i.test(prompt)) value = "100";
          if (!value) value = "0";
        } else if (track === "weightPlus" && (value === undefined || value === null || value === "")) {
          value = incomingSets[index]?.weight
            || getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilograms?)\b/i)
            || "0";
        } else if (track === "reps" && (value === undefined || value === null || value === "")) {
          value = getFirstNumber(prompt, /(?:of\s*)?(\d+)\s*(?:reps?|repetitions?)\b/i)
            || getFirstNumber(prompt, /\b(\d+)\s*x\s*\d+\b/i);
          if (!value && !/weight|lbs?|pounds?|kg|kilograms?/i.test(prompt)) value = "10";
          if (!value) value = "0";
        } else if (track === "mile" && (value === undefined || value === null || value === "")) {
          value = getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:miles?|mi)\b/i) || "0";
        } else if (track === "time" && (value === undefined || value === null || value === "")) {
          value = getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|seconds?|secs?|sec)\b/i) || "0";
        } else if (track === "incline" && (value === undefined || value === null || value === "")) {
          value = getFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*(?:%\s*)?(?:incline|grade)\b/i) || "0";
        }

        set[track] = value === undefined || value === null ? "0" : String(value);
      });
      return set;
    });

    return { ...rawItem, tracks, sets };
  });
};

const classifyWorkoutIntent = async (prompt, activeWorkout) => {
  const activeExerciseCount = Array.isArray(activeWorkout?.exercises)
    ? activeWorkout.exercises.length
    : 0;
  const activeExerciseNames = Array.isArray(activeWorkout?.exercises)
    ? activeWorkout.exercises
        .map(exercise => exercise?.name)
        .filter(Boolean)
    : [];
  const workoutContext = `ACTIVE WORKOUT STATE:
- exerciseCount: ${activeExerciseCount}
- exerciseNames: ${JSON.stringify(activeExerciseNames)}
- isEmpty: ${activeExerciseCount === 0 ? "true" : "false"}`;

  const response = await generateWithFallback({
    systemInstruction: `Classify the user's workout request into exactly one operation.
WORKOUT_QUESTION: asks about, explains, or gives advice on the current workout itself.
EDIT_WORKOUT: modifies existing exercises or existing workout details, such as changing sets, reps, weight, rest, names, tracks, removing exercises, or replacing a specific exercise.
ADD_EXERCISE: adds exercises to the workout.

Intent priority:
1. Requests to create, build, compose, suggest, fill, generate, add, or put exercises into a workout must use ADD_EXERCISE. This includes "create a chest workout", "make me a leg day", "add 6 chest exercises", and "give me exercises for push day".
2. An empty active workout does not mean the request should be EDIT_WORKOUT. If the user asks for a workout or a list of exercises for a day/muscle group, use ADD_EXERCISE. The available exercise library should be used; only create a new exercise entry when no suitable available exercise exists.
3. If the workout is not empty and the user asks to add, build, or create additional exercises, use ADD_EXERCISE and preserve the existing exercises. Do not classify it as EDIT_WORKOUT.
4. Use EDIT_WORKOUT only when the request clearly modifies or replaces an exercise or workout details that already exist. Removing, deleting, swapping, changing, updating, renaming, or adjusting sets/reps/weight are edit operations.
5. Directly asking whether or how an existing workout should be changed can be a WORKOUT_QUESTION, but an executable request to change it is EDIT_WORKOUT.

Set directResponse to a short friendly answer only when the prompt is a general greeting, test, or other request that does not need workout data or an execution AI call.
For requests that need workout data or exercise data, set directResponse to an empty string.
Return the intent and directResponse.`,
    prompt: `${workoutContext}\n\nUSER REQUEST:\n${prompt}`,
    responseSchema: intentSchema,
  });

  if (response.isOverloaded || response.isTimedOut || response.isInvalidJson) return { isOverloaded: true };
  if (!["WORKOUT_QUESTION", "EDIT_WORKOUT", "ADD_EXERCISE"].includes(response.intent)) {
    return { intent: "WORKOUT_QUESTION" };
  }

  const request = String(prompt).toLowerCase();
  const explicitlyEditsWorkout = /\b(remove|delete|swap|replace|change|update|rename|adjust|increase|decrease|modify|progress)\b/.test(request)
    || /\b(set|make)\s+(the\s+)?(weight|reps|sets|rest|track|exercise)\b/.test(request);
  const clearlyAddsExercises = /\b(create|build|compose|generate|add|put|fill|make)\b/.test(request)
    && /\b(workout|exercise|exercises|day|routine|chest|back|legs?|shoulders?|arms?|biceps?|triceps?|push|pull)\b/.test(request)
    || /\b(give|suggest)\s+(me\s+)?(a\s+)?(workout|exercises?|some exercises?)\b/.test(request)
    || activeExerciseCount === 0
      && /\b(chest|back|legs?|shoulders?|arms?|biceps?|triceps?|push|pull|upper body|lower body|workout|routine)\b/.test(request)
      && /\b(exercise|exercises|day|workout|routine|create|build|make|give|suggest)\b/.test(request);

  if (clearlyAddsExercises && !explicitlyEditsWorkout
    && (response.intent === "EDIT_WORKOUT" || response.intent === "WORKOUT_QUESTION")) {
    return {
      ...response,
      intent: "ADD_EXERCISE",
      directResponse: "",
    };
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
    The sets array is ordered: index 0 is set 1, index 1 is set 2, and so on. Put the weight and reps values for set 1 together in the same set object, set 2 in the next object, and continue through set N.
    Return one item per affected exercise, never one item per track or set. If weight and reps are both updated, one item must contain both tracks and every set object must contain both track values.
    For progression requests, calculate each set by index. For example, 5 sets with weight 100 to 150 and reps 10 down to 3 should return weight/reps pairs in set order, not separate exercise items.
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
    context = `AVAILABLE EXERCISES WITH EXACT TRACKS:\n${JSON.stringify(existingExerciseNames ?? [])}`;
    instruction = `Add distinct exercises only. For every distinct exercise, return exactly one items entry.
Match an available exercise exactly or by close name and set matchedName to the exact available name.
Copy the exact tracks array from AVAILABLE EXERCISES WITH EXACT TRACKS. This is mandatory. A strength exercise is ["weight","reps"], never ["weight","weightPlus","reps"] and never ["weightPlus","reps"] unless that exact available exercise uses strengthPlus.
If no available exercise matches, generate exactly this structure:
{name:string, group:"created", tracks:string[], description:string, muscleGroups:string[], id:string, met:number, sets:set[]}
New exercise tracks must use exactly one of these combinations:
- strength: ["weight","reps"]
- strengthPlus: ["weightPlus","reps"]
- cardio: ["mile","time"]
- distance: ["mile"]
- repsOnly: ["reps"]
- timeOnly: ["time"]
- treadmill: ["mile","incline","time"]
Use ["reps"] for jumping jacks and rep-only bodyweight exercises.
Set array rule: sets index 0 is set 1, index 1 is set 2, and continuing to set N.
Every set object may contain only the keys in that exercise's tracks array. Never invent keys, especially never add weightPlus to ["weight","reps"].
For strength exercises, put weight and reps in the same set object:
[{\"weight\":\"100\",\"reps\":\"10\"},{\"weight\":\"112.5\",\"reps\":\"8\"},{\"weight\":\"125\",\"reps\":\"6\"},{\"weight\":\"137.5\",\"reps\":\"4\"},{\"weight\":\"150\",\"reps\":\"3\"}]
For one requested progression, calculate every set index. 5 sets from 100 to 150 pounds and 10 to 3 reps is five set objects, not five exercise entries and not separate weight/reps entries.
Return no set with only weight and no reps when reps were requested, and no set with only reps and no weight when weight was requested.
If a track was not requested, use "0" for that strength track. Never use empty values or false. Every value is a string.
When no set count or values are requested, use 3 strength sets with weight "100" and reps "10".
Set group "created", met, muscleGroups, and a concise description for a new exercise.
Return one item for one distinct exercise. Never repeat the same exercise, never return one item per set, and never split weight and reps across items.`;
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
      items: normalizeAddedWorkoutItems(prompt, response.items, existingExerciseNames),
    };
  }
  return {
    intent,
    message: typeof response.message === "string" ? response.message : "",
    items: Array.isArray(response.items) ? response.items : [],
  };
};

module.exports = { classifyWorkoutIntent, executeWorkoutIntent };
