const Section = require('../models/Section');
const academicConfig = require('../../../shared/academicConfig.json');

const normalize = value => String(value ?? '').trim();

function validateSelection({ department, year, sectionName }) {
  const normalizedDepartment = normalize(department);
  const normalizedYear = Number(year);
  const normalizedSection = normalize(sectionName).toUpperCase();
  if (!academicConfig.DEPARTMENTS.includes(normalizedDepartment)) return 'Invalid department';
  if (!academicConfig.YEARS.includes(normalizedYear)) return 'Invalid year';
  if (!academicConfig.SECTIONS_BY_YEAR[String(normalizedYear)]?.includes(normalizedSection)) return 'Invalid section for selected year';
  return null;
}

function validateBatches(batches) {
  if (!Array.isArray(batches)) return 'batches must be an array';
  const normalized = [...new Set(batches.map(normalize).filter(Boolean))];
  if (normalized.some(batch => batch.length > 20)) return 'Batch names must be 20 characters or fewer';
  return normalized;
}

exports.resolve = async (req, res) => {
  try {
    const department = normalize(req.body.department);
    const year = Number(req.body.year);
    const sectionName = normalize(req.body.sectionName).toUpperCase();
    const selectionError = validateSelection({ department, year, sectionName });
    if (selectionError) return res.status(400).json({ success: false, message: selectionError });

    const prefix = sectionName.charAt(0) || 'A';
    const update = { $setOnInsert: { batches: [`${prefix}1`, `${prefix}2`, `${prefix}3`] } };
    if (req.body.batches !== undefined) {
      const batches = validateBatches(req.body.batches);
      if (typeof batches === 'string') return res.status(400).json({ success: false, message: batches });
      update.$set = { batches };
    }
    const section = await Section.findOneAndUpdate(
      { department, year, sectionName },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({ success: true, data: { section } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateBatches = async (req, res) => {
  try {
    const batches = validateBatches(req.body.batches);
    if (typeof batches === 'string') return res.status(400).json({ success: false, message: batches });
    const section = await Section.findByIdAndUpdate(req.params.id, { batches }, { new: true, runValidators: true }).lean();
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    return res.json({ success: true, data: { section } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};