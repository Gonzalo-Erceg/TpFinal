const StudentExamsService = require('../services/student-exams.service');

const studentExamsService = new StudentExamsService();

function sendError(res, error) {
    if (!error.statusCode) {
        console.error('ERROR EN EXÁMENES DE ALUMNO:', error);
    }

    res.status(error.statusCode || 500).json({
        message: error.statusCode
            ? error.message
            : 'Error interno del servidor'
    });
}

class StudentExamsController {

    async listAvailable(req, res) {
        try {
            const examenes = await studentExamsService.listAvailable(req.user);
            res.status(200).json(examenes);
        } catch (error) {
            sendError(res, error);
        }
    }

    async getDetail(req, res) {
        try {
            const examen = await studentExamsService.getExamDetail(req.params.id, req.user);
            res.status(200).json(examen);
        } catch (error) {
            sendError(res, error);
        }
    }

    async getAttempt(req, res) {
        try {
            const intento = await studentExamsService.getAttempt(req.params.id, req.user);
            res.status(200).json(intento);
        } catch (error) {
            sendError(res, error);
        }
    }

    async saveAnswer(req, res) {
        try {
            const respuesta = await studentExamsService.saveAnswer(
                req.params.id,
                req.params.questionId,
                req.body ?? {},
                req.user
            );

            res.status(200).json(respuesta);
        } catch (error) {
            sendError(res, error);
        }
    }

    async submitAttempt(req, res) {
        try {
            const intento = await studentExamsService.submitAttempt(req.params.id, req.user);
            res.status(200).json(intento);
        } catch (error) {
            sendError(res, error);
        }
    }

    async getResult(req, res) {
        try {
            const resultado = await studentExamsService.getResult(req.params.id, req.user);
            res.status(200).json(resultado);
        } catch (error) {
            sendError(res, error);
        }
    }
}

module.exports = StudentExamsController;
