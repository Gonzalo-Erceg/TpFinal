const express = require('express');
const StudentExamsController = require('../controllers/student-exams.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
const controller = new StudentExamsController();

router.use(authenticate);
router.use(authorize('STUDENT'));

router.get('/:id/result', (req, res) => controller.getResult(req, res));
router.get('/:id', (req, res) => controller.getAttempt(req, res));
router.put('/:id/answers/:questionId', (req, res) => controller.saveAnswer(req, res));
router.post('/:id/submit', (req, res) => controller.submitAttempt(req, res));

module.exports = router;
