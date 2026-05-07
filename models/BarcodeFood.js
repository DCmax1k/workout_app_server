const mongoose = require('mongoose');

const BarcodeFoodSchema = new mongoose.Schema({
    
    barcode: {
        type: String,
        required: true,
    },
    data: {
        type: Object,
        default: {
            name: "",
            unit: "",
            nutrition: {},
            image: null,
            description: "",
            quantity: 0,
            unit: '',
        }
    },
    ownerId: {
        type: String,
        required: true,
    },
    verified: {
        type: Boolean,
        default: false,
    },
    dateAdded: {
        type: Date,
        default: Date.now,
    }

});

module.exports = mongoose.model('BarcodeFood', BarcodeFoodSchema);