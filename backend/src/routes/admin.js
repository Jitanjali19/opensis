const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');
const excelUpload = require('../middleware/excelUpload');
const upload = require('../middleware/upload');

router.use(authenticate);

// Allow faculty to read students (for marks upload)
router.get('/students/export', authorize('admin'), ctrl.exportStudents);
router.get('/students', authorize('admin', 'faculty'), ctrl.getStudents);
router.post('/students', authorize('admin'), ctrl.enrollStudent);
router.post('/students/bulk-upload', authorize('admin'), excelUpload.single('file'), ctrl.bulkUploadStudents);
router.get('/students/:id', authorize('admin'), ctrl.getStudent);
router.post('/students/academic-history/backfill', authorize('admin'), ctrl.backfillAcademicHistory);
router.patch('/students/:id/academic-history/:historyId', authorize('admin'), ctrl.updateAcademicHistory);
router.patch('/students/:id', authorize('admin'), ctrl.updateStudent);
router.delete('/students/:id', authorize('admin'), ctrl.deleteStudent);

router.get('/faculty/export', authorize('admin'), ctrl.exportFaculty);
router.post('/faculty', authorize('admin'), ctrl.enrollFaculty);
router.post('/faculty/bulk-upload', authorize('admin'), excelUpload.single('file'), ctrl.bulkUploadFaculty);
router.get('/faculty', authorize('admin'), ctrl.getFaculty);
router.get('/faculty/:id', authorize('admin'), ctrl.getFacultyById);
router.patch('/faculty/:id', authorize('admin'), ctrl.updateFaculty);
router.get('/faculty/:id/teaching-assignments', authorize('admin'), ctrl.getTeachingAssignments);
router.put('/faculty/:id/teaching-assignments', authorize('admin'), ctrl.replaceTeachingAssignments);
router.delete('/faculty/:id', authorize('admin'), ctrl.deleteFaculty);

router.get('/subjects/common-year1', authorize('admin'), ctrl.getCommonYearOne);
router.post('/subjects/import-common', authorize('admin'), ctrl.importCommonYearOne);
router.post('/subjects/copy', authorize('admin'), ctrl.copyScheme);
router.post('/subjects/copy-year1-all-branches', authorize('admin'), ctrl.copyYearOneToAllBranches);
router.post('/subjects', authorize('admin'), upload.single('syllabusFile'), ctrl.createSubject);
router.get('/subjects', authorize('admin'), ctrl.getSubjects);
router.get('/subjects/:id/students', authorize('admin'), ctrl.getSubjectStudents);
router.patch('/subjects/:id', authorize('admin'), upload.single('syllabusFile'), ctrl.updateSubject);
router.delete('/subjects/:id', authorize('admin'), ctrl.deleteSubject);

router.post('/labs', authorize('admin'), upload.single('syllabusFile'), ctrl.createLab);
router.get('/labs', authorize('admin'), ctrl.getLabs);
router.get('/labs/:id/students', authorize('admin'), ctrl.getLabStudents);
router.patch('/labs/:id', authorize('admin'), upload.single('syllabusFile'), ctrl.updateLab);
router.delete('/labs/:id', authorize('admin'), ctrl.deleteLab);

router.post('/notices', authorize('admin'), ctrl.createNotice);
router.get('/notices', authorize('admin'), ctrl.getNotices);
router.delete('/notices/:id', authorize('admin'), ctrl.deleteNotice);

router.post('/exam-schedule', authorize('admin'), ctrl.createExamSchedule);
router.get('/exam-schedule', authorize('admin'), ctrl.getExamSchedules);

router.post('/class-schedule', authorize('admin'), ctrl.createClassSchedule);
router.get('/class-schedule', authorize('admin'), ctrl.getClassSchedules);
router.get('/feedback', authorize('admin'), ctrl.getFeedback);
router.get('/feedback/config', authorize('admin'), ctrl.getFeedbackConfig);
router.put('/feedback/config', authorize('admin'), ctrl.updateFeedbackConfig);
router.get('/feedback/export', authorize('admin'), ctrl.exportFeedback);
router.patch('/feedback/:id/status', authorize('admin'), ctrl.updateFeedbackStatus);
router.post('/feedback/seed-demo', authorize('admin'), ctrl.seedFeedbackDemo);

router.get('/stats', authorize('admin'), ctrl.getStats);
router.get('/fees', authorize('admin'), ctrl.getFees);

router.get('/results', authorize('admin'), ctrl.getResults);
router.get('/results/submission-status', authorize('admin'), ctrl.getSubmissionStatus);
router.patch('/results/submission-status/review', authorize('admin'), ctrl.reviewSubmissionStatus);
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
