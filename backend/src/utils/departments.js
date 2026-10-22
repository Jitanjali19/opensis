const academicConfig = require('../../../shared/academicConfig.json');

const normalizeKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/\s+/g, ' ');

const departmentLookup = new Map();
const aliasesByDepartment = new Map();

(academicConfig.DEPARTMENTS || []).forEach((value) => {
  const label = academicConfig.DEPARTMENT_LABELS?.[value] || value;
  const aliases = academicConfig.DEPARTMENT_ALIASES?.[value] || [];
  const values = Array.from(new Set([value, label, ...aliases].filter(Boolean)));
  aliasesByDepartment.set(value, values);
  values.forEach((alias) => {
    departmentLookup.set(normalizeKey(alias), value);
  });
});

const normalizeDepartment = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  return departmentLookup.get(normalized) || String(value).trim();
};

const departmentValues = (value) => {
  const canonical = normalizeDepartment(value);
  return aliasesByDepartment.get(canonical) || (canonical ? [canonical] : []);
};

const departmentLabel = (value) => {
  const canonical = normalizeDepartment(value);
  return academicConfig.DEPARTMENT_LABELS?.[canonical] || canonical || '';
};

const departmentMatches = (left, right) => {
  const leftValue = normalizeDepartment(left);
  const rightValue = normalizeDepartment(right);
  return Boolean(leftValue && rightValue && leftValue === rightValue);
};

module.exports = {
  normalizeDepartment,
  departmentValues,
  departmentLabel,
  departmentMatches,
};
