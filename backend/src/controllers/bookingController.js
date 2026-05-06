const {
  getStripe,
  getStripeSecret,
  getStripePublishable,
  getStripeWebhookSecret,
  getStripeSecretMode,
  getStripePublishableMode,
  isStripeModeMismatch,
} = require('../lib/stripeClient');
const { createMomoPayment, isMomoConfigured } = require('../lib/momoClient');
const Booking = require('../models/Booking');
const Homestay = require('../models/Homestay');
const User = require('../models/User');
const { sendBookingEmail } = require('../services/notificationQueue');
const { getPaymentSettings } = require('../models/PaymentSettings');
const { emitGlobal } = require('../utils/socket');

const SERVICE_FEE_RATE = 0.12;
const allowDevCardFallback =
  process.env.ENABLE_DEV_CARD_FALLBACK === 'true' ||
  (process.env.ENABLE_DEV_CARD_FALLBACK !== 'false' && process.env.NODE_ENV !== 'production');
const requireLiveStripe = String(process.env.STRIPE_LIVE_MODE_REQUIRED || '').trim() === 'true';

const daysBetween = (start, end) => Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));

const normalizeSelectedAddOns = (selected = []) => {
  if (!Array.isArray(selected)) return [];
  return selected
    .map((item) => ({
      serviceName: String(item?.serviceName || '').trim(),
      quantity: Number(item?.quantity || 0),
    }))
    .filter((item) => item.serviceName && Number.isFinite(item.quantity) && item.quantity > 0);
};

const buildAddOnsBreakdown = (homestay, selected = []) => {
  const available = Array.isArray(homestay?.serviceAddOns) ? homestay.serviceAddOns : [];
  if (!available.length) return { addOns: [], addOnsTotal: 0 };

  const normalized = normalizeSelectedAddOns(selected);
  if (!normalized.length) return { addOns: [], addOnsTotal: 0 };

  const byName = new Map(
    available
      .filter((s) => s?.active !== false)
      .map((s) => [String(s.name || '').trim().toLowerCase(), s])
  );

  const addOns = normalized.map((pick) => {
    const service = byName.get(pick.serviceName.toLowerCase());
    if (!service) return null;
    const unitPrice = Number(service.price || 0);
    const totalPrice = unitPrice * pick.quantity;
    return {
      serviceName: service.name,
      unit: service.unit || 'item',
      quantity: pick.quantity,
      unitPrice,
      totalPrice,
    };
  }).filter(Boolean);

  const addOnsTotal = addOns.reduce((sum, item) => sum + item.totalPrice, 0);
  return { addOns, addOnsTotal };
};

const buildBankTransferPayload = (reference, settings = {}) => ({
  bankName: settings.bankName || process.env.BANK_NAME || 'Configure BANK_NAME in .env',
  accountNumber: settings.accountNumber || process.env.BANK_ACCOUNT_NUMBER || '—',
  accountName: settings.accountName || process.env.BANK_ACCOUNT_NAME || '—',
  branch: settings.branch || process.env.BANK_BRANCH || '',
  swift: settings.swift || process.env.BANK_SWIFT || '',
  reference,
  bankQrImageUrl: settings.bankQrImageUrl || '',
  instructions:
    settings.instructions ||
    process.env.BANK_TRANSFER_INSTRUCTIONS ||
    'Please include the transfer reference in the payment description.',
});

const getVietQrConfig = (settings = {}) => {
  const bankId = String(
    process.env.VIETQR_BANK_ID ||
    process.env.BANK_BIN ||
    ''
  ).trim();
  return {
    bankId,
    accountNumber: String(settings.accountNumber || process.env.BANK_ACCOUNT_NUMBER || '').trim(),
    accountName: String(settings.accountName || process.env.BANK_ACCOUNT_NAME || '').trim(),
    template: String(process.env.VIETQR_TEMPLATE || 'compact2').trim() || 'compact2',
  };
};

const buildVietQrImageUrl = ({ bankId, accountNumber, amount, addInfo, accountName, template }) => {
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNumber)}-${encodeURIComponent(template || 'compact2')}.png`;
  const params = new URLSearchParams();
  if (amount > 0) params.set('amount', String(Math.round(amount)));
  if (addInfo) params.set('addInfo', addInfo);
  if (accountName) params.set('accountName', accountName);
  return `${base}?${params.toString()}`;
};

const resolveVietQrAmountVnd = (baseAmount) => {
  const mode = String(process.env.BANK_TRANSFER_BASE_CURRENCY || 'USD').trim().toUpperCase();
  const amount = Math.round(Number(baseAmount || 0));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (mode === 'VND') return amount;
  const rate = Number(process.env.USD_TO_VND_RATE || 25500);
  if (!Number.isFinite(rate) || rate <= 0) return amount;
  return Math.round(amount * rate);
};

const expectedTransferAmountVnd = (amount) => resolveVietQrAmountVnd(amount);

const emitHostNotification = ({ hostId, type, title, message, bookingId, homestayId }) => {
  emitGlobal('host:notification', {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hostId: String(hostId || ''),
    type,
    title,
    message,
    bookingId: bookingId ? String(bookingId) : '',
    homestayId: homestayId ? String(homestayId) : '',
    createdAt: new Date().toISOString(),
  });
};

const getPaymentCapabilities = (_req, res) => {
  const hasSecret = Boolean(getStripeSecret());
  const hasPublishable = Boolean(getStripePublishable());
  const secretMode = getStripeSecretMode();
  const publishableMode = getStripePublishableMode();
  const stripeModeMismatch = isStripeModeMismatch();
  const devCardEnabled = allowDevCardFallback && !hasSecret;
  const stripeLiveReady =
    hasSecret &&
    hasPublishable &&
    !stripeModeMismatch &&
    (!requireLiveStripe || (secretMode === 'live' && publishableMode === 'live'));
  const vietQrAvailable = Boolean(
    String(process.env.VIETQR_BANK_ID || process.env.BANK_BIN || '').trim() &&
      String(process.env.BANK_ACCOUNT_NUMBER || '').trim()
  );
  res.json({
    cardCheckoutAvailable: (hasSecret && !stripeModeMismatch) || devCardEnabled,
    cardInlineAvailable: stripeLiveReady || devCardEnabled,
    cardMode: hasSecret ? 'stripe' : devCardEnabled ? 'dev_fallback' : 'disabled',
    stripeSecretMode: secretMode,
    stripePublishableMode: publishableMode,
    stripeModeMismatch,
    stripeLiveModeRequired: requireLiveStripe,
    stripeLiveReady,
    momoQrAvailable: isMomoConfigured(),
    vietQrAvailable,
  });
};

const createMomoQrForBooking = async (req, res) => {
  if (!isMomoConfigured()) {
    return res.status(400).json({
      message:
        'MoMo payment is not configured. Set MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_REDIRECT_URL, MOMO_IPN_URL.',
    });
  }

  const { bookingId } = req.body || {};
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const isOwner = String(booking.userId) === String(req.user?._id);
  const isAdmin = req.user?.role === 'admin';
  const isHost = req.user?.role === 'host';
  if (!isOwner && !isAdmin && !isHost) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (booking.paymentStatus === 'paid' || booking.status === 'confirmed') {
    return res.status(400).json({ message: 'Booking is already paid/confirmed' });
  }

  const amount = Math.round(Number(booking.totalPrice || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Invalid booking amount for MoMo' });
  }

  const suffix = Date.now().toString().slice(-6);
  const orderId = `HSM-${booking._id.toString().slice(-8).toUpperCase()}-${suffix}`;
  const requestId = `REQ-${booking._id.toString().slice(-8).toUpperCase()}-${suffix}`;
  const orderInfo = `Thanh toan dat phong ${booking._id.toString().slice(-8).toUpperCase()}`;
  const extraData = Buffer.from(JSON.stringify({ bookingId: String(booking._id) }), 'utf8').toString('base64');

  const momoRes = await createMomoPayment({
    amount,
    orderId,
    requestId,
    orderInfo,
    extraData,
    requestType: 'captureWallet',
    lang: 'vi',
  });

  if (Number(momoRes?.resultCode) !== 0) {
    return res.status(400).json({
      message: momoRes?.message || 'Failed to create MoMo payment QR',
      resultCode: momoRes?.resultCode,
      momo: momoRes,
    });
  }

  return res.json({
    bookingId: booking._id,
    amount,
    orderId,
    requestId,
    payUrl: momoRes.payUrl || '',
    deeplink: momoRes.deeplink || '',
    qrCodeUrl: momoRes.qrCodeUrl || '',
    resultCode: momoRes.resultCode,
    message: momoRes.message,
    momo: momoRes,
  });
};

const createVietQrForBooking = async (req, res) => {
  const { bookingId, scope: rawScope } = req.body || {};
  const scope = rawScope === 'addon' ? 'addon' : 'booking';
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const isOwner = String(booking.userId) === String(req.user?._id);
  const isAdmin = req.user?.role === 'admin';
  const isHost = req.user?.role === 'host';
  if (!isOwner && !isAdmin && !isHost) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const settings = await getPaymentSettings();
  const cfg = getVietQrConfig(settings);
  if (!cfg.bankId) {
    return res.status(400).json({
      message: 'Missing VIETQR_BANK_ID (or BANK_BIN) in backend .env',
    });
  }
  if (!cfg.accountNumber) {
    return res.status(400).json({
      message: 'Missing bank account number in payment settings or BANK_ACCOUNT_NUMBER',
    });
  }

  let amount = Math.round(Number(booking.totalPrice || 0));
  let reference = String(booking.bankTransferReference || '').trim();
  let paymentStatus = booking.paymentStatus;
  if (scope === 'addon') {
    amount = Math.round(Number(booking.addOnsTotal || 0));
    reference = String(booking.addOnBankTransferReference || '').trim();
    paymentStatus = booking.addOnPaymentStatus;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: `Invalid ${scope} amount for VietQR` });
  }
  if (!reference) {
    return res.status(400).json({ message: `Missing ${scope} transfer reference` });
  }
  if (paymentStatus === 'paid') {
    return res.status(400).json({ message: `${scope} is already paid` });
  }

  const qrCodeUrl = buildVietQrImageUrl({
    bankId: cfg.bankId,
    accountNumber: cfg.accountNumber,
    amount: resolveVietQrAmountVnd(amount),
    addInfo: reference,
    accountName: cfg.accountName,
    template: cfg.template,
  });
  const qrAmountVnd = resolveVietQrAmountVnd(amount);

  return res.json({
    bookingId: booking._id,
    scope,
    amount,
    qrAmountVnd,
    reference,
    bankId: cfg.bankId,
    accountNumber: cfg.accountNumber,
    accountName: cfg.accountName,
    qrCodeUrl,
    instructions:
      settings.instructions ||
      process.env.BANK_TRANSFER_INSTRUCTIONS ||
      'Please transfer the exact amount with the exact reference.',
  });
};

const getBankTransferInfo = async (_req, res) => {
  const settings = await getPaymentSettings();
  res.json({
    bankName: settings.bankName || process.env.BANK_NAME || '',
    accountNumber: settings.accountNumber || process.env.BANK_ACCOUNT_NUMBER || '',
    accountName: settings.accountName || process.env.BANK_ACCOUNT_NAME || '',
    branch: settings.branch || process.env.BANK_BRANCH || '',
    swift: settings.swift || process.env.BANK_SWIFT || '',
    instructions: settings.instructions || process.env.BANK_TRANSFER_INSTRUCTIONS || '',
    bankQrImageUrl: settings.bankQrImageUrl || '',
  });
};

const confirmTransferByBot = async (req, res) => {
  const token = (req.headers['x-bot-token'] || req.body?.botToken || '').toString().trim();
  const expected = (process.env.BOT_SYNC_TOKEN || '').toString().trim();
  if (!expected || token !== expected) {
    return res.status(401).json({ message: 'Unauthorized bot token' });
  }

  const rawReference = (req.body?.reference || '').toString().trim().toUpperCase();
  const amount = Number(req.body?.amount || 0);
  const hasAmount = Number.isFinite(amount) && amount > 0;

  let booking = null;
  let scope = 'booking';

  if (rawReference) {
    booking = await Booking.findOne({ bankTransferReference: rawReference });
    if (!booking) {
      booking = await Booking.findOne({ addOnBankTransferReference: rawReference });
      scope = 'addon';
    }
    if (!booking) {
      return res.status(404).json({ message: 'Reference not found' });
    }
  } else {
    if (!hasAmount) {
      return res.status(400).json({ message: 'Missing reference and amount' });
    }
    const hours = Math.max(1, Number(process.env.BOT_FALLBACK_LOOKBACK_HOURS || 48));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const pending = await Booking.find({
      paymentMethod: 'bank_transfer',
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 });
    const bookingMatches = pending.filter(
      (b) => Math.round(expectedTransferAmountVnd(b.totalPrice)) === Math.round(amount)
    );

    const addonCandidates = await Booking.find({
      addOnPaymentMethod: 'bank_transfer',
      addOnPaymentStatus: 'pending',
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 });
    const addonMatches = addonCandidates.filter(
      (b) => Math.round(expectedTransferAmountVnd(b.addOnsTotal)) === Math.round(amount)
    );

    const totalMatches = bookingMatches.length + addonMatches.length;
    if (totalMatches !== 1) {
      return res.status(409).json({
        message:
          totalMatches === 0
            ? 'No unique pending booking matched by amount'
            : 'Ambiguous amount matched multiple pending bookings',
        bookingMatches: bookingMatches.length,
        addonMatches: addonMatches.length,
      });
    }
    if (bookingMatches.length === 1) {
      booking = bookingMatches[0];
      scope = 'booking';
    } else {
      booking = addonMatches[0];
      scope = 'addon';
    }
  }

  if (scope === 'booking') {
    const expected = Math.round(expectedTransferAmountVnd(booking.totalPrice || 0));
    if (hasAmount && Math.round(amount) < expected) {
      return res.status(400).json({
        message: 'Amount is lower than booking total',
        expectedAmount: expected,
      });
    }
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    if (booking.addOnsFinalized && booking.addOnPaymentMethod === 'bank_transfer') {
      booking.addOnPaymentStatus = 'paid';
    }
    await booking.save();
    await confirmPaidBookingEmail(booking._id);
    return res.json({
      ok: true,
      scope,
      bookingId: booking._id,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
    });
  }

  const expectedAddOn = Math.round(expectedTransferAmountVnd(booking.addOnsTotal || 0));
  if (hasAmount && Math.round(amount) < expectedAddOn) {
    return res.status(400).json({
      message: 'Amount is lower than add-on total',
      expectedAmount: expectedAddOn,
    });
  }
  booking.addOnPaymentStatus = 'paid';
  await booking.save();
  return res.json({
    ok: true,
    scope,
    bookingId: booking._id,
    addOnPaymentStatus: booking.addOnPaymentStatus,
  });
};

const confirmPaidBookingEmail = async (bookingId) => {
  const booking = await Booking.findById(bookingId).populate('homestayId');
  if (!booking) return;
  const guest = await User.findById(booking.userId);
  await sendBookingEmail({
    to: guest?.email,
    guestName: guest?.name || 'Guest',
    homestayTitle: booking.homestayId?.title || 'Your stay',
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    totalPrice: booking.totalPrice,
  });
};

const createBooking = async (req, res) => {
  const {
    homestayId,
    checkInDate,
    checkOutDate,
    paymentMethod: rawMethod,
    bankTransferNote,
    cardEntryMode,
    selectedAddOns,
  } = req.body;
  const paymentMethod = rawMethod === 'bank_transfer' ? 'bank_transfer' : 'card';
  const useStripeCheckout = paymentMethod === 'card' && cardEntryMode === 'checkout';

  const homestay = await Homestay.findById(homestayId);
  if (!homestay) return res.status(404).json({ message: 'Homestay not found' });

  // If user retries the same unpaid bank-transfer booking, reuse it instead of blocking by overlap.
  if (paymentMethod === 'bank_transfer') {
    const existingPending = await Booking.findOne({
      userId: req.user._id,
      homestayId,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending',
      status: 'pending',
      checkInDate: new Date(checkInDate),
      checkOutDate: new Date(checkOutDate),
    }).sort({ createdAt: -1 });

    if (existingPending) {
      const paymentSettings = await getPaymentSettings();
      const reference =
        existingPending.bankTransferReference ||
        `HS-${existingPending._id.toString().slice(-8).toUpperCase()}`;
      if (!existingPending.bankTransferReference) {
        existingPending.bankTransferReference = reference;
        await existingPending.save();
      }
      return res.status(200).json({
        booking: existingPending,
        checkoutUrl: null,
        bankTransfer: buildBankTransferPayload(reference, paymentSettings),
        reusedPendingBooking: true,
      });
    }
  }

  const overlapping = await Booking.countDocuments({
    homestayId,
    status: { $in: ['pending', 'confirmed', 'checked_in'] },
    checkInDate: { $lt: new Date(checkOutDate) },
    checkOutDate: { $gt: new Date(checkInDate) },
  });

  if (overlapping > 0) return res.status(400).json({ message: 'Selected dates are not available' });

  const nights = daysBetween(checkInDate, checkOutDate);
  if (nights <= 0) return res.status(400).json({ message: 'Invalid date range' });

  const subtotal = nights * homestay.pricePerNight;
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
  const { addOns, addOnsTotal } = buildAddOnsBreakdown(homestay, selectedAddOns);
  const totalPrice = subtotal + serviceFee + addOnsTotal;

  const guest = await User.findById(req.user._id);
  const paymentSettings = await getPaymentSettings();

  if (paymentMethod === 'bank_transfer') {
    const booking = await Booking.create({
      userId: req.user._id,
      homestayId,
      checkInDate,
      checkOutDate,
      totalPrice,
      serviceFee,
      addOns,
      addOnsTotal,
      addOnsFinalized: addOns.length > 0,
      addOnPaymentMethod: addOns.length > 0 ? 'bank_transfer' : null,
      addOnPaymentStatus: addOns.length > 0 ? 'pending' : 'none',
      paymentMethod: 'bank_transfer',
      status: 'pending',
      paymentStatus: 'pending',
      bankTransferNote: typeof bankTransferNote === 'string' ? bankTransferNote.slice(0, 500) : '',
    });
    const reference = `HS-${booking._id.toString().slice(-8).toUpperCase()}`;
    booking.bankTransferReference = reference;
    await booking.save();

    await sendBookingEmail({
      to: guest?.email,
      guestName: guest?.name || 'Guest',
      homestayTitle: homestay.title,
      checkInDate,
      checkOutDate,
      totalPrice,
    });

    emitHostNotification({
      hostId: homestay.ownerId,
      type: 'booking_created',
      title: 'New booking request',
      message: `${guest?.name || 'Guest'} created a booking for ${homestay.title}`,
      bookingId: booking._id,
      homestayId: homestay._id,
    });

    return res.status(201).json({
      booking,
      checkoutUrl: null,
      bankTransfer: buildBankTransferPayload(reference, paymentSettings),
    });
  }

  const stripe = getStripe();
  if (isStripeModeMismatch()) {
    return res.status(400).json({
      message:
        'Stripe key mode mismatch. STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY must both be test or both be live.',
    });
  }
  if (requireLiveStripe && getStripeSecretMode() !== 'live') {
    return res.status(400).json({
      message: 'Card payment is in live-required mode. Please configure STRIPE_SECRET_KEY as sk_live_...',
    });
  }
  if (!stripe) {
    if (allowDevCardFallback) {
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      booking.stripePaymentIntentId = 'dev-fallback-card';
      await booking.save();
      await confirmPaidBookingEmail(booking._id);
      return res.status(201).json({
        booking,
        checkoutUrl: null,
        clientSecret: null,
        stripePublishableKey: null,
        bankTransfer: null,
        simulatedCardPayment: true,
      });
    }
    return res.status(400).json({
      message: 'Card payment is not configured. Set STRIPE_SECRET_KEY or choose bank transfer.',
    });
  }

  const booking = await Booking.create({
    userId: req.user._id,
    homestayId,
    checkInDate,
    checkOutDate,
    totalPrice,
    serviceFee,
    addOns,
    addOnsTotal,
    addOnsFinalized: addOns.length > 0,
    addOnPaymentMethod: addOns.length > 0 ? 'card' : null,
    addOnPaymentStatus: addOns.length > 0 ? 'pending' : 'none',
    paymentMethod: 'card',
    status: 'pending',
    paymentStatus: 'pending',
  });

  const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
  const publishableKey = getStripePublishable();

  emitHostNotification({
    hostId: homestay.ownerId,
    type: 'booking_created',
    title: 'New booking request',
    message: `${guest?.name || 'Guest'} created a booking for ${homestay.title}`,
    bookingId: booking._id,
    homestayId: homestay._id,
  });

  if (!useStripeCheckout) {
    if (!publishableKey) {
      await Booking.findByIdAndDelete(booking._id);
      return res.status(400).json({
        message: 'Inline card form requires STRIPE_PUBLISHABLE_KEY in server .env, or choose Stripe Checkout redirect.',
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId: booking._id.toString(),
        homestayId: String(homestayId),
      },
    });

    booking.stripePaymentIntentId = paymentIntent.id;
    await booking.save();

    return res.status(201).json({
      booking,
      clientSecret: paymentIntent.client_secret,
      stripePublishableKey: publishableKey,
      checkoutUrl: null,
      bankTransfer: null,
    });
  }

  const clientBase = process.env.CLIENT_URL || 'http://localhost:5174';
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    client_reference_id: booking._id.toString(),
    metadata: { bookingId: booking._id.toString(), homestayId: homestayId.toString() },
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: Math.round(totalPrice * 100),
          product_data: { name: `Booking: ${homestay.title}` },
        },
        quantity: 1,
      },
    ],
    success_url: `${clientBase}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientBase}/dashboard?payment=cancel`,
  });

  booking.stripeSessionId = session.id;
  await booking.save();

  return res.status(201).json({
    booking,
    checkoutUrl: session.url,
    clientSecret: null,
    stripePublishableKey: null,
    bankTransfer: null,
  });
};

const getUserBookings = async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id }).populate('homestayId').sort({ createdAt: -1 });
  res.json(bookings);
};

const getAdminBookings = async (_req, res) => {
  const bookings = await Booking.find()
    .populate('userId', 'name email')
    .populate('homestayId', 'title location')
    .sort({ createdAt: -1 });
  res.json(bookings);
};

/** Host PMS-style snapshot: listings as "rooms" + booking windows + simple counts */
const getHostDashboard = async (req, res) => {
  const ownerId = req.user._id;
  const homestays = await Homestay.find({ ownerId }).sort({ location: 1, title: 1 }).lean();
  const ids = homestays.map((h) => h._id);
  if (ids.length === 0) {
    return res.json({
      rooms: [],
      bookings: [],
      counts: { empty: 0, booked: 0, occupied: 0 },
    });
  }

  const now = new Date();

  const bookings = await Booking.find({
    homestayId: { $in: ids },
    status: { $ne: 'cancelled' },
  })
    .populate('userId', 'name email')
    .sort({ checkInDate: 1 })
    .lean();

  const byHs = {};
  for (const id of ids) {
    byHs[String(id)] = [];
  }
  for (const b of bookings) {
    const hid = String(b.homestayId);
    if (byHs[hid]) byHs[hid].push(b);
  }

  const rooms = homestays.map((h) => {
    const list = byHs[String(h._id)] || [];
    let activeBooking = null;
    let nextBooking = null;

    for (const b of list) {
      if (!['pending', 'confirmed', 'checked_in'].includes(b.status)) continue;
      const cin = new Date(b.checkInDate);
      const cout = new Date(b.checkOutDate);
      if (b.status === 'checked_in') {
        if (cin <= now) {
          activeBooking = b;
          break;
        }
        continue;
      }
      if (cin <= now && cout > now) {
        activeBooking = b;
        break;
      }
    }

    const afterNow = list
      .filter((b) => ['pending', 'confirmed', 'checked_in'].includes(b.status) && new Date(b.checkInDate) > now)
      .sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate));

    if (activeBooking) {
      const coutActive = new Date(activeBooking.checkOutDate);
      nextBooking = afterNow.find((b) => new Date(b.checkInDate) >= coutActive) || null;
    } else {
      nextBooking = afterNow[0] || null;
    }

    let dashboardStatus = 'empty';
    if (activeBooking) dashboardStatus = 'occupied';
    else if (nextBooking) dashboardStatus = 'booked';

    return {
      ...h,
      dashboardStatus,
      activeBooking,
      nextBooking,
    };
  });

  const counts = { empty: 0, booked: 0, occupied: 0 };

  for (const r of rooms) {
    if (r.dashboardStatus === 'empty') counts.empty += 1;
    else if (r.dashboardStatus === 'occupied') counts.occupied += 1;
    else if (r.dashboardStatus === 'booked') counts.booked += 1;
  }

  res.json({
    rooms,
    bookings,
    counts,
  });
};

const updateBookingStatus = async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const isHost = req.user?.role === 'host';
  if (isHost) {
    const home = await Homestay.findById(booking.homestayId).select('ownerId');
    if (!home || String(home.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (booking.paymentMethod !== 'bank_transfer') {
      return res.status(400).json({ message: 'Only bank transfer bookings can be confirmed here' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Booking is already marked as paid' });
    }
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
  } else {
    booking.status = req.body.status || booking.status;
    booking.paymentStatus = req.body.paymentStatus || booking.paymentStatus;
  }

  if (booking.addOnsFinalized && booking.addOnsTotal > 0 && booking.paymentStatus === 'paid') {
    booking.addOnPaymentStatus = 'paid';
  }
  await booking.save();

  res.json(booking);
};

const checkInBookingByHost = async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  if (req.user?.role === 'host') {
    const home = await Homestay.findById(booking.homestayId).select('ownerId title');
    if (!home || String(home.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  if (booking.status === 'checked_in') {
    return res.status(400).json({ message: 'Booking is already checked in' });
  }
  if (booking.status === 'checked_out') {
    return res.status(400).json({ message: 'Booking has already checked out' });
  }
  if (booking.status === 'cancelled') {
    return res.status(400).json({ message: 'Cancelled booking cannot be checked in' });
  }
  const now = new Date();
  if (new Date(booking.checkInDate) > now) {
    return res.status(400).json({ message: 'Check-in is only available on/after check-in time' });
  }
  if (new Date(booking.checkOutDate) <= now) {
    return res.status(400).json({ message: 'Cannot check in after check-out time' });
  }

  booking.status = 'checked_in';
  await booking.save();
  res.json(booking);
};

const checkOutBookingByHost = async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  if (req.user?.role === 'host') {
    const home = await Homestay.findById(booking.homestayId).select('ownerId title');
    if (!home || String(home.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  } else if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (booking.status !== 'checked_in') {
    return res.status(400).json({ message: 'Only checked-in bookings can be checked out' });
  }

  booking.status = 'checked_out';
  await booking.save();
  res.json(booking);
};

const createWalkInCheckInByHost = async (req, res) => {
  if (req.user?.role !== 'host' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { homestayId, guestName, guestPhone, checkOutDate, paymentMethod: rawPaymentMethod, paymentStatus: rawPaymentStatus } = req.body || {};
  const name = String(guestName || '').trim();
  if (!name) return res.status(400).json({ message: 'Guest name is required' });

  const homestay = await Homestay.findById(homestayId);
  if (!homestay) return res.status(404).json({ message: 'Homestay not found' });
  if (req.user?.role === 'host' && String(homestay.ownerId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const checkInDate = new Date();
  const checkOut = new Date(checkOutDate);
  if (!checkOutDate || Number.isNaN(checkOut.getTime()) || checkOut <= checkInDate) {
    return res.status(400).json({ message: 'Invalid check-out date' });
  }

  const paymentMethod = rawPaymentMethod === 'bank_transfer' ? 'bank_transfer' : rawPaymentMethod === 'cash' ? 'cash' : 'card';
  const paymentStatus = rawPaymentStatus === 'pending' ? 'pending' : 'paid';

  const overlapping = await Booking.countDocuments({
    homestayId,
    status: { $in: ['pending', 'confirmed', 'checked_in'] },
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkInDate },
  });
  if (overlapping > 0) return res.status(400).json({ message: 'Room is not available for direct check-in now' });

  const nights = Math.max(1, daysBetween(checkInDate, checkOut));
  const subtotal = nights * Number(homestay.pricePerNight || 0);
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
  const totalPrice = subtotal + serviceFee;

  const booking = await Booking.create({
    userId: req.user._id,
    homestayId,
    guestName: name,
    guestPhone: String(guestPhone || '').trim().slice(0, 50),
    checkInDate,
    checkOutDate: checkOut,
    totalPrice,
    serviceFee,
    paymentMethod,
    paymentStatus,
    status: 'checked_in',
  });

  if (paymentMethod === 'bank_transfer' && paymentStatus !== 'paid') {
    booking.bankTransferReference = `HS-${booking._id.toString().slice(-8).toUpperCase()}`;
    await booking.save();
  }

  res.status(201).json({ booking });
};

/** User abandons inline card flow: remove pending unpaid booking so dates are free again */
const cancelMyPendingBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.userId) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  if (booking.paymentStatus === 'paid' || booking.status === 'confirmed') {
    return res.status(400).json({ message: 'Cannot cancel a paid booking here' });
  }
  await booking.deleteOne();
  res.json({ message: 'Pending booking removed' });
};

const updateBookingAddOns = async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('homestayId');
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.userId) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  if (booking.status === 'cancelled') return res.status(400).json({ message: 'Cancelled booking cannot be updated' });
  if (booking.addOnsFinalized && booking.addOnPaymentStatus === 'paid') {
    return res.status(400).json({ message: 'Add-ons already finalized for this booking' });
  }

  const homestay = booking.homestayId;
  const { addOns, addOnsTotal } = buildAddOnsBreakdown(homestay, req.body?.selectedAddOns);
  const paymentMethod = req.body?.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'card';
  const useStripeCheckout = req.body?.cardEntryMode === 'checkout';
  const addOnBankTransferNote =
    paymentMethod === 'bank_transfer' && typeof req.body?.bankTransferNote === 'string'
      ? req.body.bankTransferNote.slice(0, 500)
      : '';

  booking.addOns = addOns;
  booking.addOnsTotal = addOnsTotal;
  booking.addOnsFinalized = true;
  booking.addOnPaymentMethod = addOnsTotal > 0 ? paymentMethod : null;

  if (addOnsTotal <= 0) {
    booking.addOnPaymentStatus = 'none';
    await booking.save();
    return res.json({ booking, checkoutUrl: null, bankTransfer: null });
  }

  if (paymentMethod === 'bank_transfer') {
    booking.addOnPaymentStatus = 'pending';
    booking.addOnBankTransferNote = addOnBankTransferNote;
    booking.addOnBankTransferReference = `AO-${booking._id.toString().slice(-8).toUpperCase()}`;
    await booking.save();
    if (booking.homestayId?.ownerId) {
      emitHostNotification({
        hostId: booking.homestayId.ownerId,
        type: 'addon_updated',
        title: 'Guest selected add-on services',
        message: `A guest finalized add-ons (${addOnsTotal}) for one booking`,
        bookingId: booking._id,
        homestayId: booking.homestayId._id,
      });
    }
    const paymentSettings = await getPaymentSettings();
    return res.json({
      booking,
      checkoutUrl: null,
      bankTransfer: buildBankTransferPayload(
        booking.addOnBankTransferReference,
        paymentSettings
      ),
      addOnAmount: addOnsTotal,
    });
  }

  const stripe = getStripe();
  if (isStripeModeMismatch()) {
    return res.status(400).json({
      message:
        'Stripe key mode mismatch. STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY must both be test or both be live.',
    });
  }
  if (requireLiveStripe && getStripeSecretMode() !== 'live') {
    return res.status(400).json({
      message: 'Card payment is in live-required mode. Please configure STRIPE_SECRET_KEY as sk_live_...',
    });
  }
  if (!stripe) {
    if (allowDevCardFallback) {
      booking.addOnPaymentStatus = 'paid';
      booking.addOnStripePaymentIntentId = 'dev-fallback-addon-card';
      await booking.save();
      return res.json({
        booking,
        checkoutUrl: null,
        clientSecret: null,
        stripePublishableKey: null,
        bankTransfer: null,
        addOnAmount: addOnsTotal,
        simulatedCardPayment: true,
      });
    }
    return res.status(400).json({
      message: 'Card payment is not configured. Set STRIPE_SECRET_KEY or choose bank transfer.',
    });
  }
  const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
  const publishableKey = getStripePublishable();
  if (!useStripeCheckout) {
    if (!publishableKey) {
      return res.status(400).json({
        message:
          'Inline card form requires STRIPE_PUBLISHABLE_KEY in server .env, or choose bank transfer.',
      });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(addOnsTotal * 100),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId: booking._id.toString(),
        paymentScope: 'addon',
      },
    });
    booking.addOnPaymentStatus = 'pending';
    booking.addOnStripePaymentIntentId = paymentIntent.id;
    await booking.save();
    if (booking.homestayId?.ownerId) {
      emitHostNotification({
        hostId: booking.homestayId.ownerId,
        type: 'addon_updated',
        title: 'Guest selected add-on services',
        message: `A guest finalized add-ons (${addOnsTotal}) for one booking`,
        bookingId: booking._id,
        homestayId: booking.homestayId._id,
      });
    }
    return res.json({
      booking,
      checkoutUrl: null,
      clientSecret: paymentIntent.client_secret,
      stripePublishableKey: publishableKey,
      bankTransfer: null,
      addOnAmount: addOnsTotal,
    });
  }

  const clientBase = process.env.CLIENT_URL || 'http://localhost:5174';
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    client_reference_id: booking._id.toString(),
    metadata: {
      bookingId: booking._id.toString(),
      paymentScope: 'addon',
    },
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: Math.round(addOnsTotal * 100),
          product_data: { name: `Add-ons: ${homestay?.title || 'Booking'}` },
        },
        quantity: 1,
      },
    ],
    success_url: `${clientBase}/dashboard?addonPayment=success`,
    cancel_url: `${clientBase}/dashboard?addonPayment=cancel`,
  });
  booking.addOnPaymentStatus = 'pending';
  booking.addOnStripeSessionId = session.id;
  await booking.save();
  if (booking.homestayId?.ownerId) {
    emitHostNotification({
      hostId: booking.homestayId.ownerId,
      type: 'addon_updated',
      title: 'Guest selected add-on services',
      message: `A guest finalized add-ons (${addOnsTotal}) for one booking`,
      bookingId: booking._id,
      homestayId: booking.homestayId._id,
    });
  }
  return res.json({
    booking,
    checkoutUrl: session.url,
    clientSecret: null,
    stripePublishableKey: null,
    bankTransfer: null,
    addOnAmount: addOnsTotal,
  });
};

/** Stripe webhook: Checkout session or PaymentIntent (inline card) */
const stripeWebhook = async (req, res) => {
  const stripe = getStripe();
  const whSecret = getStripeWebhookSecret();
  if (!stripe || !whSecret) {
    return res.status(400).send('Stripe webhook not configured');
  }
  if (requireLiveStripe && getStripeSecretMode() !== 'live') {
    return res.status(400).send('Stripe webhook disabled: live mode is required but server key is not live');
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId || session.client_reference_id;
    if (bookingId) {
      if (session.metadata?.paymentScope === 'addon') {
        await Booking.findByIdAndUpdate(bookingId, { addOnPaymentStatus: 'paid' });
      } else {
        await Booking.findByIdAndUpdate(bookingId, {
          paymentStatus: 'paid',
          status: 'confirmed',
          addOnPaymentStatus: 'paid',
        });
        await confirmPaidBookingEmail(bookingId);
      }
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const bookingId = pi.metadata?.bookingId;
    if (bookingId) {
      if (pi.metadata?.paymentScope === 'addon') {
        await Booking.findByIdAndUpdate(bookingId, {
          addOnPaymentStatus: 'paid',
        });
      } else {
        await Booking.findByIdAndUpdate(bookingId, {
          paymentStatus: 'paid',
          status: 'confirmed',
          addOnPaymentStatus: 'paid',
        });
        await confirmPaidBookingEmail(bookingId);
      }
    }
  }

  res.json({ received: true });
};

const momoWebhook = async (req, res) => {
  const payload = req.body || {};
  const resultCode = Number(payload.resultCode);
  if (resultCode !== 0) return res.json({ received: true });

  let bookingId = '';
  try {
    if (payload.extraData) {
      const parsed = JSON.parse(Buffer.from(String(payload.extraData), 'base64').toString('utf8'));
      bookingId = String(parsed?.bookingId || '');
    }
  } catch (_err) {
    bookingId = '';
  }

  if (!bookingId) return res.json({ received: true });

  await Booking.findByIdAndUpdate(bookingId, {
    paymentStatus: 'paid',
    status: 'confirmed',
    addOnPaymentStatus: 'paid',
  });
  await confirmPaidBookingEmail(bookingId);
  return res.json({ received: true });
};

module.exports = {
  createBooking,
  getUserBookings,
  getAdminBookings,
  getHostDashboard,
  updateBookingStatus,
  checkInBookingByHost,
  checkOutBookingByHost,
  createWalkInCheckInByHost,
  cancelMyPendingBooking,
  updateBookingAddOns,
  getBankTransferInfo,
  getPaymentCapabilities,
  createMomoQrForBooking,
  createVietQrForBooking,
  confirmTransferByBot,
  stripeWebhook,
  momoWebhook,
};
