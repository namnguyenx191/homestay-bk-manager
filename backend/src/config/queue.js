const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const hasRedis = Boolean(process.env.REDIS_URL);
const connection = hasRedis ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null }) : null;

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
