const { createQueue, createWorker, hasRedis } = require('../config/queue');
const { sendEmail } = require('./emailService');

const queueName = 'email-notifications';
const notificationQueue = createQueue(queueName);

const sendBookingEmail = async ({ to, guestName, homestayTitle, checkInDate, checkOutDate, totalPrice }) => {
  const subject = 'Booking Confirmation - HomeStay Pro';
  const html = `
    <h2>Booking Confirmed</h2>
    <p>Hi ${guestName}, your booking is confirmed.</p>
    <p><strong>Homestay:</strong> ${homestayTitle}</p>
    <p><strong>Check-in:</strong> ${new Date(checkInDate).toLocaleDateString()}</p>
    <p><strong>Check-out:</strong> ${new Date(checkOutDate).toLocaleDateString()}</p>
    <p><strong>Total:</strong> $${totalPrice}</p>
  `;

  if (notificationQueue) {
    await notificationQueue.add('booking-confirmed', { to, subject, html }, { attempts: 3, removeOnComplete: true });
    return;
  }

  await sendEmail({ to, subject, html });
};

const bootNotificationWorker = () => {
  if (!hasRedis) {
    console.log('Email queue disabled: REDIS_URL not set, using direct email sending.');
    return;
  }

  createWorker(queueName, async (job) => {
    await sendEmail(job.data);
  });

  console.log('Email queue worker started.');
};

module.exports = { sendBookingEmail, bootNotificationWorker };
