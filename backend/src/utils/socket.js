const { Server } = require('socket.io');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join:chat', (chatId) => {
      socket.join(chatId);
    });

    socket.on('leave:chat', (chatId) => {
      socket.leave(chatId);
    });
  });

  return io;
};

const emitToChat = (chatId, event, payload) => {
  if (!io) return;
  io.to(chatId).emit(event, payload);
};

module.exports = { initSocket, emitToChat };
