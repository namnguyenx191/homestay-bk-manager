const express = require('express');
const multer = require('multer');
const { uploadImage } = require('../controllers/uploadController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/image', protect, authorize('admin', 'host'), upload.single('image'), uploadImage);

module.exports = router;
