function generateUniqueId() {
    const timestamp = Date.now().toString(36); // base-36 timestamp
    const random = Math.random().toString(36).substring(2, 10); // random part
    return `${timestamp}-${random}`;
  }

    module.exports = generateUniqueId;