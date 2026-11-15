const ExamsService = require('../services/exams.service');

const examsService = new ExamsService();

class ExamsController {
    async create(req, res) {
        try {
            const exam = await examsService.create(req.body, req.user);
            res.status(201).json(exam);
        } catch (error) {
            console.error('ERROR EN EXAMS:', error);
            res.status(error.statusCode || 500).json({
                message: error.statusCode
                    ? error.message
                    : 'Error interno del servidor'
            });
        }
    }
    async list(req, res) {
        try {
            const exams = await examsService.list(req.user);
            res.status(200).json(exams);
        } catch (error) {
            console.error('ERROR EN EXAMS:', error);
            res.status(error.statusCode || 500).json({
                message: error.statusCode
                    ? error.message
                    : 'Error interno del servidor'
            });
        }
    }
}

module.exports = ExamsController;