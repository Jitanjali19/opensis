export const PHONE_ERROR_MESSAGE = 'Phone number must contain exactly 10 digits';

export const isValidPhone = (value) => {
  if (!value || !String(value).trim()) return true;
  return /^\d{10}$/.test(String(value).trim());
};
