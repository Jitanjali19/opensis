const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/timetableController');
const studentCtrl = require('../controllers/studentController');

router.get('/me/student', authenticate, authorize('student'), studentCtrl.getMyTimetable);
router.get('/me/faculty', authenticate, authorize('faculty'), ctrl.getMyFacultyEntries);
router.get('/me/pdf', authenticate, authorize('student', 'faculty'), ctrl.downloadMyPdf);

router.use(authenticate, authorize('admin'));
router.get('/options', ctrl.getOptions);
router.get('/section/:sectionId', ctrl.getSectionEntries);
router.post('/', ctrl.createEntries);
router.put('/:id', ctrl.updateEntry);
router.delete('/:id', ctrl.deleteEntry);

module.exports = router;