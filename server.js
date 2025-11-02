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
const VERSION = "1.0.1";

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

const dashboardRoute = require('./routes/dashboard');
app.use('/dashboard', dashboardRoute);

const loginRoute = require('./routes/login');
app.use('/login', loginRoute);

const adminRoute = require('./routes/admin');
app.use('/admin', adminRoute);

// DB models
const User = require('./models/User');

// Get necesasry user info from db when authenticating
app.post('/auth', authToken, async (req, res) => {

    try {
        const u = await User.findOne({_id: req.userId});
        if (!u) {
            return res.json({status: 'error', message: 'Bad authentication!'})
        };
        

        // Change ararys of id's to id's and the name
        // friends = [id, id, id] -> [{id: 32423423, username: "DCmax1k",}];
        // groups = [{name: 'PorkGroup', id: '234234234',}];
        const newFriends = await Promise.all(u.friends.map(async f => {
            const friend = await User.findById(f);
            if (!friend) return null;
            return {
                username: friend.username,
                id: f,

            };
        }));
        const user = JSON.parse(JSON.stringify(u));

        // Modify user before sending back
        user.friends = newFriends.filter(f => f !== null);
        user.password = '';
        user.verifyEmailCode = '';

        const recentActivity = [];

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

        }

        // Testing functions - Fake delay, or error status
        //await new Promise(resolve => setTimeout(resolve, 5000));
        //return res.json({status: 'error', message: "Testing error message that is super long to test the alert notification that I made yesterday!"});

        return res.json({
            status: 'success',
            userInfo,
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
});