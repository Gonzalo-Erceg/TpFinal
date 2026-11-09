const express = require('express');
const GroupsController = require('../controllers/groups.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
const controller = new GroupsController();

router.use(authenticate);

router.get('/', (req, res) => controller.list(req, res));

router.post('/', authorize('TEACHER'), (req, res) => controller.create(req, res));

module.exports = router;