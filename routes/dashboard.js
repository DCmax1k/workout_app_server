const express = require('express');
const authToken = require('../util/authToken');
const router = express.Router();

const User = require('../models/User');
const Activity = require('../models/Activity');
const deepMerge = require('../util/deepMerge');

const getUserInfo = user => {
    return {
        _id: JSON.parse(JSON.stringify(user._id)),
        username: user.username,
        usernameDecoration: user.usernameDecoration,
        profileImg: user.profileImg,
        premium: user.premium
    }
}

// Upload user data. Each key and value pair are set in db, not synced
router.post('/uploaddata', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const {dataToUpload} = req.body;
        const keys = Object.keys(dataToUpload);

        keys.forEach(key => {
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

        console.log(newUser);
        user = newUser;
        //await user.save();
        res.json({status: "success", });

    } catch(err) {
        console.error(err);
    }
});


router.post('/requestactivity', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "No user"});
        const {activityData} = req.body;
        
        const userFriends = user.friends;
        const people = [...userFriends, req.userId];
        console.log("People for new activity: ", people);

        let showAchievement = activityData.type === "complete_workout_achievement";
        // if an achievement one, check if already posted
        // Check if already notified users of this activity - need only for certain details objects
        if (showAchievement) {
            console.log("Show achievement, checking...");
            const allActivityByUser = await Activity.find({userId: req.userId, type: "complete_workout_achievement"});
            if (allActivityByUser.map(a => a.details.totalWorkouts).includes(activityData.details.totalWorkouts)) {
                showAchievement = false;
                activityData.type = "complete_workout";
            };
        }
        

        const newActivity = new Activity({
            userId: user._id,
            type: activityData.type,
            timestamp: Date.now(),
            people,
            details: activityData.details,
            reactions: {},
        });
        console.log("New activity: ", newActivity);
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

        return res.json({status: "success", activity: {...act, peopleDetails}});

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
        console.log("New reactions ", reactions);
        await activity.save();

        return res.json({status: "success"});

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
    const newPersonFriendRequests = [...personFriendRequests, {...getUserInfo(user), read: false}]
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
        
        
        res.json({status: "success", });

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
    console.log("Friend requests before: ", friend.friendRequests);
    const newFriendFriendRequests = friend.friendRequests.filter(fr => fr._id !== JSON.parse(JSON.stringify(user._id)));
    console.log("Friend requests after: ", newFriendFriendRequests);
    console.log("Should filter out friend id: ", user._id);
    console.log("Should filter out friend id: ", JSON.parse(JSON.stringify(user._id)));
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
            console.log("Calling unadd");
            await unaddUser(user, friend);
        }
        
        
        res.json({status: "success", });

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
        
        
        res.json({status: "success", });

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


module.exports = router;