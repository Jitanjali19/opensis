const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Feedback = require('../models/Feedback');
    const legacyFeedback = await Feedback.deleteMany({
      $or: [
        { session: { $exists: false } },
        { session: null },
        { session: '' },
        { term: { $exists: false } },
        { term: null },
        { term: '' },
      ],
    });
    if (legacyFeedback.deletedCount) {
      console.log(`Removed ${legacyFeedback.deletedCount} legacy feedback record(s) without session/term`);
    }
    const feedbackIndexes = await Feedback.collection.indexes();
    if (feedbackIndexes.some(index => index.name === 'studentId_1_subjectId_1_facultyId_1_session_1')) {
      await Feedback.collection.dropIndex('studentId_1_subjectId_1_facultyId_1_session_1');
    }
    await Feedback.syncIndexes();
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
