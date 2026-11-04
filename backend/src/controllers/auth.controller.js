const AuthService = require('../services/auth.service');

const authService = new AuthService();

class AuthController {

    async register(req, res) {
        try {
            const result = await authService.register(req.body);
            res.status(201).json(result);
        } catch (error) {

            console.error('ERROR EN REGISTER:', error);
            res.status(error.statusCode || 500).json({
                message: error.statusCode
                    ? error.message
                    : 'Error interno del servidor'
            });
        }
    }

    async login(req, res) {
        try {
            const result = await authService.login(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(error.statusCode || 500).json({
                message: error.statusCode
                    ? error.message
                    : 'Error interno del servidor'
            });
        }
    }
}

module.exports = AuthController;