const express = require('express');
const authToken = require('../util/authToken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const getUserInfo = require('../util/getUserInfo');
const router = express.Router();
const jwt = require('jsonwebtoken');

const stripe = require('stripe')(process.env.STRIPE_SECRET);

router.post("/create-checkout-session", authToken, async (req, res) => {
    try {
        const {priceId} = req.body;
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card', 'paypal', 'cashapp'],
            metadata: {
                userId: req.userId,
            },
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                }
            ],
            success_url: process.env.DOMAIN + "/dashboard?session_id={CHECKOUT_SESSION_ID}",
            cancel_url: process.env.DOMAIN + "/dashboard"
        });
        res.json({status: 'success', url: session.url})
    } catch(err) {
        console.error(err);

    }
});

router.post("/managebilling", authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.json({status: "error", message: "User not found"});
        const returnUrl = process.env.DOMAIN + "/dashboard";
        const customerId = user.premiumSubscription?.stripe?.customerId;
        if (!customerId) return res.json({status: "error", message: "Stripe user not found"});

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
        res.json({status: "success", url: portalSession.url})
    } catch(err) {
        console.error(err);
    }
})

module.exports = router;