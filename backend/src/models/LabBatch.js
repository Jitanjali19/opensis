'use strict';
const mongoose = require('mongoose');

/**
 * LabBatch — stores student-to-batch mappings for a specific lab.
 *
 * Each document groups all batches for one lab in one session, stored as
 * an array of batch objects so they can be queried/updated atomically.
 *
 * Design notes:
 *  - One document per (labId + session).
 *  - batches[] contains named groups; each group has a list of studentIds.
 *  - Faculty can create batches by name (e.g. "Batch A", "Batch 1") and
 *    manually assign students or use bulk enrollment-range rules.
 */
const batchEntrySchema = new mongoose.Schema({
  batchName: { type: String, required: true, trim: true },  // e.g. "Batch A"
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
}, { _id: false });

const labBatchSchema = new mongoose.Schema({
  labId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Lab',  required: true },
  session: { type: String, required: true, trim: true },
  batches: [batchEntrySchema],
}, { timestamps: true });

labBatchSchema.index(
  { labId: 1, session: 1 },
  { unique: true, name: 'lab_batch_unique' },
);

module.exports = mongoose.model('LabBatch', labBatchSchema);
