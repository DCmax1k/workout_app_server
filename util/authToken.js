const jwt = require('jsonwebtoken');

function authToken(req, res, next) {
    const token = req.body.jsonWebToken || req.cookies['auth-token'];
    if (!token) return res.json({status: "error", message: "Not logged in!"});
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.json({status: "error", message: "Auth error!"});
        req.userId = user.userId;
        next();
    });
}

module.exports = authToken;