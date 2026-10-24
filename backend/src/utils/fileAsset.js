const fs = require('fs/promises');
const FileAsset = require('../models/FileAsset');

// Store an uploaded image durably in MongoDB and return its public API path.
// The multer temp file on disk is removed afterwards (hosts like Render wipe it anyway).
const saveUploadedFile = async (file) => {
  try {
    const data = await fs.readFile(file.path);
    const asset = await FileAsset.create({
      data,
      contentType: file.mimetype,
      fileName: file.originalname,
      size: file.size,
    });
    return `/api/files/${asset._id}`;
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }
};

module.exports = { saveUploadedFile };
