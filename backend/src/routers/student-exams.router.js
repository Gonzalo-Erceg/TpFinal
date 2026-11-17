const express = require('express');
const StudentExamsController = require('../controllers/student-exams.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
const controller = new StudentExamsController();

const soloAlumno = [authenticate, authorize('STUDENT')];

router.get('/available', soloAlumno, (req, res) => controller.listAvailable(req, res));
router.get('/:id/student', soloAlumno, (req, res) => controller.getDetail(req, res));

module.exports = router;
