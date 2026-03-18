const { Expo } = require('expo-server-sdk');
let expo = new Expo();

const sendNotification = async (pushToken, title, messageBody, extraData='') => {
  // 1. Create the message object
  let messages = [{
    to: pushToken, // e.g., ExponentPushToken[xxx...]
    sound: 'default',
    title: title,
    body: messageBody,
    data: { someData: extraData },
  }];

  // 2. Chunk messages (Expo recommends this for multiple notifications)
  let chunks = expo.chunkPushNotifications(messages);
  
  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log(ticketChunk);
      // NOTE: Tickets only confirm Expo RECEIVED the request.
      // You should check receipts later for actual delivery status.
    } catch (error) {
      console.error(error);
    }
  }
};

module.exports = sendNotification;