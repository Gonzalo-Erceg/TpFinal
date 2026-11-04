const express = require('express');
const AuthController = require('../controllers/auth.controller');

const router = express.Router();
const controller = new AuthController();

router.post('/register', (req, res) =>
    controller.register(req, res)
);

router.post('/login', (req, res) =>
    controller.login(req, res)
);

module.exports = router;