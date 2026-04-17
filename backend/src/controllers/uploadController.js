const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const uploadImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Image file is required' });

  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    const cloudinary = require('../config/cloudinary');
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, { folder: 'homestay-manager' });
    return res.status(201).json({ url: result.secure_url, publicId: result.public_id, storage: 'cloudinary' });
  }

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(req.file.originalname) || '.jpg';
  const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const filename = `${safeBase}${ext}`.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, req.file.buffer);

  const port = process.env.PORT || 5000;
  const base = (process.env.API_PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
  return res.status(201).json({
    url: `${base}/uploads/${filename}`,
    publicId: filename,
    storage: 'local',
  });
};

module.exports = { uploadImage };
