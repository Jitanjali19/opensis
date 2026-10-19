const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/sectionController');

router.use(authenticate, authorize('admin'));
router.post('/resolve', ctrl.resolve);
router.patch('/:id/batches', ctrl.updateBatches);

module.exports = router;