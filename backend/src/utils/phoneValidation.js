const PHONE_ERROR_MESSAGE = 'Phone number must contain exactly 10 digits';

const isValidPhone = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return true;
  return /^\d{10}$/.test(String(value).trim());
};

module.exports = { isValidPhone, PHONE_ERROR_MESSAGE };
