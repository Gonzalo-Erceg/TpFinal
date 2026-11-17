const ExamsService = require('../services/exams.service');

const examsService = new ExamsService();

function sendError(res, error) {
    if (!error.statusCode) {
        console.error('ERROR EN EXAMS:', error);
    }

    res.status(error.statusCode || 500).json({
        message: error.statusCode
            ? error.message
            : 'Error interno del servidor'
    });
}

class ExamsController {
    async create(req, res) {
        try {
            const exam = await examsService.create(req.body ?? {}, req.user);
            res.status(201).json(exam);
        } catch (error) {
            sendError(res, error);
        }
    }

    async list(req, res) {
        try {
            const exams = await examsService.list(req.user);
            res.status(200).json(exams);
        } catch (error) {
            sendError(res, error);
        }
    }

    async getById(req, res) {
        try {
            const exam = await examsService.getById(req.params.id, req.user);
            res.status(200).json(exam);
        } catch (error) {
            sendError(res, error);
        }
    }

    async update(req, res) {
        try {
            const exam = await examsService.update(req.params.id, req.body ?? {}, req.user);
            res.status(200).json(exam);
        } catch (error) {
            sendError(res, error);
        }
    }

    async close(req, res) {
        try {
            const result = await examsService.close(req.params.id, req.user);
            res.status(200).json(result);
        } catch (error) {
            sendError(res, error);
        }
    }

    async releaseResults(req, res) {
        try {
            const result = await examsService.releaseResults(req.params.id, req.user);
            res.status(200).json(result);
        } catch (error) {
            sendError(res, error);
        }
    }

    async listAttempts(req, res) {
        try {
            const intentos = await examsService.listAttempts(req.params.id, req.user);
            res.status(200).json(intentos);
        } catch (error) {
            sendError(res, error);
        }
    }
}

module.exports = ExamsController;
