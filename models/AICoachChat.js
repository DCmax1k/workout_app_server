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
            timestamp: { type: Date, default: Date.now }
        }
    ],
    dateCreated: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('AICoachChat', AICoachChatSchema);