const express = require('express');
const ExamsController = require('../controllers/exams.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
const controller = new ExamsController();

router.use(authenticate);
router.use(authorize('TEACHER'));

router.post('/', (req, res) => controller.create(req, res));
router.get('/', (req, res) => controller.list(req, res));
router.put('/:id', (req,res) => controller.update(req,res));

module.exports = router;