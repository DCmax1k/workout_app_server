const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const authToken = require("../util/authToken");

const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const User = require('../models/User');
const generateSixDigits = require('../util/generateSixDigits');
const { sendForgotPassword } = require('../util/sendEmail');
const getUserInfo = require('../util/getUserInfo');

const appleClient = jwksClient({
    jwksUri: 'https://appleid.apple.com/auth/keys'
});

function getAppleSigningKey(header, callback) {
    appleClient.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

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

const createAccount = async ({partyType, thirdPartyId, username, email, password}) => {

    const preUser={};
    let hashedPassword = "";
    if (!partyType) {
        // ORDER: Check username and email, validate username and email, hash password, set preuser
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });
        if (existingUser) {
            if (existingUser.username === username) {
                return { status: 'error', message: 'Username already taken' };
            }
            if (existingUser.email === email) {
                return { status: 'error', message: 'Email already taken' };
            }
        }
        const vUsername = validateUsername(username);
        if (vUsername !== 'success') return {status: 'error', message: vUsername};
        if (!validateEmail(email)) return {status: 'error', message: 'Please enter a valid email'};
        if (!validatePass(password)) return {status: 'error', message: 'Password must be at least 8 characters long'};
        hashedPassword = await bcrypt.hash(password, 10);
    } else if (partyType === 'google') {
        // ORDER:Check if google id exists [already verified], set preuser
        if (!email) return {status: "error", message: "error fetching email" }; 
        const checkId = await User.findOne({googleId: thirdPartyId});
        if (checkId) return { status: 'error', message: 'err: tried creating an account with google id that exists already' };
        preUser.googleId = thirdPartyId;
    } else if (partyType === 'apple') {
        // ORDER: Check if apple id exists [already verified], set preuser
        if (!email) return {status: "error", message: "error fetching email" }; 
        const checkId = await User.findOne({appleId: thirdPartyId});
        if (checkId) return { status: 'error', message: 'err: tried creating an account with apple id that exists already' };
        preUser.appleId = thirdPartyId;
    } else {
        return {status: "error", message: "error fetching partytype" }; 
    }

    // Create user
    const verifyEmailCode = `${Math.floor(Math.random() * 900000) + 100000}`;
    const user = new User({
        email,
        username: username ?? "",
        password: hashedPassword,
        verifyEmailCode, 
        ...preUser,
    });
    await user.save();

    //res.cookie('auth-token', jwt_token, { httpOnly: true, expires: new Date(Date.now() + /*20 * 365 * */ 24 * 60 * 60 * 1000) })
    const modifiedUser = JSON.parse(JSON.stringify(user));
    modifiedUser.password = "";
    // return user
    return modifiedUser;

}

router.post("/createusername", authToken, async (req, res) => {
    try {
        const {username} = req.body;
        const existingUser = await User.findOne({username});
        if (existingUser) return req.json({ status: 'error', message: 'Username already taken' });
        const vUsername = validateUsername(username);
        if (vUsername !== 'success') return {status: 'error', message: vUsername};

        const user = await User.findById(req.userId);
        user.username = username;
        await user.save();
        
        if (!user) return res.json({status: "error", message: "User not found"});
        const userInfo = getUserInfo(user);
        return res.json({status: "success", userInfo});

    } catch(err) {
        console.error(err);
    }
})

// old create account - still used only for username/email/password sign up
router.post('/createaccount', async (req, res) => {
    try {
        const { partyType, idToken, username, email, password} = req.body;

        if (!partyType) {
            const newUser = await createAccount({username, email, password});
            if (newUser.status === 'error') return res.json({status: 'error', message: newUser.message});
            //sendWelcomeEmail(email, username, `https://www.keypassguard.com/login/verifyemail/${user._id}/${verifyEmailCode}`);

            const jwt_token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET);

            const userInfo = {
                username: newUser.username,
                email: newUser.email,
                dbId: JSON.parse(JSON.stringify(newUser._id)),
                jsonWebToken: jwt_token,
            };
            
            return res.json({ status: 'success', userInfo });
        } else {
            return res.json({status: "error", message: "Please update to the next available app version."})
        }
        
        
        

    } catch(err) {
        console.error(err);
    }
});

// handles only when click thrid party button
router.post("/newloginthirdparty", async (req, res) => {
    const { partyType, idToken, email, } = req.body;

    // Verify idToken, check if user exists, if doesnt create account,
    // if user, return with user and session token,
    // else just push session token to create username

    let user = null;
    if (!partyType) {
        console.log("Err: Party type not google or apple");
    } else if (partyType === "google") {
        // Verify google session idToken
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { sub } = ticket.getPayload();
        user = await User.findOne({googleId: sub});
        if (!user) {
            user = await createAccount({partyType, thirdPartyId: sub, email });
            if (user.status === 'error') return res.json({status: "error", message: user.message});
        }
    } else if (partyType === "apple") {
        try {
            const decodedToken = await new Promise((resolve, reject) => {
                jwt.verify(
                    idToken,
                    getAppleSigningKey,
                    {
                        algorithms: ['RS256'],
                        issuer: 'https://appleid.apple.com',
                        audience: 'com.caldwell.pumpedup' 
                    },
                    (err, decoded) => {
                        if (err) return reject(err);
                        resolve(decoded);
                    }
                );
            });

            // The 'sub' is the permanent unique Apple User ID
            const sub = decodedToken.sub;
            user = await User.findOne({appleId: sub});
            if (!user) {
                user = await createAccount({partyType, thirdPartyId: sub, email });
                if (user.status === 'error') return res.json({status: "error", message: user.message});
            }
            
        } catch (error) {
            console.error("Apple Token Verification Error:", error);
            return res.json({ status: 'error', message: "Invalid Apple Token" });
        }
    } else {
        console.log("Err: Party type not google or apple");
    }

    // Session token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    return res.json({
            status: 'success',
            message: 'User logged in successfully!',
            jsonWebToken: token,
        });
})

router.post("/loginthirdparty", async (req, res) => {
    // MOVED TO /newloginthirdparty to ensure account creation for apple - only sends email first time
    return res.json({status: "error", message: "Please update to the next available app version."})

})

// login for username and password log in 
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