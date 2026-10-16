const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');
const excelUpload = require('../middleware/excelUpload');

router.use(authenticate);

// Allow faculty to read students (for marks upload)
router.get('/students/export', authorize('admin'), ctrl.exportStudents);
router.get('/students', authorize('admin', 'faculty'), ctrl.getStudents);
router.post('/students', authorize('admin'), ctrl.enrollStudent);
router.post('/students/bulk-upload', authorize('admin'), excelUpload.single('file'), ctrl.bulkUploadStudents);
router.get('/students/:id', authorize('admin'), ctrl.getStudent);
router.patch('/students/:id', authorize('admin'), ctrl.updateStudent);
router.delete('/students/:id', authorize('admin'), ctrl.deleteStudent);

router.get('/faculty/export', authorize('admin'), ctrl.exportFaculty);
router.post('/faculty', authorize('admin'), ctrl.enrollFaculty);
router.post('/faculty/bulk-upload', authorize('admin'), excelUpload.single('file'), ctrl.bulkUploadFaculty);
router.get('/faculty', authorize('admin'), ctrl.getFaculty);
router.get('/faculty/:id', authorize('admin'), ctrl.getFacultyById);
router.patch('/faculty/:id', authorize('admin'), ctrl.updateFaculty);
router.delete('/faculty/:id', authorize('admin'), ctrl.deleteFaculty);

router.post('/subjects', authorize('admin'), ctrl.createSubject);
router.get('/subjects', authorize('admin'), ctrl.getSubjects);
router.patch('/subjects/:id', authorize('admin'), ctrl.updateSubject);
router.delete('/subjects/:id', authorize('admin'), ctrl.deleteSubject);

router.post('/labs', authorize('admin'), ctrl.createLab);
router.get('/labs', authorize('admin'), ctrl.getLabs);
router.get('/labs/:id/students', authorize('admin'), ctrl.getLabStudents);
router.patch('/labs/:id', authorize('admin'), ctrl.updateLab);
router.delete('/labs/:id', authorize('admin'), ctrl.deleteLab);

router.post('/notices', authorize('admin'), ctrl.createNotice);
router.get('/notices', authorize('admin'), ctrl.getNotices);
router.delete('/notices/:id', authorize('admin'), ctrl.deleteNotice);

router.post('/exam-schedule', authorize('admin'), ctrl.createExamSchedule);
router.get('/exam-schedule', authorize('admin'), ctrl.getExamSchedules);

router.get('/stats', authorize('admin'), ctrl.getStats);
router.get('/fees', authorize('admin'), ctrl.getFees);

router.get('/results', authorize('admin'), ctrl.getResults);
router.get('/results/submission-status', authorize('admin'), ctrl.getSubmissionStatus);
router.post('/results/generate-gradesheet', authorize('admin'), ctrl.generateGradesheet);
router.post('/results/calculate-percentage', authorize('admin'), ctrl.generateGradesheet); // backward compat
router.patch('/results/publish', authorize('admin'), ctrl.publishResults);
router.get('/results/analytics', authorize('admin'), ctrl.getResultAnalytics);
router.get('/results/export', authorize('admin'), ctrl.exportGradesheet);
router.get('/revaluation-requests', authorize('admin'), ctrl.getRevaluationRequests);
router.patch('/revaluation-requests/:id', authorize('admin'), ctrl.updateRevaluationRequest);

// =============== TEMPORARY: Test Data Seed (Remove in Production) ===============
router.post('/seed-test-data', authorize('admin'), ctrl.seedTestData);

module.exports = router;
