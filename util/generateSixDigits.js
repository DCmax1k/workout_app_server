const generateSixDigits = () => {
    const nums = new Array(6).fill(null).map(n => {
        return Math.floor(Math.random() * 9) + 1;
    })
    return nums.join("");
}

module.exports = generateSixDigits;