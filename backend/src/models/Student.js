const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  enrollmentNo: { type: String, required: true, unique: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  // DOB: Date of birth with age validation (15-100 years old)
  dob: {
    type: Date,
    validate: {
      validator: function(v) {
        if (!v) return true; // optional field
        const age = (new Date() - v) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 15 && age <= 100;
      },
      message: 'Date of birth must represent a reasonable age (15-100 years)'
    }
  },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  // Personal email with format validation
  personalEmail: {
    type: String,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  signatureUrl: { type: String },
  // Phone number is optional, but must be exactly 10 digits when provided.
  phone: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^\d{10}$/.test(String(v).trim());
      },
      message: 'Phone number must contain exactly 10 digits'
    }
  },
  address: String,
  branch: { type: String, required: true },
  currentSemester: { type: Number, required: true },
  section: String,
  // Academic year in the program (1st, 2nd, 3rd, 4th year)
  year: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        return [1, 2, 3, 4].includes(Number(v));
      },
      message: 'Please enter a valid year between 1 and 4'
    }
  },
  session: String,
  profilePhotoUrl: String,
  fatherName: String,
  motherName: String,
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
