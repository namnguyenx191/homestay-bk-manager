const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');
const { bootNotificationWorker } = require('./services/notificationQueue');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  bootNotificationWorker();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
