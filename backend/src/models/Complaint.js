const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['faculty', 'student', 'subject', 'college', 'website', 'other', 'class_discipline', 'administration'],
    required: true,
  },
  // Target faculty (when reporting a faculty member)
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Target student (when reporting a student)
  targetStudent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Target subject (when reporting a subject/academic issue)
  targetSubject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    default: null,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  status: {
    type: String,
    enum: ['pending', 'in_review', 'resolved', 'rejected'],
    default: 'pending',
  },
  // Submitter role: student or faculty
  submitterRole: {
    type: String,
    enum: ['student', 'faculty'],
    default: 'student',
  },
  // Assigned handler (faculty member User ID, or null for Admin queue)
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Responsible handler role: faculty or admin
  assignedRole: {
    type: String,
    enum: ['admin', 'faculty'],
    default: 'admin',
  },
  // Explainable assignment reason
  assignmentReason: {
    type: String,
    default: '',
    trim: true,
  },
  adminResponse: {
    type: String,
    default: '',
    trim: true,
  },
  respondedAt: {
    type: Date,
    default: null,
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Submitter reference (strictly protected and hidden from default queries)
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    select: false, // Hidden by default to ensure anonymity
  },
}, { timestamps: true });

complaintSchema.index({ student: 1, createdAt: -1 });
complaintSchema.index({ category: 1, status: 1 });
complaintSchema.index({ faculty: 1 });
complaintSchema.index({ targetStudent: 1 });
complaintSchema.index({ assignedTo: 1, status: 1 });
complaintSchema.index({ assignedRole: 1, status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
