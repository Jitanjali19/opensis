const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const excelUpload = require('../middleware/excelUpload');
const ctrl = require('../controllers/facultyController');

router.use(authenticate, authorize('faculty'));

router.get('/profile', ctrl.getProfile);
router.patch('/profile', upload.fields([
	{ name: 'profilePhoto', maxCount: 1 },
	{ name: 'signature', maxCount: 1 },
]), ctrl.updateProfile);
router.get('/subjects', ctrl.getSubjects);
router.post('/attendance', ctrl.markAttendance);
router.get('/attendance', ctrl.getAttendance);
router.get('/attendance/template', ctrl.downloadAttendanceTemplate);
router.post('/attendance/bulk-upload', excelUpload.single('file'), ctrl.bulkUploadAttendance);
router.get('/attendance/monthly-summary', ctrl.getMonthlyAttendanceSummary);
router.get('/attendance/monthly-export', ctrl.downloadMonthlyAttendanceReport);
router.get('/attendance/detention-export', ctrl.downloadDetentionAttendanceReport);
router.post('/attendance/monthly-notice', ctrl.publishMonthlyAttendanceNotice);
router.post('/assignments', upload.single('file'), ctrl.createAssignment);
router.get('/assignments', ctrl.getAssignments);
router.patch('/assignments/:id', upload.single('file'), ctrl.updateAssignment);
router.delete('/assignments/:id', ctrl.deleteAssignment);
router.get('/assignments/:id/submissions', ctrl.getSubmissions);
router.patch('/submissions/:id', ctrl.gradeSubmission);
router.delete('/submissions/:id', ctrl.deleteSubmission);
router.post('/marks', ctrl.updateMarks);
router.post('/marks/bulk-upload', excelUpload.single('file'), ctrl.bulkUploadMarks);
router.get('/marks/template', ctrl.downloadMarksTemplate);
router.get('/marks/export', ctrl.downloadMarksReport);
router.get('/class-students', ctrl.getClassStudents);
router.get('/marks', ctrl.getMarks);
router.get('/notices', ctrl.getNotices);

module.exports = router;

