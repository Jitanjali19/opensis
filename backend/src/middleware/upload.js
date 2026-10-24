const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FileAsset = require('../models/FileAsset');

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

// Keep the file on disk for controllers that process it, but also store a copy in
// MongoDB so the file itself survives redeploys/spin-downs and can always be served.
const storage = {
  _handleFile(req, file, cb) {
    diskStorage._handleFile(req, file, async (err, info) => {
      if (err) return cb(err);
      try {
        const data = await fs.promises.readFile(info.path);
        await FileAsset.create({
          key: info.filename,
          data,
          contentType: file.mimetype || 'application/octet-stream',
          fileName: file.originalname,
          size: info.size,
        });
      } catch (mirrorErr) {
        // Never block an upload because the database copy failed.
        console.error('Failed to store uploaded file in MongoDB:', mirrorErr.message);
      }
      return cb(null, info);
    });
  },
  _removeFile(req, file, cb) {
    diskStorage._removeFile(req, file, cb);
  },
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|jpg|jpeg|png/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF, DOC, DOCX, JPG, JPEG, and PNG files are allowed.'));
    }
  },
});

module.exports = upload;
