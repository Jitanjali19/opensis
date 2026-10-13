const router = require('express').Router();
const { login, me, sessions, refresh, forgotPassword, resetPassword, register } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.get('/me', authenticate, me);
router.get('/sessions', authenticate, sessions);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
