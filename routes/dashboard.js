const express = require('express');
const authToken = require('../util/authToken');
const bcrypt = require('bcrypt');
const router = express.Router();
const cloudinary = require("../util/cloudinary");

const User = require('../models/User');
const Activity = require('../models/Activity');
const deepMerge = require('../util/deepMerge');
const getUserInfo = require('../util/getUserInfo');
const findInsertIndex = require('../util/findInsertIndex');
const getDateKey = require('../util/getDateKey');
const confirmActivityPreferences = require('../util/confirmActivityPrefs');

function validateUsername(username) {
    if (username === 'YOU') return "Username cannot be 'YOU'";
    if (username === 'User1') return "Username cannot be 'User1'";
    if (username.includes(',')) return 'Username cannot contain ","';
    if (username.includes(' ')) return 'Username cannot contain " "';
    if (username.length > 15) return 'Username cannot be longer than 15 characters';
    if (username.length < 2) return 'Username must include at least 2 character';
    return 'success';
}


// Upload user data. Each key and value pair are set in db, not synced
router.post('/uploaddata', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {dataToUpload} = req.body;
        const keys = Object.keys(dataToUpload);

        keys.forEach(key => {
            // Checks for protection
            if (['_id', 'dbId', 'username', 'usernameDecoration', 'name', 'email', 'dateJoined', 'rank', 'premium', 'friends', 'subscriptions', 'profileImg', 'trouble', 'googleId', 'appleId', 'facebookId'].includes(key)) {
                return;
            }
            user[key] = dataToUpload[key];
        });

        await user.save();
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});


// Full download of user
router.post('/downloaddata', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {keys} = req.body;

        const dataToDownload = {};
        keys.forEach(key => {
            dataToDownload[key] = user[key];
        });

        res.json({status: "success", dataToDownload});

    } catch(err) {
        console.error(err);
    }
});

// Update user, sends updates about the user to sync to the db - Not using yet
router.post('/updateuser', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const {updates} = req.body;
        if (!user || !updates) return res.json({status: "error", message: "User not found"});
        
        const newUser = deepMerge(JSON.parse(JSON.stringify(user)), updates);
        user = newUser;
        //await user.save();
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/editprofile', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {key, value} = req.body;
        switch (key) {
            case "username":
                
                const vUsername = validateUsername(value);
                if (vUsername !== 'success') return res.json({status: 'error', message: vUsername});
                const checkUser = await User.findOne({ username: value });
                if (checkUser) {
                    return res.json({status: 'error', message: 'Username already taken'});
                }
                user.username = value;
                await user.save();
                break;
            case "desc":
                user.usernameDecoration.description = value;
                user.markModified("usernameDecoration");
                await user.save();
                break;
            case "profileImg":
                const image = value;
                const result = await cloudinary.uploader.upload(image, {
                    folder: "profileImages",
                });
                const imageURL = result.secure_url;
                const imageID = result.public_id;

                // Delete old image here
                const oldImageID = user.profileImg.public_id;
                if (oldImageID) {
                    await cloudinary.uploader.destroy(oldImageID);
                }

                // Save new url
                user.profileImg.url = imageURL;
                user.profileImg.public_id = imageID;
                user.markModified("profileImg");
                await user.save();
                return res.json({
                    status: 'success',
                    imageURL,
                    imageID,
                });
            case "email":
                const checkEmail = await User.findOne({ email: value });
                if (checkEmail) {
                    return res.json({status: 'error', message: 'Email already taken'});
                }
                user.email = value;
                await user.save();
                return res.json({status: "success"});
            case "password":
                const checkPass = await bcrypt.compare(value, user.password);
                if (!checkPass) {
                    return res.json({
                        status: 'error',
                        message: 'Incorrect password!',
                    });
                }
                const {newPassword} = req.body;
                const hashedPassword = await bcrypt.hash(newPassword, 10);
                user.password = hashedPassword;
                await user.save();
                return res.json({status: "success"});
            default:
                return res.json({status: 'error', message: "Key doesn't match"});
        }
        return res.json({status: "success",});
    } catch(err) {
        console.error(err);
    }
})



router.post('/requestactivity', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "No user"});
        const {activityData} = req.body;
        
        const userFriends = user.friends;
        const people = [...userFriends, req.userId];

        // Check activity preferences
        const checkPrefs = confirmActivityPreferences(user.extraDetails.preferences, activityData.type);
        if (!checkPrefs) return res.json({status: "success", reject: true});
        let showAchievement = activityData.type === "complete_workout_achievement";
        // if an achievement one, check if already posted
        // Check if already notified users of this activity - need only for certain details objects
        if (showAchievement) {
            // Check if prefs say acheivement and no workout
            if (!user.extraDetails.preferences.workouts) {
                console.log("setting to null");
                activityData.details.workout = null;
            }

            if (user.streak.achievementAmount < activityData.details.totalWorkouts) {
                console.log("Setting streak amount");
                user.streak.achievementAmount = activityData.details.totalWorkouts
                await user.save();
            }

            const allActivityByUser = await Activity.find({userId: req.userId, type: "complete_workout_achievement"});
            if (allActivityByUser.map(a => a.details.totalWorkouts).includes(activityData.details.totalWorkouts)) {
                showAchievement = false;
                activityData.type = "complete_workout";
            }
        }
        

        const newActivity = new Activity({
            userId: user._id,
            type: activityData.type,
            timestamp: Date.now(),
            people,
            details: activityData.details,
            reactions: {},
        });
        await newActivity.save();

        const allPeopleDetails = {};
        const act = newActivity.toObject();
        const peopleDetails = {};
        await Promise.all(act.people.map(async pId => {
            if (peopleDetails[pId]) return;
            if (allPeopleDetails[pId]) return peopleDetails[pId] = allPeopleDetails[pId];
            const p = await User.findById(pId);
            const pInfo = {
                userId: pId,
                username: p.username,
                usernameDecoration: p.usernameDecoration,
                premium: p.premium,
                profileImg: p.profileImg,
            }; 
            peopleDetails[pId] = pInfo;
            allPeopleDetails[pId] = pInfo;
        }));

        return res.json({status: "success", activity: {...act, peopleDetails},});

    } catch(err) {
        console.error(err);
    }
});

router.post('/logpastworkout', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {data} = req.body;

        const pastWorkouts = user.pastWorkouts;
        pastWorkouts.push(data);
        user.pastWorkouts = pastWorkouts;
        user.markModified("pastWorkouts");
        await user.save();
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

// Add reaction to 
router.post('/activityreact', authToken, async (req, res) => {
    try {
        
        const {activityId, emoji} = req.body; // Send "" for emoji to unreact
        const activity = await Activity.findById(activityId);
        // clear user from all emojis, then add the requested one
        const reactions = activity.reactions;
        Object.keys(reactions).forEach(e => {
            if (reactions[e].includes(req.userId)) {
                reactions[e] = reactions[e].filter(id => id !== req.userId)
            }
        });
        if (emoji) {
            if (reactions[emoji]) {
                reactions[emoji] = [...reactions[emoji], req.userId];
            } else {
                reactions[emoji] = [req.userId];
            }
        }
        activity.reactions = reactions;
        activity.markModified("reactions");
        await activity.save();

        return res.json({status: "success", activity: {...activity.toJSON()}});

    } catch(err) {
        console.error(err);
    }
});

// Search users
router.post('/searchusers', authToken, async (req, res) => {
    try {
        const { search, username, } = req.body;
        const users = await User.find({ username: { $regex: search, $options: 'i' } }, { username: 1, _id: 1, premium: 1, profileImg: 1, usernameDecoration: 1, });
        
        const filteredUsers = users.filter(user => user.username !== username);
        res.json({
            status: 'success',
            users: filteredUsers,
            // [
            //     { "_id": "690295af9feed1676b9c407f","premium": true, "profileImg": {"public_id": "", "url": "https://png.pngtree.com/png-vector/20231127/ourmid/pngtree-test-red-flat-icon-isolated-product-png-image_10722512.png"}, "username": "DBuser", "usernameDecoration": {"prefix": "test", "prefixColor": "red"}}

            // ],
        });
    } catch(err) {
        console.error(err);
    }
});

const addUser = async (user, friend) => {
    // Add person to added of user
    const friendsAdded = user.friendsAdded;
    const newFriendsAdded = [...friendsAdded, getUserInfo(friend)];
    user.friendsAdded = newFriendsAdded;
    user.markModified("friendsAdded");
    await user.save();

    // Add user to friendRequests of person
    const personFriendRequests = friend.friendRequests;
    const newPersonFriendRequests = [{...getUserInfo(user), read: false}, ...personFriendRequests]
    friend.friendRequests = newPersonFriendRequests;
    friend.markModified("friendRequests");
    await friend.save();
}
const acceptUser = async (user, friend) => {
    // Remove friend from user friendrequests & Add friend to user friends
    const friendRequests = user.friendRequests;
    const newFriendRequests = friendRequests.filter(p => p._id != JSON.parse(JSON.stringify(friend._id)));
    user.friendRequests = newFriendRequests;
    user.friends = [...user.friends, getUserInfo(friend)._id];
    user.markModified("friendRequests");
    user.markModified("friends");
    await user.save();

    // Remove user from friend friendsAdded & Add user to friends friends
    const personFriendsAdded = friend.friendsAdded;
    const newPersonFriendsAdded = personFriendsAdded.filter(p => p._id != JSON.parse(JSON.stringify(user._id)))
    friend.friendsAdded = newPersonFriendsAdded;
    friend.friends = [...friend.friends, getUserInfo(user)._id];
    friend.markModified("friendsAdded");
    friend.markModified("friends");
    await friend.save();

}

// HANDLES (Add user / send friend request) & (Accept user friend request)
router.post('/adduser', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const {person} = req.body;
        const friend = await User.findById(person._id);
        if (!user || !person) return res.json({status: "error", message: "User not found"});

        if (friend.friendsAdded.map(p => p._id).includes(req.userId)) {
            // Friend already added user, so user will accept instead of add
            await acceptUser(user, friend);
        } else {
            // Add user
            await addUser(user, friend);
        }
        
        
        res.json({status: "success", freshUserInfo: getUserInfo(user, true) });

    } catch(err) {
        console.error(err);
    }
});

const removeUser = async (user, friend) => {
    // Remove user from friends friends
    const newUserFriends = user.friends.filter(f => f !== JSON.parse(JSON.stringify(friend._id)));
    user.friends = newUserFriends;
    user.markModified("friends");
    await user.save();

    // Remove friend from user friends
    const newFriendFriends = friend.friends.filter(u => u !== JSON.parse(JSON.stringify(user._id)));
    friend.friends = newFriendFriends;
    friend.markModified("friends");
    await friend.save();

}
const unaddUser = async (user, friend) => {
    // Remove friend from user friendsAdded
    const newUserFriendsAdded = user.friendsAdded.filter(fa => fa._id !== JSON.parse(JSON.stringify(friend._id)));
    user.friendsAdded = newUserFriendsAdded;
    user.markModified("friendsAdded");
    await user.save();

    // Remove user from friends friendRequests
    const newFriendFriendRequests = friend.friendRequests.filter(fr => fr._id !== JSON.parse(JSON.stringify(user._id)));
    friend.friendRequests = newFriendFriendRequests;
    friend.markModified("friendRequests");
    await friend.save();

}

// HANDLES (Unadd user / unsend friend request) & (Remove friend)
router.post('/unadduser', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const {person} = req.body;
        const friend = await User.findById(person._id);
        if (!user || !person) return res.json({status: "error", message: "User not found"});

        if (friend.friends.includes(req.userId)) {
            // Friend already accepted user, so user will remove instead of unadd
            await removeUser(user, friend);
        } else {
            // Unadd user
            await unaddUser(user, friend);
        }
        
        
        res.json({status: "success", freshUserInfo: getUserInfo(user) });

    } catch(err) {
        console.error(err);
    }
});
// HANDLES reject request - opposite of unadding
router.post('/rejectuser', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const {person} = req.body;
        const friend = await User.findById(person._id);
        if (!user || !person) return res.json({status: "error", message: "User not found"});

        await unaddUser(friend, user);
        
        
        res.json({status: "success", freshUserInfo: getUserInfo(user) });

    } catch(err) {
        console.error(err);
    }
});

router.post('/readallnotis', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});

        const newFriendRequests = user.friendRequests.map(fr => {
            return {...fr, read: true}
        });
        user.friendRequests = newFriendRequests;
        user.markModified("friendRequests");
        await user.save();
        
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/saveworkout', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {workout} = req.body;
        
        const savedWorkouts = user.savedWorkouts;
        const idx = savedWorkouts.findIndex(w => w.id === workout.id);
        if (idx >= 0) {
            // Update existing
            savedWorkouts[idx] = workout;
        } else {
            // New save
            savedWorkouts.unshift(workout);
        }
        user.savedWorkouts = savedWorkouts;
        user.markModified("savedWorkouts");
        await user.save();
        
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/removeworkout', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {workoutID} = req.body;

        const savedWorkouts = user.savedWorkouts;
        const newSavedWorkouts = savedWorkouts.filter(w => w.id !== workoutID);
        user.savedWorkouts = newSavedWorkouts;

        // Remove from old schedule if exists
        let schedule = user.schedule;
        const newRotation = user.schedule?.rotation?.filter(id => id !== workoutID);
        schedule = {...schedule, rotation: newRotation || [], currentIndex: 0}
        user.schedule = schedule;

        user.markModified("savedWorkouts");
        user.markModified("schedule");
        await user.save();
        
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});


router.post('/updatesettings', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {key, value} = req.body;

        user.settings[key] = value;
        user.markModified("settings");
        await user.save();
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/pushloggingweightlayout', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {category, obj} = req.body;
        
        const c = user.tracking.logging[category];
        if (!c) user.tracking.logging[category] = {};
        const cData = user.tracking.logging[category].data ?? [];
        if (cData.length === 0 || new Date(cData[cData.length -1].date).getTime() < new Date(obj.date).getTime()) {
            cData.push(obj);
        } else {
            const idx = findInsertIndex(cData.map(d => d.date), obj.date);
            cData.splice(idx, 0, obj);
        }
        
        user.tracking.logging[category].data = cData;
        user.markModified("tracking");
        await user.save();
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/deletedatapoint', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {category, timeOfData} = req.body;
        
        const dataa = user.tracking.logging[category].data;
        const ind = dataa.findIndex(d => d.date === timeOfData);
        const newData = JSON.parse(JSON.stringify(dataa));
        newData.splice(ind, 1);
        
        user.tracking.logging[category].data = newData;
        user.markModified("tracking");
        await user.save();
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/savelogginggoal', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {category, value} = req.body;
        
        user.tracking.logging[category].extraData.goal = value;
        user.markModified("tracking");
        await user.save();
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/addloggingwaterlayout', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {category, valueToAdd} = req.body;
        

        const widget = user.tracking.logging[category];
        const cData = widget.data;
        const currentTime = new Date();
        const newTime = currentTime.getTime();

        const dataEntriesOnDate = widget.data.filter(k => new Date(k.date).toDateString() === currentTime.toDateString());
        if (dataEntriesOnDate.length > 0) {
            // Edit existing entry
            const entryToEdit = dataEntriesOnDate[0];
            const entryIndex = cData.findIndex(e => e.date === entryToEdit.date);
            const obj = {date: newTime, amount: valueToAdd+entryToEdit.amount};
            
            cData[entryIndex] = obj;
            user.tracking.logging[category].data = cData;
        } else {
            // Add new entry
            if (cData.length === 0 || new Date(cData[cData.length -1].date).getTime() < new Date(newTime).getTime()) {
                const obj = {date: newTime, amount: valueToAdd};
                cData.push(obj);

            } else {
                const idx = findInsertIndex(cData.map(d => d.date), newTime);
                const obj = {date: newTime, amount: valueToAdd};
                cData.splice(idx, 0, obj);

            }
            user.tracking.logging[category].data = cData;
        }


        user.markModified("tracking");
        await user.save();
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/savemacrogoal', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {key, value} = req.body;
        
        user.tracking.nutrition[key].extraData.goal = value;
        user.markModified("tracking");
        await user.save();
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/savemeal', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {meal} = req.body;

        const savedMeals = user.savedMeals;
        const idx = savedMeals.findIndex(m => m._id === meal._id);
        if (idx >= 0) {
            // Update existing
            savedMeals[idx] = meal;
        } else {
            // New save
            savedMeals.unshift(meal);
        }
        user.savedMeals = savedMeals;
        user.markModified("savedMeals");
        await user.save();
        
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/removemeal', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {meal} = req.body;

        const savedMeals = user.savedMeals;
        const newSavedMeals = savedMeals.filter(m => m.id !== meal.id);
        user.savedMeals = newSavedMeals;

        user.markModified("savedMeals");
        await user.save();
        
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/logconsumption', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {meal} = req.body;
        const dateKey = getDateKey(meal.date);
        const consumedMeals = user.consumedMeals;
        const todaysMeals = consumedMeals[dateKey] ?? [];
        const newMeals = [meal, ...todaysMeals];
        const newConsumedMeals = {...consumedMeals, [dateKey]: newMeals};
        user.consumedMeals = newConsumedMeals;
        user.markModified("consumedMeals");
        await user.save();

        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/addmealtoconsumptionday', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {meal, date, id} = req.body;
        const dateKey = getDateKey(date);
        const consumedMeals = user.consumedMeals;
        const todaysMeals = consumedMeals[dateKey] ?? [];
        const newMeals = [{...meal, id, date: date}, ...todaysMeals];
        const newConsumedMeals = {...consumedMeals, [dateKey]: newMeals};
        user.consumedMeals = newConsumedMeals;
        user.markModified("consumedMeals");
        await user.save();

        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});


router.post('/removeconsumption', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {meal} = req.body;
        const dateKey = getDateKey(meal.date);
        const consumedMeals = user.consumedMeals;
        const todaysMeals = consumedMeals[dateKey] ?? [];
        const newMeals = todaysMeals.filter(m => m.id !== meal.id);
        const newConsumedMeals = {...consumedMeals, [dateKey]: newMeals};
        user.consumedMeals = newConsumedMeals;
        user.markModified("consumedMeals");
        await user.save();

        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/savefood', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {food} = req.body;

        const customFoods = user.customFoods;
        customFoods[food.id] = food;
        user.customFoods = customFoods;
        
        user.markModified("customFoods");
        await user.save();
        
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/saveexercise', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {exercise} = req.body;

        const createdExercises = user.createdExercises;
        createdExercises.unshift(exercise);
        user.createdExercises = createdExercises;
        user.markModified("createdExercises");
        await user.save();
        
        
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});

router.post('/setpreference', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {key, value} = req.body;
        user.extraDetails.preferences[key] = value;
        user.markModified("extraDetails");
        await user.save();
        res.json({status: "success",});
    } catch(err) {
        console.error(err);
    }
})

module.exports = router;