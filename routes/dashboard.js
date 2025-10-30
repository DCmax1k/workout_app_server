const express = require('express');
const authToken = require('../util/authToken');
const User = require('../models/User');
const router = express.Router();

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


module.exports = router;