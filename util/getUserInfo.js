
const getUserInfo = (user, friend=false) => {
    const dbId = JSON.parse(JSON.stringify(user._id));
    const obj = {
        _id: dbId,
        dbId,
        username: user.username,
        usernameDecoration: user.usernameDecoration,
        profileImg: user.profileImg,
        premium: user.premium,
    }
    // If user is friend and friend allows sharing
    obj.pastWorkoutsLength = user.pastWorkouts.length;
    return obj;
}

module.exports = getUserInfo;