const mongoose = require('mongoose');

// Small binary assets (profile photos) stored in MongoDB so they survive
// redeploys/spin-downs on hosts with an ephemeral filesystem.
const fileAssetSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, default: 'application/octet-stream' },
    fileName: { type: String },
    size: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FileAsset', fileAssetSchema);
