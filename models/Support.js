const mongoose = require('mongoose');

const SupportSchema = new mongoose.Schema({
    
    userId: { // optional
        type: Object,
    },
    email: {
        type: String,
        required: true,
    },
    type: { 
        type: String, // "generalsupport", ""
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    data: {
        type: Object,
    },
    dismissed: {
        type: Boolean,
        default: false,
    }

});

module.exports = mongoose.model('Support', SupportSchema);