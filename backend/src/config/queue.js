const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const redisUrl = (process.env.REDIS_URL && String(process.env.REDIS_URL).trim()) || '';
const hasRedis = Boolean(redisUrl);

let connection = null;
if (hasRedis) {
  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 8000,
    retryStrategy(times) {
      if (times > 4) return null;
      return Math.min(times * 300, 3000);
    },
  });
  connection.on('error', (err) => {
    console.error('[redis]', err.code || err.message);
  });
}

const createQueue = (name) => {
  if (!connection) return null;
  return new Queue(name, { connection });
};

const createWorker = (name, handler) => {
  if (!connection) return null;
  const worker = new Worker(name, handler, { connection });
  worker.on('failed', (job, err) => {
    console.error(`Queue job failed [${name}]`, job?.id, err.message);
  });
  return worker;
};

module.exports = { createQueue, createWorker, hasRedis };
