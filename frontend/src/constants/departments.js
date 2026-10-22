import academicConfig from '../../../shared/academicConfig.json';

const normalizeKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/\s+/g, ' ');

const departmentLookup = new Map();

(academicConfig.DEPARTMENTS || []).forEach((value) => {
  const label = academicConfig.DEPARTMENT_LABELS?.[value] || value;
  const aliases = academicConfig.DEPARTMENT_ALIASES?.[value] || [];
  [value, label, ...aliases].forEach((alias) => {
    departmentLookup.set(normalizeKey(alias), value);
  });
});

export const DEPARTMENT_OPTIONS = (academicConfig.DEPARTMENTS || []).map((value) => ({
  value,
  label: academicConfig.DEPARTMENT_LABELS?.[value] || value,
}));

export const getDepartmentValue = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  return departmentLookup.get(normalized) || String(value).trim();
};

export const getDepartmentLabel = (value) => {
  const canonical = getDepartmentValue(value);
  return academicConfig.DEPARTMENT_LABELS?.[canonical] || canonical || '';
};

export const departmentMatches = (left, right) => {
  const leftValue = getDepartmentValue(left);
  const rightValue = getDepartmentValue(right);
  return Boolean(leftValue && rightValue && leftValue === rightValue);
};

export default DEPARTMENT_OPTIONS;
