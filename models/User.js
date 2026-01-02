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
        required: false,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    verifyEmailCode: { // not local
        type: String,
        default: '',
    },
    forgotPassword: { // not local
        type: Object,
        default: {
            code: "",
            lastSent: Date.now,
        }
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
            warnings: [], // {message: "warning", read: false},
            frozen: false,
        }
    },
    extraDetails: {
        type: Object,
        default: {
            ai: {
                image: {
                    used: 0,
                    credits: 10,
                    lastReset: Date.now(),
                },
                foodText: {
                    used: 0,
                    credits: 30,
                    lastReset: Date.now(),
                }
            },
            preferences: {
                heightUnit: "imperial", // feet, cm
                liftUnit: "imperial", // metric, imperial
                distanceUnit: "imperial", // metric, imperial

                // Theme
                systemTheme: "dark", // light, dark, system

                // Workouts
                restTimerAmount: 120, // seconds. 0 counts up 

                // Sharing
                workouts: true,
                achievements: true,
                // .......
            },
        },

    },
    premiumSubscription: {
        type: Object,
        default: {
            service: null, // stripe, apple, google
            stripe: {
                customerId: "",
                subscriptionId: "",
            },
            apple: {

            },
            google: {

            }
        }
    },
    
    // Everything below is only in the db if the user uploads the data to the backend

    streak: {
        required: true,
        type: Object,
        default: {
            longestStreak: 0,
            currentStreak: 0,
            achievementAmount: 0,
        }
    },
    settings: {
        required: true,
        type: Object,
        default: {}
    },
    usernameDecoration: {
        required: true,
        type: Object,
        default: {
            prefix: "",
            prefixColor: "#000",
            description: "",
        }
    },
    
    schedule: {
        required: true,
        type: Object,
        default: {
            currentIndex: 0,
            rotation: [],
        }
    },
    archivedExercises: {
        required: true,
        type: Object,
        default: {} 
    },
    createdExercises: {
        required: true,
        type: [Object],
        default: [] 
    },
    completedExercises: {
        required: true,
        type: Object,
        default: {} 
    },
    savedWorkouts: {
        required: true,
        type: [Object],
        default: [] 
    },
    customFoods: {
        required: true,
        type: Object,
        default: {} 
    },
    archivedFoods: {
        required: true,
        type: Object,
        default: {} 
    },
    foodCategories: {
        required: true,
        type: [String],
        default: [] 
    },
    savedMeals: {
        required: true,
        type: [Object],
        default: [], 
    },
    consumedMeals: {
        required: true,
        type: Object,
        default: {} 
    },
    pastWorkouts: {
        required: true,
        type: [Object],
        default: [] 
    },
    tracking: {
        required: true,
        type: Object,
        default: {
            visibleWidgets: ["nutrition"],
            nutrition: {
                "calories": {
                    // Data is calculated live from consumedMeals and the date
                    extraData: {
                        goal: 2000,
                    }
                },
                "protein": {
                    extraData: {
                        goal: 150,
                    }
                },
                "carbs": {
                    extraData: {
                        goal: 150,
                    }
                },
                "fat": {
                    extraData: {
                        goal: 150,
                    }
                }
            },
            insights: {
                expenditure: {
                    data: [], // This data holds exercise and food data
                    unit: "kcal",
                    layout: "expenditure", // weight, calorie, none, bmi, expenditure
                    color: "#DB8854",
                    extraData: {},
                },
                BMI: {
                    data: [ ], // Fully dynamically convered
                    unit: "",
                    layout: "bmi", // weight, calorie, none, bmi 
                    color: "#54DBA9",
                    extraData: {},
                },
            },
            logging: {
                "weight": {
                    data: [  ], // [{date, amount}]
                    unit: "lbs", // lbs, kgs
                    layout: "weight", // weight, calorie, none, bmi 
                    color: "#DBD654",
                    extraData: {
                        goal: null,
                    },
                    inputOptions: {
                        increment: 0.1,
                        range: [0, 2000],
                        scrollItemWidth: 10,
                        defaultValue: 150,
                    }
                },
                "sleep amount": {
                    data: [  ],
                    unit: "hrs",
                    layout: "weight", // weight, calorie, none, bmi
                    color: "#DB5454", 
                    extraData: {
                        goal: 8,
                    },
                    inputOptions: {
                        increment: 0.1,
                        range: [0, 30],
                        scrollItemWidth: 20,
                        defaultValue: 8,
                    }
                },
                "sleep quality": {
                    data: [ ],
                    unit: "/10",
                    layout: "weight", // weight, calorie, none, bmi 
                    color: "#DB8854",
                    extraData: {
                        goal: null,
                    },
                    inputOptions: {
                        increment: 0.1,
                        range: [0, 10],
                        scrollItemWidth: 50,
                        defaultValue: 10,
                    }
                },
                "water intake": {
                    data: [], // [{date, amount,}] // in cups
                    unit: "cups",
                    layout: "water", // weight, calorie, none, bmi 
                    color: "#546FDB",
                    extraData: {
                        goal: 15, // cups
                        valueToAdd: 1,
                    },
                    inputOptions: {
                        increment: 0.1,
                        range: [0, 100],
                        scrollItemWidth: 10,
                        defaultValue: 0,
                    }
                },

            }
        } 
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