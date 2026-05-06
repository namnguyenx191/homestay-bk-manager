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

const sendOverstayLateEmail = async ({ to, guestName, homestayTitle, scheduledCheckOut, daysOver, feeAccrued }) => {
  const subject = 'Late check-out notice — HomeStay Pro / Thông báo trễ trả phòng';
  const when = new Date(scheduledCheckOut).toLocaleString('vi-VN');
  const html = `
    <h2>Late check-out / Trễ trả phòng</h2>
    <p>Hi ${guestName},</p>
    <p>Your scheduled check-out for <strong>${homestayTitle}</strong> was <strong>${when}</strong>.</p>
    <p>You are <strong>${daysOver}</strong> day(s) past that time. An extra stay fee of <strong>${feeAccrued}</strong> (same currency as the listing) has been recorded. Please contact the host to complete check-out.</p>
    <hr />
    <p>Xin chào ${guestName},</p>
    <p>Lịch trả phòng tại <strong>${homestayTitle}</strong> là <strong>${when}</strong>.</p>
    <p>Bạn đã quá <strong>${daysOver}</strong> ngày. Phí lưu trú thêm hiện tại: <strong>${feeAccrued}</strong> (cùng đơn vị tiền với phòng). Vui lòng liên hệ chủ nhà để hoàn tất check-out.</p>
  `;

  if (notificationQueue) {
    await notificationQueue.add('overstay-late', { to, subject, html }, { attempts: 3, removeOnComplete: true });
    return;
  }

  await sendEmail({ to, subject, html });
};

const bootNotificationWorker = () => {
  if (!hasRedis) {
    console.log('Email queue disabled: REDIS_URL not set, using direct email sending.');
    return;
  }

  try {
    const w = createWorker(queueName, async (job) => {
      await sendEmail(job.data);
    });
    if (w) {
      w.on('error', (err) => console.error('[email worker]', err.message));
    }
    console.log('Email queue worker started.');
  } catch (e) {
    console.error('Email queue worker failed to start (check REDIS_URL):', e.message);
  }
};

module.exports = { sendBookingEmail, sendOverstayLateEmail, bootNotificationWorker };
