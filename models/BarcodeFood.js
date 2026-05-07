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
            icon: null,
            image: null,
            description: "",
        }
    },
    ownerId: {
        type: String,
        required: true,
    },
    verified: {
        type: Boolean,
        default: false,
    }

});

module.exports = mongoose.model('BarcodeFood', BarcodeFoodSchema);