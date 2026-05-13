const mongoose = require('mongoose');

const AICoachChatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        default: "New Chat",
    },
    messages: [
        {
            role: { type: String, enum: ['user', 'model'], required: true },
            parts: [{ text: { type: String, required: true } }],
            timestamp: { type: Date, default: Date.now },
            data: { type: Object, default: null }
        }
    ],
    dateCreated: {
        type: Date,
        default: Date.now,
    },
    workoutsForAI: { // string of data for workout 
        type: String,
        default: null,
    },
    totalNutritionForAI: { // string of data for nutrition values
        type: String,
        default: null,
    }
});

module.exports = mongoose.model('AICoachChat', AICoachChatSchema);