// const rawActivityFromDb = [
//             {
//                 userId: null, // sender
//                 timestamp: Date.now(),
//                 type: "workout_complete", 
//                 people: [null, null], // user ids included to find from db including sender
//                 details: {
//                     workout: {name: "test workout", exercises: [], workoutid: 1},
//                 },
//                 reactions: {
//                     "emoji1": []
//                 }
//             }
//         ]
const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
    
    userId: {
        type: String,
        required: true,
    },
    type: { 
        type: String, // "complete_workout", "complete_workout_achievement"
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    people: {
        type: [String],
        required: true,
    },
    details: {
        type: Object,
    },
    reactions: {
        type: Object,
        default: {},
        required: true,
    },

});

module.exports = mongoose.model('Activity', ActivitySchema);