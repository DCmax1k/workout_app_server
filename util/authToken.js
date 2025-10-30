const jwt = require('jsonwebtoken');

function authToken(req, res, next) {
    const token = req.body.jsonWebToken || req.cookies['auth-token'];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.userId = user.userId;
        next();
    });
}

module.exports = authToken;