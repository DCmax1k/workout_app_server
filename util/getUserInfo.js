
const getUserInfo = user => {
    return {
        _id: JSON.parse(JSON.stringify(user._id)),
        username: user.username,
        usernameDecoration: user.usernameDecoration,
        profileImg: user.profileImg,
        premium: user.premium,
    }
}

module.exports = getUserInfo;