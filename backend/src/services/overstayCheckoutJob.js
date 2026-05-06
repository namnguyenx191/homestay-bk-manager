const Booking = require('../models/Booking');
const Homestay = require('../models/Homestay');
const User = require('../models/User');
const { emitGlobal, emitToUser } = require('../utils/socket');
const { sendOverstayLateEmail } = require('./notificationQueue');

const MS_PER_DAY = 86400000;

const overstayFullDaysAfterCheckout = (checkOutDate, now) => {
  const end = new Date(checkOutDate).getTime();
  const t = now.getTime();
  if (t <= end) return 0;
  return Math.ceil((t - end) / MS_PER_DAY);
};

const nightlyRoomRate = (booking, homestay) => {
  const fromHomestay = Number(homestay?.pricePerNight || 0);
  if (Number.isFinite(fromHomestay) && fromHomestay > 0) return fromHomestay;
  const cin = new Date(booking.checkInDate).getTime();
  const cout = new Date(booking.checkOutDate).getTime();
  const nights = Math.max(1, Math.ceil((cout - cin) / MS_PER_DAY));
  const roomOnly = Math.max(0, Number(booking.totalPrice || 0) - Number(booking.serviceFee || 0));
  return roomOnly / nights;
};

const emitHostOverstay = ({ hostId, bookingId, homestayId, homestayTitle, daysOver, fee }) => {
  emitGlobal('host:notification', {
    id: `overstay-${bookingId}-${Date.now()}`,
    hostId: String(hostId || ''),
    type: 'overstay_checkout',
    title: 'Trễ checkout — Late check-out',
    message: `${homestayTitle}: khách đã quá ${daysOver} ngày so với giờ trả phòng (đã thanh toán). Phí lưu trú thêm hiện tại: ${fee}. / Guest is ${daysOver} day(s) past checkout (paid). Accrued extra stay fee: ${fee}.`,
    bookingId: String(bookingId),
    homestayId: String(homestayId || ''),
    createdAt: new Date().toISOString(),
  });
};

const emitGuestOverstay = ({ userId, bookingId, homestayTitle, daysOver, fee }) => {
  emitToUser(userId, 'user:notification', {
    id: `overstay-${bookingId}-${Date.now()}`,
    type: 'overstay_checkout',
    title: 'Trễ trả phòng — Late check-out',
    message: `${homestayTitle}: bạn đã quá ${daysOver} ngày so với lịch trả phòng. Phí lưu trú thêm (ước tính): ${fee}. Liên hệ chủ nhà để check-out. / You are ${daysOver} day(s) past your checkout time. Extra stay fee (estimate): ${fee}. Please contact the host to check out.`,
    bookingId: String(bookingId),
    createdAt: new Date().toISOString(),
  });
};

const formatMoneyPlain = (n) => {
  const x = Math.round(Number(n) * 100) / 100;
  return Number.isFinite(x) ? String(x) : '0';
};

/**
 * Paid bookings still checked in after scheduled checkout: accrue per-day fee, notify host + guest (account/socket + email when possible).
 */
const runOverstayCheckoutTick = async () => {
  const now = new Date();
  const bookings = await Booking.find({
    status: 'checked_in',
    paymentStatus: 'paid',
    checkOutDate: { $lt: now },
  });

  for (const b of bookings) {
    const home = await Homestay.findById(b.homestayId).select('ownerId title pricePerNight').lean();
    if (!home) continue;

    const daysOver = overstayFullDaysAfterCheckout(b.checkOutDate, now);
    if (daysOver <= 0) continue;

    const nightly = nightlyRoomRate(b, home);
    const feeAccrued = Math.round(daysOver * nightly * 100) / 100;
    const prevNotified = Number(b.overstayDaysNotified || 0);
    const prevFee = Number(b.overstayFeeAccrued || 0);

    b.overstayFeeAccrued = feeAccrued;

    const shouldNotify = daysOver > prevNotified;
    if (!shouldNotify && feeAccrued === prevFee) {
      continue;
    }

    if (shouldNotify) {
      b.overstayDaysNotified = daysOver;

      const feeLabel = formatMoneyPlain(feeAccrued);
      const title = String(home.title || 'Homestay');

      emitHostOverstay({
        hostId: home.ownerId,
        bookingId: b._id,
        homestayId: b.homestayId,
        homestayTitle: title,
        daysOver,
        fee: feeLabel,
      });

      const guestId = b.userId;
      const isWalkInUnderHost = String(guestId) === String(home.ownerId);

      if (!isWalkInUnderHost && guestId) {
        emitGuestOverstay({
          userId: guestId,
          bookingId: b._id,
          homestayTitle: title,
          daysOver,
          fee: feeLabel,
        });

        const guestUser = await User.findById(guestId).select('email name').lean();
        if (guestUser?.email) {
          await sendOverstayLateEmail({
            to: guestUser.email,
            guestName: guestUser.name || 'Guest',
            homestayTitle: title,
            scheduledCheckOut: b.checkOutDate,
            daysOver,
            feeAccrued: feeLabel,
          });
        }
      }
    }

    await b.save();
  }
};

const startOverstayCheckoutScheduler = () => {
  const intervalMs = Math.max(60_000, Number(process.env.OVERSTAY_CHECK_MS || 15 * 60 * 1000));
  const tick = () => runOverstayCheckoutTick().catch((e) => console.error('[overstay job]', e.message));
  setTimeout(tick, 8000);
  setInterval(tick, intervalMs);
  console.log(`[overstay job] scheduler every ${Math.round(intervalMs / 1000)}s`);
};

module.exports = { runOverstayCheckoutTick, startOverstayCheckoutScheduler };
