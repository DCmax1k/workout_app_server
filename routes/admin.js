const express = require('express');
const authToken = require('../util/authToken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const getUserInfo = require('../util/getUserInfo');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Check auth initially
router.post('/', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (user.rank !== "admin") {
            return res.json({
                status: 'error',
                message: 'Not admin.',
            });
        }
        const users = await User.find({}, { username: 1, _id: 1, premium: 1, profileImg: 1, usernameDecoration: 1, /* Admin stuff next */ verifyEmailCode: 1, rank: 1, trouble: 1, friends: 1, extraDetails: 1 });
        


        return res.json({
            status: 'success',
            user: {...getUserInfo(user)},
            users,
        });

    } catch(err) {
        console.error(err);
    }
});

// Login to admin
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        let user;
        if (username.includes("@")) {
            user = await User.findOne({email: username});
        } else {
            user = await User.findOne({username});
        }
        if (!user) {
            return res.json({
                status: 'error',
                message: 'No user with that username/email!',
            });
        }
        const checkPass = await bcrypt.compare(password, user.password);
        if (!checkPass) {
            return res.json({
                status: 'error',
                message: 'Incorrect password!',
            });
        }
        if (user.rank !== 'admin') {
            return res.json({
                status: 'error',
                message: 'Not admin.',
            });
        } 
        
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.cookie('auth-token', token, {expires: new Date(Date.now() + 20 * 365 *  24 * 60 * 60 * 1000) });

        const users = await User.find({}, { username: 1, _id: 1, premium: 1, profileImg: 1, usernameDecoration: 1, /* Admin stuff next */ verifyEmailCode: 1, rank: 1, trouble: 1, friends: 1, extraDetails: 1 });

        return res.json({
            status: 'success',
            user: {...getUserInfo(user)},
            users,
        });
    } catch(err) {
        console.error(err);
    }
});

// All users sent to client and search is local now
// router.post('/searchusers', authToken, async (req, res) => {
//     try {
//         const admin = await User.findById(req.userId);
//         if (admin.rank !== 'admin') {
//             return res.json({
//                 status: 'error',
//                 message: 'Not admin.',
//             });
//         } 
//         const { search, username, } = req.body;
//         const users = await User.find(
//             { username: { $regex: search, $options: 'i' } },
//             { username: 1, _id: 1, premium: 1, profileImg: 1, usernameDecoration: 1, /* Admin stuff next */ verifyEmailCode: 1, rank: 1, trouble: 1 });
        
//         //const filteredUsers = users.filter(user => user.username !== username);
//         res.json({
//             status: 'success',
//             users: users,
//             // [
//             //     { "_id": "690295af9feed1676b9c407f","premium": true, "profileImg": {"public_id": "", "url": "https://png.pngtree.com/png-vector/20231127/ourmid/pngtree-test-red-flat-icon-isolated-product-png-image_10722512.png"}, "username": "DBuser", "usernameDecoration": {"prefix": "test", "prefixColor": "red"}}

//             // ],
//         });
//     } catch(err) {
//         console.error(err);
//     }
// });

router.post("/assignpassword", authToken, async (req, res) => {
    try {   
        const admin = await User.findById(req.userId);
        if (admin.rank !== 'admin') {
            return res.json({
                status: 'error',
                message: 'Not admin.',
            });
        } 
        const {userId, password} = req.body;
        const user = await User.findById(userId);
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        await user.save();
        return res.json({
            status: "success",
        })

    } catch (err) {
        console.error(err);
    }
});

router.post("/assignpremium", authToken, async (req, res) => { 
    try {   
        const admin = await User.findById(req.userId);
        if (admin.rank !== 'admin') {
            return res.json({
                status: 'error',
                message: 'Not admin.',
            });
        } 
        const {userId, value} = req.body;
        const user = await User.findById(userId);
        // console.log(JSON.stringify(user._id) === JSON.stringify(admin._id));
        // if (JSON.stringify(user._id) === JSON.stringify(admin._id)) return res.json({status: "error", message: "Same user error"})
        user.premium = value;
        await user.save();
        return res.json({
            status: "success",
        })

    } catch (err) {
        console.error(err);
    }
});

router.post("/assignfreeze", authToken, async (req, res) => { 
    try {   
        const admin = await User.findById(req.userId);
        if (admin.rank !== 'admin') {
            return res.json({
                status: 'error',
                message: 'Not admin.',
            });
        } 
        const {userId, value} = req.body;
        const user = await User.findById(userId);
        user.trouble.frozen = value;
        user.markModified("trouble");
        await user.save();
        return res.json({
            status: "success",
        })

    } catch (err) {
        console.error(err);
    }
});

router.post("/assignprefix", authToken, async (req, res) => { 
    try {   
        const admin = await User.findById(req.userId);
        if (admin.rank !== 'admin') {
            return res.json({
                status: 'error',
                message: 'Not admin.',
            });
        } 
        const {userId, value} = req.body;
        const user = await User.findById(userId);
        user.set("usernameDecoration.prefix", value);
        await user.save();
        return res.json({
            status: "success",
        })

    } catch (err) {
        console.error(err);
    }
});

router.post("/assignprefixcolor", authToken, async (req, res) => { 
    try {   
        const admin = await User.findById(req.userId);
        if (admin.rank !== 'admin') {
            return res.json({
                status: 'error',
                message: 'Not admin.',
            });
        } 
        const {userId, value} = req.body;
        const user = await User.findById(userId);
        user.set("usernameDecoration.prefixColor", value);
        await user.save();
        return res.json({
            status: "success",
        })

    } catch (err) {
        console.error(err);
    }
});
router.post("/addaicredit", authToken, async (req, res) => { 
    try {   
        const admin = await User.findById(req.userId);
        if (admin.rank !== 'admin') {
            return res.json({
                status: 'error',
                message: 'Not admin.',
            });
        } 
        const {userId, } = req.body;
        const user = await User.findById(userId);
        user.set("extraDetails.ai.image.credits", user.extraDetails.ai.image.credits + 1);
        await user.save();
        return res.json({
            status: "success",
        })

    } catch (err) {
        console.error(err);
    }
});


module.exports = router;