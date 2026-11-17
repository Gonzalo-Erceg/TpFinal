const express = require('express');
const ExamsController = require('../controllers/exams.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
const controller = new ExamsController();

router.use(authenticate);
router.use(authorize('TEACHER'));

router.post('/', (req, res) => controller.create(req, res));
router.get('/', (req, res) => controller.list(req, res));
router.get('/:id', (req, res) => controller.getById(req, res));
router.put('/:id', (req, res) => controller.update(req, res));
router.post('/:id/publish', (req, res) => controller.publish(req, res));
router.post('/:id/close', (req, res) => controller.close(req, res));
router.post('/:id/release-results', (req, res) => controller.releaseResults(req, res));
router.get('/:id/attempts', (req, res) => controller.listAttempts(req, res));
router.get('/:id/attempts/:attemptId/review', (req, res) => controller.getAttemptReview(req, res));
router.put('/:id/attempts/:attemptId/review', (req, res) => controller.saveAttemptReview(req, res));

module.exports = router;