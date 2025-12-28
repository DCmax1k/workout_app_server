const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const authToken = require("../util/authToken");

const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const User = require('../models/User');
const generateSixDigits = require('../util/generateSixDigits');
const { sendForgotPassword } = require('../util/sendEmail');

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}
function validatePass(pass) {
    return pass.length >= 8;
}
function validateUsername(username) {
    if (username === 'YOU') return "Username cannot be 'YOU'";
    if (username === 'User1') return "Username cannot be 'User1'";
    if (username.includes(',')) return 'Username cannot contain ","';
    if (username.includes(' ')) return 'Username cannot contain " "';
    if (username.length > 15) return 'Username cannot be longer than 15 characters';
    if (username.length < 2) return 'Username must include at least 2 character';
    return 'success';
}

router.post("/checkusername", async (req, res) => {
    const {username} = req.body;
    const checkUser = await User.findOne({ username });
    if (checkUser) {
        return res.json({status: 'error', message: 'Username already taken'});
    }
    return res.json({
        status: "success",
    });
})

router.post('/createaccount', async (req, res) => {
    try {
        const { partyType, idToken, username, email, password} = req.body;

        // const checkUser = await User.findOne({ username });
        // if (checkUser) {
        //     return res.json({status: 'error', message: 'Username already taken'});
        // }
        // const checkEmail = await User.findOne({ email });
        // if (checkEmail) {
        //     return res.json({status: 'error', message: 'Email already taken'});
        // }
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });
        if (existingUser) {
            if (existingUser.username === username) {
                return res.json({ status: 'error', message: 'Username already taken' });
            }
            if (existingUser.email === email) {
                return res.json({ status: 'error', message: 'Email already taken' });
            }
        }

        const vUsername = validateUsername(username);
        if (vUsername !== 'success') return res.json({status: 'error', message: vUsername});
        if (!validateEmail(email)) return res.json({status: 'error', message: 'Please enter a valid email'});

        const preUser = {};
        let hashedPassword = "";
        if (!partyType) {
            if (!validatePass(password)) return res.json({status: 'error', message: 'Password must be at least 8 characters long'});
            hashedPassword = await bcrypt.hash(password, 10);
        } else if (partyType === "google") {
            // Verify google session idToken
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const { sub, email } = ticket.getPayload();
            preUser.googleId = sub;
            preUser.email = email;
        } else if (partyType === "apple") {
            //preUser.appleId = idToken;
        } else {
            console.log("Err: Party type not google or apple");
        }
        

        const verifyEmailCode = `${Math.floor(Math.random() * 900000) + 100000}`;
        const user = new User({
            username,
            email,
            password: hashedPassword,
            verifyEmailCode, 
            ...preUser,
        });
        await user.save();

        //sendWelcomeEmail(email, username, `https://www.keypassguard.com/login/verifyemail/${user._id}/${verifyEmailCode}`);

        const jwt_token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

        //res.cookie('auth-token', jwt_token, { httpOnly: true, expires: new Date(Date.now() + /*20 * 365 * */ 24 * 60 * 60 * 1000) })
        const modifiedUser = JSON.parse(JSON.stringify(user));
        modifiedUser.password = "";
        const userInfo = {
            username: modifiedUser.username,
            email: modifiedUser.email,
            dbId: user._id,
            jsonWebToken: jwt_token,
        };
        return res.json({ status: 'success', userInfo });

    } catch(err) {
        console.error(err);
    }
});

router.post("/loginthirdparty", async (req, res) => {
    const { partyType, idToken, username, email, password} = req.body;
    let user;
    if (!partyType) {
        return res.json({status: 'error', message: "Party type not available"});
    } else if (partyType === "google") {
        // Verify google session idToken
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { sub, email } = ticket.getPayload();
        console.log("Party google, id: ", idToken);
        console.log("Party google, sub: ", sub);
        user = await User.findOne({googleId: sub})
    } else if (partyType === "apple") {
        //user = await User.findOne({appleId: idToken})
    } else {
        console.log("Err: Party type not google or apple")
    }

    if (!user) return res.json({status: "success", userFound: false});

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    if (user) return res.json({status: "success", userFound: true, jsonWebToken: token});
})

router.post('/', async (req, res) => {
    try {
        const { username, password } = req.body;
        let user;
        if (username.includes("@")) {
            user = await User.findOne({email: username.trim().toLowerCase()});
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
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

        // token to cookies if web
        if (req.body.fromWeb) {
            res.cookie('auth-token', token)
        }

        return res.json({
            status: 'success',
            message: 'User logged in successfully!',
            jsonWebToken: token,
        });
    } catch(err) {
        console.error(err);
    }
});


router.post('/logout', authToken, async (req, res) => {
    try {
        res.cookie('auth-token', '', { expires: new Date(0) }).json({ status: 'success' });
    } catch(err) {
        console.error(err);
    }
});

router.post('/changepassword', authToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const { newValue, password } = req.body;

        const checkPass = await bcrypt.compare(password, user.password);
        if (!checkPass) {
            return res.json({
                status: 'error',
                message: 'Incorrect password!',
            });
        }

        if (!validatePass(newValue)) return res.json({status: 'error', message: 'Password must be at least 8 characters long'});

        const hashedPassword = await bcrypt.hash(newValue, 10);

        user.password = hashedPassword;
        await user.save();

        res.json({
            status: 'success',
        });

    } catch(err) {
        console.error('Decryption Error:', err);
    }
});

router.post('/forgotpassword/requestcode', async (req, res) => {
    try {
        const {email} = req.body;
        
        const account = await User.findOne({email: email.trim().toLowerCase()});
        if (!account) {
            return res.json({
                status: "error",
                message: "No account with provided email",
            });
        }
        const time = Date.now();
        if (time - account.forgotPassword.lastSent < (1000 * 60)) {
            // If the time between is less than 60 seconds for cooldown
            console.log(time);
            console.log(account.forgotPassword.lastSent)
            console.log(time - account.forgotPassword.lastSent)
            console.log(1000 * 60)
            return res.json({
                status: "error",
                message: "Please wait 60 seconds between requests.",
            });
        }
        if (!account.forgotPassword) account.forgotPassword = {};
        const code = generateSixDigits()
        account.forgotPassword.code = code;
        account.forgotPassword.lastSent = time;
        account.markModified('forgotPassword');
        account.save();

        // Email the code
        console.log("Requesting email code for: " + email);
        await sendForgotPassword(email, account.username, code);

        res.json({
            status: "success",

        });

    } catch(err) {
        console.error(err);
    }
});

router.post('/forgotpassword/requestresendcode', async (req, res) => {
    try {
        const {email} = req.body;
        
        const account = await User.findOne({email: email.trim().toLowerCase()});
        if (!account) {
            return res.json({
                status: "error",
                message: "No account with provided email",
            });
        }
        const time = Date.now();
        if (time - account.forgotPassword.lastSent < (1000 * 60)) {
            // If the time between is less than 60 seconds for cooldown
            return res.json({
                status: "error",
                message: "Please wait 60 seconds between requests.",
            });
        }
        if (!account.forgotPassword) account.forgotPassword = {};
        const code = generateSixDigits()
        account.forgotPassword.code = code;
        account.forgotPassword.lastSent = time;
        account.markModified('forgotPassword');
        account.save();

        // Email the code
        console.log("Requesting email resend code for: " + email);
        await sendForgotPassword(email, account.username, code);

        res.json({
            status: "success",

        });

    } catch(err) {
        console.error(err);
    }
});

router.post('/forgotpassword/verifycode', async (req, res) => {
    try {
        const {email, code} = req.body;
        const account = await User.findOne({email: email.trim().toLowerCase()});
        if (!account) {
            return res.json({
                status: "error",
                message: "No account with provided email",
            });
        }
        const time = Date.now();
        if (time - account.forgotPassword.lastSent > (1000 * 60 * 10)) {
            // If the time is greated than 10 minutes, dont verify. Expired.
            return res.json({
                status: "error",
                message: "Your code has expired. Please send a new one and try again.",
            });
        }

        // Verify code
        if (!account.forgotPassword) return res.json({status: "error", message: "Account code info not found."});
        if (code === account.forgotPassword.code) {
            // Success
            // Extend code expiration
            account.forgotPassword.lastSent = time;
            account.markModified('forgotPassword');
            await account.save();
            return res.json({
                status: "success",

            });
        }

        res.json({
            status: "error",
            message: "Error verifying code.",
        })

        

    } catch(err) {
        console.error(err);
    }
});

router.post('/forgotpassword/resetpassword', async (req, res) => {
    try {
        const {email, code, password} = req.body;
        const account = await User.findOne({email: email.trim().toLowerCase()});
        if (!account) {
            return res.json({
                status: "error",
                message: "No account with provided email",
            });
        }
        const time = Date.now();
        if (time - account.forgotPassword.lastSent > (1000 * 60 * 10)) {
            // If the time is greated than 10 minutes, dont verify. Expired.
            return res.json({
                status: "error",
                message: "Your code has expired. Please send a new one and try again.",
            });
        }

        // Verify code
        if (!account.forgotPassword) return res.json({status: "error", message: "Account code info not found."});
        if (code === account.forgotPassword.code) {
            // Success, reset password
            if (!validatePass(password)) return res.json({status: 'error', message: 'Password must be at least 8 characters long'});
            const hashedPassword = await bcrypt.hash(password, 10);
            account.password = hashedPassword;
            await account.save();
            return res.json({
                status: "success",

            });
        }

        res.json({
            status: "error",
            message: "Error verifying code.",
        })

        

    } catch(err) {
        console.error(err);
    }
});




module.exports = router;