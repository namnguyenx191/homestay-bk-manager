const express = require('express');
const { getMyChats, getChatMessages, startOrGetChat, sendMessage } = require('../controllers/chatController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', protect, authorize('user', 'host', 'admin'), getMyChats);
router.get('/:chatId/messages', protect, authorize('user', 'host', 'admin'), getChatMessages);
router.post('/start', protect, authorize('user', 'host', 'admin'), startOrGetChat);
router.post('/message', protect, authorize('user', 'host', 'admin'), sendMessage);

module.exports = router;
