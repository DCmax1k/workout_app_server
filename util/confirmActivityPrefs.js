const confirmActivityPreferences = (prefs, type) => {
    if (type === "complete_workout" || type === "complete_workout_achievement") {
        return prefs.workouts;
    }
    // default sharing
    return true;
}

module.exports = confirmActivityPreferences;