const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const http = require('http');

console.log('[server] Loading app (first run can take 1-2 min on a slow disk)...');
const app = require('./app');
console.log('[server] App module loaded.');

const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');
const { bootNotificationWorker } = require('./services/notificationQueue');
const { startOverstayCheckoutScheduler } = require('./services/overstayCheckoutJob');
const { startBankMailBot } = require('./services/bankMailBot');

const PORT = process.env.PORT || 5000;

process.on('unhandledRejection', (reason, p) => {
  console.error('[server] unhandledRejection at', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err && err.stack ? err.stack : err);
});

(async () => {
  try {
    console.log('[server] Connecting to MongoDB...');
    await connectDB();
    const server = http.createServer(app);
    initSocket(server);
    bootNotificationWorker();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startOverstayCheckoutScheduler();
      startBankMailBot();
    });
  } catch (err) {
    console.error('[server] Startup failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
