const express = require('express');
const app = express();
const socketio = require('socket.io');
const authToken = require("./util/authToken");

// Imports
require('dotenv').config({quiet: true});
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require("cors");


// VERSION
const VERSION = "1.0.7";

// Middlewares
app.use(express.urlencoded({ extended: true }));
//app.use(express.json());
app.use(express.static(__dirname + '/client/build'));
app.use(cookieParser());
app.use(cors());
app.use(express.json({limit: '50mb'}));

// Main route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/build/index.html');
});
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/client/build/index.html');
});
app.get('/privacypolicy', (req, res) => {
    res.sendFile(__dirname + '/client/build/privacypolicy.html');
});

const dashboardRoute = require('./routes/dashboard');
app.use('/dashboard', dashboardRoute);

const loginRoute = require('./routes/login');
app.use('/login', loginRoute);

const adminRoute = require('./routes/admin');
app.use('/admin', adminRoute);

const aiRoute = require('./routes/ai');
app.use('/ai', aiRoute);

// DB models
const User = require('./models/User');
const Activity = require('./models/Activity');
const setupSocket = require('./socket');
const getUserInfo = require('./util/getUserInfo');

const friendIdToInfo = async (ids) => {
    return await Promise.all(ids.map(async f => {
        const friend = await User.findById(f);
        if (!friend) return null;
        return {
            ...getUserInfo(friend, true),
        };
    }));
}

// Get necesasry user info from db when authenticating
app.post('/auth', authToken, async (req, res) => {

    try {
        const u = await User.findOne({_id: req.userId});
        if (!u) {
            return res.json({status: 'error', message: 'Bad authentication!'})
        };
        
        // GET NOTIFICATIONS - coming soon - Be sure to get the ids of the user from notification model, and use the friends info to fill calculated below

        // Change ararys of id's to id's and the name and data needed to show profile like stats
        // friends = [id, id, id] -> [{id: 32423423, username: "DCmax1k", TODO: pastWorkoutsLength, favoriteExercise, longestWorkoutStreak, }];
        const newFriends = await friendIdToInfo(u.friends);
        const user = JSON.parse(JSON.stringify(u));

        // Modify user before sending back
        user.friends = newFriends.filter(f => f !== null);
        user.password = '';
        user.verifyEmailCode = '';

        // Get all recent activity from Activity modal, if user is in the sharedTo array
        
        // const recentActivity = [
        //     {
        //         ...rawActivityFromDb,
        //         // Added dynamically
        //         peopleDetails: {userId1: {username, usernameDecoration, premium, profileImg}}, // includes sender
        //     }
        // ];

        const rawRecentActivity = await Activity.find({people: req.userId})
        .sort({ timestamp: -1 })
        .limit(10);
        // For optimization, save people that have already been searched when going thru people in activity
        const allPeopleDetails = {};

        const recentActivity = await Promise.all(rawRecentActivity.map(async ac => {
            const act = ac.toObject();
            const peopleDetails = {};
            await Promise.all(act.people.map(async pId => {
                if (peopleDetails[pId]) return;
                if (allPeopleDetails[pId]) return peopleDetails[pId] = allPeopleDetails[pId];
                const p = await User.findById(pId);
                if (!p) return;
                // const pInfo = {
                //     userId: pId,
                //     username: p.username,
                //     usernameDecoration: p.usernameDecoration,
                //     premium: p.premium,
                //     profileImg: p.profileImg,
                // }; 
                const pInfo = {...getUserInfo(p), userId: pId};
                peopleDetails[pId] = pInfo;
                allPeopleDetails[pId] = pInfo;
            }));

            return {
                ...act,
                peopleDetails,
            }
        }));
        const userInfo = {
            recentActivity,
            dbId: req.userId,
            username: user.username,
            name: user.name,
            email: user.email,
            rank: user.rank,
            premium: user.premium,
            friendRequests: user.friendRequests,
            friendsAdded: user.friendsAdded,
            friends: user.friends,
            subscriptions: user.subscriptions,
            profileImg: user.profileImg,
            trouble: user.trouble,
            googleId: user.googleId,
            appleId: user.appleId,
            facebookId: user.facebookId,
            usernameDecoration: user.usernameDecoration,

        }

        // Testing functions - Fake delay, or error status
        //await new Promise(resolve => setTimeout(resolve, 5000));
        //return res.json({status: 'error', message: "Testing error message that is super long to test the alert notification that I made yesterday!"});
        const fullLocalUser = {recentActivity, ...user};
        //console.log("Returning full local user");

        return res.json({
            status: 'success',
            userInfo, 
            fullLocalUser,
            version: VERSION,
        });
    } catch(err) {
        console.error(err);
    }
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('Connected to MongoDB');
    const server = app.listen(process.env.PORT || 3003, () => {
        console.log('Serving on port 3003...');
    });

    const io = socketio(server, {
        cors: {
            origin: '*',
        }
    });
    setupSocket(io);
});