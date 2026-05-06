const Homestay = require('../models/Homestay');
const Booking = require('../models/Booking');

const normalizeHomestayPayload = (body = {}) => {
  const parseList = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
    return [];
  };

  const parseServiceAddOns = (value) => {
    const arr = Array.isArray(value) ? value : [];
    return arr
      .map((item) => ({
        name: String(item?.name || '').trim(),
        description: String(item?.description || '').trim(),
        unit: String(item?.unit || 'item').trim() || 'item',
        price: Number(item?.price || 0),
        active: item?.active !== false,
      }))
      .filter((item) => item.name && Number.isFinite(item.price) && item.price >= 0);
  };

  return {
    ...body,
    images: body.images !== undefined ? parseList(body.images) : undefined,
    amenities: body.amenities !== undefined ? parseList(body.amenities) : undefined,
    highlights: body.highlights !== undefined ? parseList(body.highlights) : undefined,
    houseRules: body.houseRules !== undefined ? parseList(body.houseRules) : undefined,
    serviceAddOns: body.serviceAddOns !== undefined ? parseServiceAddOns(body.serviceAddOns) : undefined,
    roomSummary: body.roomSummary
      ? {
          guests: Number(body.roomSummary.guests || 2),
          bedrooms: Number(body.roomSummary.bedrooms || 1),
          beds: Number(body.roomSummary.beds || 1),
          bathrooms: Number(body.roomSummary.bathrooms || 1),
        }
      : undefined,
  };
};

const getHomestays = async (req, res) => {
  const { location, minPrice, maxPrice, rating, amenities, roomType, sort = 'newest', q, freeCancel, ownerId } = req.query;

  const query = {};
  if (location) query.location = { $regex: location, $options: 'i' };
  if (ownerId) query.ownerId = ownerId;
  if (q) {
    const rx = { $regex: q, $options: 'i' };
    query.$or = [{ title: rx }, { location: rx }, { description: rx }];
  }
  if (roomType) {
    const escaped = String(roomType).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.roomType = { $regex: escaped, $options: 'i' };
  }
  if (rating) query.rating = { $gte: Number(rating) };
  if (amenities) {
    const parts = String(amenities)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) query.amenities = { $all: parts };
  }
  if (String(freeCancel) === '1') {
    query.cancellationPolicy = { $regex: /free cancellation|miễn phí|miễn phí hủy|hủy miễn phí/i };
  }
  if (minPrice || maxPrice) {
    query.pricePerNight = {};
    if (minPrice) query.pricePerNight.$gte = Number(minPrice);
    if (maxPrice) query.pricePerNight.$lte = Number(maxPrice);
  }

  const sortMap = {
    priceAsc: { pricePerNight: 1 },
    priceDesc: { pricePerNight: -1 },
    popularity: { reviewCount: -1 },
    newest: { createdAt: -1 },
  };

  const homestays = await Homestay.find(query)
    .sort(sortMap[sort] || sortMap.newest)
    .populate('ownerId', 'name email');
  res.json(homestays);
};

const getHomestayById = async (req, res) => {
  const homestay = await Homestay.findById(req.params.id).populate('ownerId', 'name email');
  if (!homestay) return res.status(404).json({ message: 'Homestay not found' });

  res.json(homestay);
};

const createHomestay = async (req, res) => {
  const payload = { ...normalizeHomestayPayload(req.body), ownerId: req.user._id };
  const created = await Homestay.create(payload);
  res.status(201).json(created);
};

const updateHomestay = async (req, res) => {
  const homestay = await Homestay.findById(req.params.id);
  if (!homestay) return res.status(404).json({ message: 'Homestay not found' });

  if (req.user.role !== 'admin' && String(homestay.ownerId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const payload = normalizeHomestayPayload(req.body);
  Object.assign(homestay, payload);
  await homestay.save();
  return res.json(homestay);
};

const deleteHomestay = async (req, res) => {
  const homestay = await Homestay.findById(req.params.id);
  if (!homestay) return res.status(404).json({ message: 'Homestay not found' });

  await homestay.deleteOne();
  res.json({ message: 'Homestay deleted' });
};

const checkAvailability = async (req, res) => {
  const { checkInDate, checkOutDate } = req.query;
  const overlapping = await Booking.countDocuments({
    homestayId: req.params.id,
    status: { $in: ['pending', 'confirmed'] },
    $or: [
      { checkInDate: { $lt: new Date(checkOutDate) }, checkOutDate: { $gt: new Date(checkInDate) } },
    ],
  });

  res.json({ available: overlapping === 0 });
};

module.exports = {
  getHomestays,
  getHomestayById,
  createHomestay,
  updateHomestay,
  deleteHomestay,
  checkAvailability,
};
