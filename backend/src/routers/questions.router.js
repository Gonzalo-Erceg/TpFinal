const express = require('express');
const QuestionsController = require('../controllers/questions.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
const controller = new QuestionsController();

router.use(authenticate);
router.use(authorize('TEACHER'));

router.post('/', (req, res) => controller.create(req, res));
router.get('/', (req, res) => controller.list(req, res));
module.exports = router;