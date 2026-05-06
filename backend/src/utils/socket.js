const { Server } = require('socket.io');

let io;

const initSocket = (httpServer) => {
  const origins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const socketCors =
    process.env.NODE_ENV === 'production'
      ? { origin: origins.length ? origins : false, credentials: true }
      : { origin: true, credentials: true };

  io = new Server(httpServer, {
    cors: socketCors,
    connectTimeout: 60000,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    socket.on('join:chat', (chatId) => {
      socket.join(chatId);
    });

    socket.on('leave:chat', (chatId) => {
      socket.leave(chatId);
    });

    socket.on('join:user', (userId) => {
      if (!userId) return;
      socket.join(`user:${String(userId)}`);
    });
  });

  return io;
};

const emitToChat = (chatId, event, payload) => {
  if (!io) return;
  io.to(chatId).emit(event, payload);
};

const emitGlobal = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
};

module.exports = { initSocket, emitToChat, emitGlobal, emitToUser };
