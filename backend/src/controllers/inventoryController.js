const InventoryItem = require('../models/InventoryItem');

const ownerFilter = (req) => {
  if (req.user.role === 'admin') {
    if (req.query.ownerId) return { ownerId: req.query.ownerId };
    return {};
  }
  return { ownerId: req.user._id };
};

const listInventory = async (req, res) => {
  const items = await InventoryItem.find(ownerFilter(req)).sort({ updatedAt: -1 });
  res.json(items);
};

const createInventory = async (req, res) => {
  const payload = {
    ownerId: req.user.role === 'admin' && req.body.ownerId ? req.body.ownerId : req.user._id,
    province: String(req.body.province || 'Khác').trim() || 'Khác',
    name: String(req.body.name || '').trim(),
    sku: String(req.body.sku || '').trim(),
    unit: String(req.body.unit || 'unit').trim() || 'unit',
    quantity: Number(req.body.quantity || 0),
    minQuantity: Number(req.body.minQuantity || 0),
    note: String(req.body.note || '').trim(),
  };
  if (!payload.name) return res.status(400).json({ message: 'Item name is required' });
  const created = await InventoryItem.create(payload);
  res.status(201).json(created);
};

const updateInventory = async (req, res) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Inventory item not found' });
  if (req.user.role !== 'admin' && String(item.ownerId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (req.body.name !== undefined) item.name = String(req.body.name || '').trim();
  if (req.body.province !== undefined) item.province = String(req.body.province || 'Khác').trim() || 'Khác';
  if (req.body.sku !== undefined) item.sku = String(req.body.sku || '').trim();
  if (req.body.unit !== undefined) item.unit = String(req.body.unit || 'unit').trim() || 'unit';
  if (req.body.quantity !== undefined) item.quantity = Math.max(0, Number(req.body.quantity || 0));
  if (req.body.minQuantity !== undefined) item.minQuantity = Math.max(0, Number(req.body.minQuantity || 0));
  if (req.body.note !== undefined) item.note = String(req.body.note || '').trim();
  if (!item.name) return res.status(400).json({ message: 'Item name is required' });
  await item.save();
  res.json(item);
};

const deleteInventory = async (req, res) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Inventory item not found' });
  if (req.user.role !== 'admin' && String(item.ownerId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await item.deleteOne();
  res.json({ message: 'Inventory item deleted' });
};

module.exports = { listInventory, createInventory, updateInventory, deleteInventory };

