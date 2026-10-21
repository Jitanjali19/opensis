const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/complaintController');

router.use(authenticate);

// Complaints submission & history (Students and Faculty)
router.post('/', authorize('student', 'faculty'), ctrl.createComplaint);
router.get('/mine', authorize('student', 'faculty'), ctrl.getMyComplaints);

// Faculty assigned complaints handler routes
router.get('/assigned', authorize('faculty'), ctrl.getAssignedComplaints);
router.patch('/assigned/:id', authorize('faculty'), ctrl.updateAssignedComplaint);

// Target selector options
router.get('/faculty-options', authorize('student', 'faculty'), ctrl.getFacultyOptions);
router.get('/student-options', authorize('student', 'faculty'), ctrl.getStudentOptions);
router.get('/subject-options', authorize('student', 'faculty'), ctrl.getSubjectOptions);

module.exports = router;
