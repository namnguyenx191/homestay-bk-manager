const express = require('express');
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  listInventory,
  createInventory,
  updateInventory,
  deleteInventory,
} = require('../controllers/inventoryController');

const router = express.Router();

router.use(protect, authorize('host', 'admin'));
router.get('/', listInventory);
router.post('/', createInventory);
router.put('/:id', updateInventory);
router.delete('/:id', deleteInventory);

module.exports = router;

