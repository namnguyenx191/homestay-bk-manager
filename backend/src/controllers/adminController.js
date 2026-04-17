const User = require('../models/User');
const Homestay = require('../models/Homestay');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { getPaymentSettings } = require('../models/PaymentSettings');

const getStats = async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const ownerFilter = isAdmin ? {} : { ownerId: req.user._id };
  const ownedHomestays = await Homestay.find(ownerFilter).select('_id').lean();
  const ownedIds = ownedHomestays.map((h) => h._id);
  const bookingScope = isAdmin ? {} : { homestayId: { $in: ownedIds } };

  const [users, homestays, bookings, revenueAgg, pendingAgg, myTrending] = await Promise.all([
    isAdmin ? User.countDocuments() : User.countDocuments({ role: 'user' }),
    isAdmin ? Homestay.countDocuments() : Homestay.countDocuments(ownerFilter),
    Booking.countDocuments(bookingScope),
    Booking.aggregate([
      { $match: { ...bookingScope, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
    Booking.aggregate([
      { $match: { ...bookingScope, paymentStatus: 'pending', status: { $ne: 'cancelled' } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$totalPrice' } } },
    ]),
    Homestay.find(ownerFilter)
      .sort({ reviewCount: -1, rating: -1, createdAt: -1 })
      .limit(6)
      .select('title location rating reviewCount images pricePerNight')
      .lean(),
  ]);

  res.json({
    users,
    homestays,
    bookings,
    revenue: revenueAgg[0]?.total || 0,
    pendingBookings: pendingAgg[0]?.count || 0,
    pendingRevenue: pendingAgg[0]?.total || 0,
    myTrending,
  });
};

const getUsers = async (_req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json(users);
};

const deleteUserAccount = async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (target.role === 'admin') {
    return res.status(400).json({ message: 'Admin account cannot be deleted' });
  }
  if (String(target._id) === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot delete your own account' });
  }

  const owned = target.role === 'host'
    ? await Homestay.find({ ownerId: target._id }).select('_id').lean()
    : [];
  const ownedIds = owned.map((h) => h._id);

  const chatQuery = {
    $or: [{ participants: target._id }, ...(ownedIds.length ? [{ homestayId: { $in: ownedIds } }] : [])],
  };
  const chats = await Chat.find(chatQuery).select('_id').lean();
  const chatIds = chats.map((c) => c._id);

  await Promise.all([
    Booking.deleteMany({
      $or: [{ userId: target._id }, ...(ownedIds.length ? [{ homestayId: { $in: ownedIds } }] : [])],
    }),
    Review.deleteMany({
      $or: [{ userId: target._id }, ...(ownedIds.length ? [{ homestayId: { $in: ownedIds } }] : [])],
    }),
    Message.deleteMany({
      $or: [{ senderId: target._id }, ...(chatIds.length ? [{ chatId: { $in: chatIds } }] : [])],
    }),
    Chat.deleteMany(chatQuery),
    Homestay.deleteMany({ ownerId: target._id }),
    User.updateMany({}, { $pull: { wishlist: { $in: ownedIds } } }),
  ]);

  await target.deleteOne();
  return res.json({ message: 'Account deleted' });
};

const getPaymentSettingsAdmin = async (_req, res) => {
  const settings = await getPaymentSettings();
  res.json(settings);
};

/** Bookings overlapping [from, to]; summary buckets by check-in (day / week-start Monday / month) */
const getRevenueReport = async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const ownerFilter = isAdmin ? {} : { ownerId: req.user._id };
  const ownedHomestays = await Homestay.find(ownerFilter).select('_id').lean();
  const ownedIds = ownedHomestays.map((h) => h._id);

  const granularity = ['day', 'week', 'month'].includes(String(req.query.granularity))
    ? req.query.granularity
    : 'day';

  const parseYmd = (str, endOfDay) => {
    if (!str || typeof str !== 'string') return null;
    const m = str.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (endOfDay) dt.setHours(23, 59, 59, 999);
    else dt.setHours(0, 0, 0, 0);
    return dt;
  };

  let rangeEnd = parseYmd(req.query.to, true) || new Date();
  if (!req.query.to) rangeEnd.setHours(23, 59, 59, 999);

  let rangeStart = parseYmd(req.query.from, false);
  if (!rangeStart) {
    rangeStart = new Date(rangeEnd);
    rangeStart.setDate(rangeStart.getDate() - 30);
    rangeStart.setHours(0, 0, 0, 0);
  }

  if (rangeStart > rangeEnd) {
    return res.status(400).json({ message: 'Invalid date range' });
  }

  if (ownedIds.length === 0) {
    return res.json({
      granularity,
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
      summary: [],
      rows: [],
    });
  }

  const match = {
    homestayId: { $in: ownedIds },
    status: { $ne: 'cancelled' },
    checkInDate: { $lte: rangeEnd },
    checkOutDate: { $gte: rangeStart },
  };

  const bookings = await Booking.find(match)
    .populate('userId', 'name email')
    .populate('homestayId', 'title location')
    .sort({ checkInDate: 1 })
    .lean();

  const bucketKey = (checkIn) => {
    const d = new Date(checkIn);
    if (granularity === 'day') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (granularity === 'month') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const offset = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - offset);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  const summaryMap = new Map();
  for (const b of bookings) {
    const key = bucketKey(b.checkInDate);
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        periodKey: key,
        paidRevenue: 0,
        pendingAmount: 0,
        bookingCount: 0,
        paidCount: 0,
      });
    }
    const s = summaryMap.get(key);
    s.bookingCount += 1;
    if (b.paymentStatus === 'paid') {
      s.paidRevenue += Number(b.totalPrice) || 0;
      s.paidCount += 1;
    } else {
      s.pendingAmount += Number(b.totalPrice) || 0;
    }
  }

  const summary = Array.from(summaryMap.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  const rows = bookings.map((b) => ({
    homestayTitle: b.homestayId?.title || '',
    location: b.homestayId?.location || '',
    guestName: b.userId?.name || '',
    guestEmail: b.userId?.email || '',
    checkIn: new Date(b.checkInDate).toISOString(),
    checkOut: new Date(b.checkOutDate).toISOString(),
    totalPrice: b.totalPrice,
    serviceFee: b.serviceFee ?? 0,
    paymentStatus: b.paymentStatus,
    bookingStatus: b.status,
    paymentMethod: b.paymentMethod,
  }));

  res.json({
    granularity,
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
    summary,
    rows,
  });
};

const updatePaymentSettings = async (req, res) => {
  const {
    bankQrImageUrl,
    bankName,
    accountNumber,
    accountName,
    branch,
    swift,
    instructions,
  } = req.body;
  const settings = await getPaymentSettings();
  if (typeof bankQrImageUrl === 'string') settings.bankQrImageUrl = bankQrImageUrl.trim();
  if (typeof bankName === 'string') settings.bankName = bankName.trim();
  if (typeof accountNumber === 'string') settings.accountNumber = accountNumber.trim();
  if (typeof accountName === 'string') settings.accountName = accountName.trim();
  if (typeof branch === 'string') settings.branch = branch.trim();
  if (typeof swift === 'string') settings.swift = swift.trim();
  if (typeof instructions === 'string') settings.instructions = instructions.trim();
  await settings.save();
  res.json(settings);
};

module.exports = {
  getStats,
  getUsers,
  deleteUserAccount,
  getPaymentSettingsAdmin,
  getRevenueReport,
  updatePaymentSettings,
};
