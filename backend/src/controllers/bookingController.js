const { getStripe, getStripeSecret, getStripePublishable, getStripeWebhookSecret } = require('../lib/stripeClient');
const Booking = require('../models/Booking');
const Homestay = require('../models/Homestay');
const User = require('../models/User');
const { sendBookingEmail } = require('../services/notificationQueue');
const { getPaymentSettings } = require('../models/PaymentSettings');

const SERVICE_FEE_RATE = 0.12;
const allowDevCardFallback =
  process.env.ENABLE_DEV_CARD_FALLBACK === 'true' ||
  (process.env.ENABLE_DEV_CARD_FALLBACK !== 'false' && process.env.NODE_ENV !== 'production');

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

const getPaymentCapabilities = (_req, res) => {
  const hasSecret = Boolean(getStripeSecret());
  const hasPublishable = Boolean(getStripePublishable());
  const devCardEnabled = allowDevCardFallback && !hasSecret;
  res.json({
    cardCheckoutAvailable: hasSecret || devCardEnabled,
    cardInlineAvailable: (hasSecret && hasPublishable) || devCardEnabled,
    cardMode: hasSecret ? 'stripe' : devCardEnabled ? 'dev_fallback' : 'disabled',
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

  const overlapping = await Booking.countDocuments({
    homestayId,
    status: { $in: ['pending', 'confirmed'] },
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

    return res.status(201).json({
      booking,
      checkoutUrl: null,
      bankTransfer: buildBankTransferPayload(reference, paymentSettings),
    });
  }

  const stripe = getStripe();
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
      if (!['pending', 'confirmed'].includes(b.status)) continue;
      const cin = new Date(b.checkInDate);
      const cout = new Date(b.checkOutDate);
      if (cin <= now && cout > now) {
        activeBooking = b;
        break;
      }
    }

    const afterNow = list
      .filter((b) => ['pending', 'confirmed'].includes(b.status) && new Date(b.checkInDate) > now)
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

module.exports = {
  createBooking,
  getUserBookings,
  getAdminBookings,
  getHostDashboard,
  updateBookingStatus,
  cancelMyPendingBooking,
  updateBookingAddOns,
  getBankTransferInfo,
  getPaymentCapabilities,
  stripeWebhook,
};
