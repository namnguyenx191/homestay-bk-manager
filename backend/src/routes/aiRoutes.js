const express = require('express');
const { postAssistant, getAiStatus } = require('../controllers/aiAssistantController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/status', protect, authorize('user', 'host', 'admin'), getAiStatus);
router.post('/assistant', protect, authorize('user', 'host', 'admin'), postAssistant);

module.exports = router;
