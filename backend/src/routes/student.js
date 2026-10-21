const router = require('express').Router();
const { authenticate, authorize, currentAcademicSessionOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/studentController');

router.use(authenticate, authorize('student'));

router.get('/profile', ctrl.getProfile);
// allow multipart form for profile photo and signature
router.patch('/profile', currentAcademicSessionOnly, upload.fields([{ name: 'profilePhoto', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), ctrl.updateProfile);
router.get('/attendance', ctrl.getAttendance);
router.get('/assignments', ctrl.getAssignments);
router.post('/assignments/:id/submit', currentAcademicSessionOnly, upload.single('file'), ctrl.submitAssignment);
router.get('/notices', ctrl.getNotices);
router.post('/notices/mark-read', ctrl.markNoticesRead);
router.get('/exam-schedule', ctrl.getExamSchedule);
router.get('/admit-card', ctrl.getAdmitCard);
router.get('/result', ctrl.getResult);
router.get('/results', ctrl.getResult);
router.get('/internal-marks', ctrl.getInternalMarks);
router.post('/revaluation', currentAcademicSessionOnly, ctrl.submitRevaluation);
router.get('/revaluation', ctrl.getRevaluationRequests);
router.get('/fees', ctrl.getFees);
router.post('/fees/:id/pay', currentAcademicSessionOnly, ctrl.payFee);
router.get('/fees/:id/receipt', ctrl.getFeeReceipt);
router.get('/library', ctrl.getLibrary);
router.get('/class-schedule', ctrl.getClassSchedule);
router.get('/feedback/options', ctrl.getFeedbackOptions);
router.post('/feedback', currentAcademicSessionOnly, ctrl.submitFeedback);
router.patch('/feedback/:id', currentAcademicSessionOnly, ctrl.updateFeedback);
router.get('/feedback', ctrl.getMyFeedback);

module.exports = router;
