const FeedbackConfig = require('../models/FeedbackConfig');
const { normalizeSession } = require('./academicSession');

const FEEDBACK_TERMS = ['july-december', 'january-june'];

const feedbackConfigKey = (session, term) => {
  const normalizedSession = normalizeSession(session);
  const normalizedTerm = FEEDBACK_TERMS.includes(term) ? term : null;
  return normalizedSession && normalizedTerm ? `${normalizedSession}|${normalizedTerm}` : 'default';
};

const resolveFeedbackConfig = async (session, term) => {
  const key = feedbackConfigKey(session, term);
  let config = key === 'default' ? null : await FeedbackConfig.findOne({ key }).lean();
  if (!config) config = await FeedbackConfig.findOne({ key: 'default' }).lean();
  return config;
};

const isFeedbackOpen = (config) => {
  if (!config || config.isOpen === false) return false;
  const now = new Date();
  if (config.startsAt && now < new Date(config.startsAt)) return false;
  if (config.endsAt && now > new Date(config.endsAt)) return false;
  return true;
};

module.exports = { FEEDBACK_TERMS, feedbackConfigKey, resolveFeedbackConfig, isFeedbackOpen };
