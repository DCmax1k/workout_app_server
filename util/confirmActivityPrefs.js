const confirmActivityPreferences = (prefs, type) => {
    if (type === "complete_workout") {
        return prefs.workouts || prefs.askWorkouts;
    } else if (type === "complete_workout_achievement") {
        return prefs.achievements;
    }
    // default sharing
    return true;
}

module.exports = confirmActivityPreferences;