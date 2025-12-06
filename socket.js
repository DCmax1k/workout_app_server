const jwt = require('jsonwebtoken');

function authToken(tkn) {
    let userID = "";
    const token = tkn;
    if (!token) return "";
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return "";
        return userID = user.userId;
    });
    return userID;
}

const setupSocket = (io) => {
  io.on("connection", (socket) => {

    socket.on("join_room", (userID) => {
        const room_userID = `u_${userID}`;
        socket.join(room_userID);
        //console.log('User joined room: ', room_userID);
    });

    socket.on("send_recent_activity", ({jsonWebToken, dbActivity}) => {
        const senderID = authToken(jsonWebToken);
        if (!senderID) return console.log("No auth");
        dbActivity.people.forEach(uID => {
            if (uID === senderID) return;
            const room_userID = `u_${uID}`;
            io.to(room_userID).emit('receive_recent_activity', dbActivity);
        });
    });

    socket.on("send_activity_react", ({jsonWebToken, activityInfo, emoji}) => {
        const senderID = authToken(jsonWebToken);
        if (!senderID) return console.log("No auth");
        activityInfo.people.forEach(uID => {
            if (uID === senderID) return;
            const room_userID = `u_${uID}`;
            io.to(room_userID).emit('receive_activity_react', {senderID, activityInfo, emoji});
        });
    });

    socket.on("send_add_user", ({jsonWebToken, person, userInfo})=> {
        const senderID = authToken(jsonWebToken);
        if (!senderID) return console.log("No auth");
        const room_userID = `u_${person._id}`;
        io.to(room_userID).emit('receive_add_user', {userInfo});
    });

    socket.on("send_unadd_user", ({jsonWebToken, person, userInfo})=> {
        const senderID = authToken(jsonWebToken);
        if (!senderID) return console.log("No auth");
        const room_userID = `u_${person._id}`;
        io.to(room_userID).emit('receive_unadd_user', {userInfo});
    });

    socket.on("send_reject_user", ({jsonWebToken, person, userInfo})=> {
        const senderID = authToken(jsonWebToken);
        if (!senderID) return console.log("No auth");
        const room_userID = `u_${person._id}`;
        io.to(room_userID).emit('receive_reject_user', {userInfo});
    });
    

    socket.on("disconnect", () => {
      //console.log("User disconnected:", socket.id);
    });
  });
}


module.exports = setupSocket;