const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/studentController');

router.use(authenticate, authorize('student'));

router.get('/profile', ctrl.getProfile);
// allow multipart form for profile photo and signature
router.patch('/profile', upload.fields([{ name: 'profilePhoto', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), ctrl.updateProfile);
router.get('/attendance', ctrl.getAttendance);
router.get('/assignments', ctrl.getAssignments);
router.post('/assignments/:id/submit', upload.single('file'), ctrl.submitAssignment);
router.get('/notices', ctrl.getNotices);
router.get('/exam-schedule', ctrl.getExamSchedule);
router.get('/admit-card', ctrl.getAdmitCard);
router.get('/result', ctrl.getResult);
router.get('/results', ctrl.getResult);
router.post('/revaluation', ctrl.submitRevaluation);
router.get('/revaluation', ctrl.getRevaluationRequests);
router.get('/fees', ctrl.getFees);
router.post('/fees/:id/pay', ctrl.payFee);
router.get('/fees/:id/receipt', ctrl.getFeeReceipt);
router.get('/library', ctrl.getLibrary);
router.get('/class-schedule', ctrl.getClassSchedule);
router.post('/feedback', ctrl.submitFeedback);
router.get('/feedback', ctrl.getMyFeedback);

module.exports = router;
