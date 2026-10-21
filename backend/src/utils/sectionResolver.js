const mongoose = require('mongoose');
const Section = require('../models/Section');

/**
 * Safely resolves a Section document and section name from a student/user profile.
 * Handles profiles where profile.section is:
 * - A populated Section document ({ _id, sectionName, department, year, ... })
 * - A MongoDB ObjectId (or hex string of ObjectId)
 * - A plain section name string (e.g. "A", "B")
 * - null / undefined
 *
 * @param {Object} profile - Student profile or object with section, branch, currentSemester/year
 * @returns {Promise<{ sectionDoc: Object|null, sectionName: string, sectionId: mongoose.Types.ObjectId|null }>}
 */
async function resolveStudentSection(profile) {
  if (!profile || !profile.section) {
    return { sectionDoc: null, sectionName: '', sectionId: null };
  }

  // 1. If profile.section is already a populated object with _id
  if (typeof profile.section === 'object' && profile.section !== null && profile.section._id) {
    const sectionName = String(profile.section.sectionName || '').trim();
    return {
      sectionDoc: profile.section,
      sectionName,
      sectionId: profile.section._id,
    };
  }

  // 2. If profile.section is a valid ObjectId (24-character hex string or ObjectId instance)
  if (mongoose.isValidObjectId(profile.section)) {
    try {
      const doc = await Section.findById(profile.section).lean();
      if (doc) {
        return {
          sectionDoc: doc,
          sectionName: String(doc.sectionName || '').trim(),
          sectionId: doc._id,
        };
      }
    } catch {
      // If error occurs during findById, fall through to name resolution
    }
  }

  // 3. If profile.section is a section name string (e.g. "A"), or doc was not found by ObjectId
  const rawSectionName = String(
    typeof profile.section === 'string'
      ? profile.section
      : (profile.section?.sectionName || '')
  ).trim();

  if (!rawSectionName) {
    return { sectionDoc: null, sectionName: '', sectionId: null };
  }

  // Determine year and department for querying Section collection
  const semester = Number(profile.currentSemester);
  const year = Number(profile.year) || (Number.isFinite(semester) && semester > 0 ? Math.ceil(semester / 2) : 1);
  const department = String(profile.branch || profile.department || '').trim();

  let query = {
    sectionName: new RegExp(`^${rawSectionName}$`, 'i'),
  };

  if (department && Number.isInteger(year) && year >= 1 && year <= 4) {
    query.department = new RegExp(`^${department}$`, 'i');
    query.year = year;
  } else if (department) {
    query.department = new RegExp(`^${department}$`, 'i');
  }

  try {
    let doc = await Section.findOne(query).lean();

    // Fallback if not matched with department/year: try just sectionName and department
    if (!doc && department && query.year) {
      doc = await Section.findOne({
        department: new RegExp(`^${department}$`, 'i'),
        sectionName: new RegExp(`^${rawSectionName}$`, 'i'),
      }).lean();
    }

    // Fallback: try just sectionName
    if (!doc) {
      doc = await Section.findOne({
        sectionName: new RegExp(`^${rawSectionName}$`, 'i'),
      }).lean();
    }

    if (doc) {
      return {
        sectionDoc: doc,
        sectionName: String(doc.sectionName || rawSectionName).trim(),
        sectionId: doc._id,
      };
    }
  } catch (err) {
    console.error('Error resolving section document by name:', err);
  }

  // Return the resolved sectionName string even if no Section document exists in database
  return {
    sectionDoc: null,
    sectionName: rawSectionName,
    sectionId: null,
  };
}

module.exports = {
  resolveStudentSection,
};
