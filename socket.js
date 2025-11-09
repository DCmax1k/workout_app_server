const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    io.emit("receiveMessage", "hello");

    socket.on("sendMessage", (data) => {
      io.emit("receiveMessage", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
}

module.exports = setupSocket;