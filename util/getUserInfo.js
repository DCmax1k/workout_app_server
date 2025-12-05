
const getUserInfo = (user, friend=false) => {
    const obj = {
        _id: JSON.parse(JSON.stringify(user._id)),
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