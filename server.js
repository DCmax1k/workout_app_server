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
const stripe = require('stripe')(process.env.STRIPE_SECRET);


// VERSION
const VERSION = "1.0.8";

// Middlewares
app.use(express.urlencoded({ extended: true }));
//app.use(express.json());
app.use(express.static(__dirname + '/client/build'));
app.use(cookieParser());
app.use(cors());

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

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let data;
  let eventType;
  // Check if webhook signing is configured.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers["stripe-signature"];

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  switch (eventType) {
    case 'checkout.session.completed':
        // Payment is successful and the subscription is created.
        // You should provision the subscription and save the customer ID to your database.
        console.log("payment complete");
        const session = data.object;
        // 1. Get the user's ID (usually passed via client_reference_id or metadata)
        const userId = session.metadata.userId; 
        
        // 2. Get the Stripe data
        const stripeCustomerId = session.customer;
        const subscriptionId = session.subscription;

        // 3. Update your MongoDB
        const user = await User.findById(userId);
        if (!user.premiumSubscription) user.premiumSubscription = {service: "stripe", stripe: {customerId: "", subscriptionId: "",}, apple: {}, google: {}};
        user.premiumSubscription.service = 'stripe';
        user.premiumSubscription['stripe'].customerId = stripeCustomerId;
        user.premiumSubscription['stripe'].subscriptionId = subscriptionId;
        user.markModified("premiumSubscription");
        user.premium = true;
        user.markModified("premium");
        await user.save();

        console.log(`Provisioned subscription for ${user.username}`);
        break;
    case 'customer.subscription.deleted':
        const subscription = data.object;7
        const user2 = await User.findOne({
            "premiumSubscription.stripe.customerId": subscription.customer
        });
        if (!user2) {
            console.log("User not found with cus_id ", subscription.customer);
            break;
        };
        user2.premium = false;
        user2.premiumSubscription.stripe.subscriptionId = null;
        user2.markModified("premium");
        user2.markModified("premiumSubscription");
        await user2.save();
        
        break;
    case 'invoice.paid':
      // Continue to provision the subscription as payments continue to be made.
      // Store the status in your database and check when a user accesses your service.
      // This approach helps you avoid hitting rate limits.
      break;
    case 'invoice.payment_failed':
      // The payment failed or the customer doesn't have a valid payment method.
      // The subscription becomes past_due. Notify your customer and send them to the
      // customer portal to update their payment information.
      break;
    default:
      // Unhandled event type
  }

  res.sendStatus(200);
});


app.use(express.json({limit: '50mb'}));



// Main route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/build/index.html');
});
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/client/build/index.html');
});
app.get('/dashboard', (req, res) => {
    res.sendFile(__dirname + '/client/build/index.html');
});
app.get('/login', (req, res) => {
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

const stripeRoute = require('./routes/stripe');
app.use('/stripe', stripeRoute);

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

        // Check AI usage and credits
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const aiImageUsage = user.extraDetails.ai.image ?? {credits: 10, lastReset: now.getTime(), used: 0};
        const lastResetDateImage = new Date(aiImageUsage.lastReset).toISOString().split('T')[0];
        // Reset AI image credits
        if (user.premium && todayStr !== lastResetDateImage) {
            console.log("Resetting credits");
            aiImageUsage.credits = 10;
            aiImageUsage.lastReset = now.getTime();
            
            user.extraDetails.ai.image = aiImageUsage;
        }
        // Reset AI food text credits
        const aiFoodText = user.extraDetails.ai.foodText ?? {credits: 30, lastReset: now.getTime(), used: 0};
        const lastResetDateFoodText = new Date(aiFoodText.lastReset).toISOString().split('T')[0];
        if (user.premium && todayStr !== lastResetDateFoodText) {
            aiFoodText.credits = 30;
            aiFoodText.lastReset = now.getTime();
            user.extraDetails.ai.foodText = aiFoodText;
        }

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
            extraDetails: user.extraDetails,
            premiumSubscription: user.premiumSubscription,
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