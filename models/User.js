const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    lastOnline: {
        type: Date,
        default: Date.now,
    },
    
    username: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        default: "",
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    verifyEmailCode: {
        type: "String",
        default: '',
    },
    dateJoined: {
        type: Date,
        default: Date.now,
    },
    rank: {
        type: String,
        default: "user",
    },
    premium: {
        type: Boolean,
        default: false,
    },
    friendRequests: {
        type: [Object], // [{friendID:, friendUsername:}]
        default: [],
    },
    friendsAdded: {
        type: [Object], // [{friendID:, friendUsername:}]
        default: [],
    },
    friends: {
        type: [String], // ids of friend
        default: [],
    },
    subscriptions: {
        type: Array,
        default: [],
    },
    profileImg: {
        url: {
            type: String,
            default: '',
        },
        public_id: {
            type: String,
            default: '',
        }
    },
    trouble: {
        type: Object,
        default: {
            bans: [],
            frozen: false,
        }
    },
    
    // Everything below is only in the db if the user uploads the data to the backend

    settings: {
        type: Object,
        default: {}
    },
    usernameDecoration: {
        type: Object,
        default: {}
    },
    
    schedule: {
        type: Object,
        default: {}
    },
    archivedExercises: {
        type: Object,
        default: {} 
    },
    createdExercises: {
        type: [Object],
        default: [] 
    },
    completedExercises: {
        type: Object,
        default: {} 
    },
    savedWorkouts: {
        type: [Object],
        default: [] 
    },
    customFoods: {
        type: Object,
        default: {} 
    },
    archivedFoods: {
        type: Object,
        default: {} 
    },
    foodCategories: {
        type: [String],
        default: [] 
    },
    savedMeals: {
        type: [Object],
        default: [], 
    },
    consumedMeals: {
        type: Object,
        default: {} 
    },
    pastWorkouts: {
        type: [Object],
        default: [] 
    },
    tracking: {
        type: Object,
        default: {} 
    },
    googleId: {
        type: String,
        default: "",
    },
    appleId: {
        type: String,
        default: "",
    },
    facebookId: {
        type: String,
        default: "",
    },


});

module.exports = mongoose.model('User', UserSchema);