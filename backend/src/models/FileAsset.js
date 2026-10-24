const mongoose = require('mongoose');

// Binary assets (photos, PDFs, spreadsheets) stored in MongoDB so they survive
// redeploys/spin-downs on hosts with an ephemeral filesystem.
const fileAssetSchema = new mongoose.Schema(
  {
    // Path of the asset relative to the /uploads directory (e.g. "1234-file.pdf").
    // Documents saved without a key are served by their MongoDB id instead.
    key: { type: String, index: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, default: 'application/octet-stream' },
    fileName: { type: String },
    size: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FileAsset', fileAssetSchema);
