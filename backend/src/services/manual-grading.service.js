
const ExamsRepository = require('../repositories/exams.repository');
const StudentExamsRepository = require('../repositories/student-exams.repository');
const StudentExamsService = require('./student-exams.service');
const AuthError = require('../utils/auth-error');

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS_REVISABLES = ['GRADING', 'GRADED'];

function esGuid(value) {
    return typeof value === 'string' && GUID_REGEX.test(value);
}

function aIso(value) {
    if (!value) {
        return null;
    }

    const fecha = value instanceof Date ? value : new Date(value);

    return isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

function aNumero(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const numero = Number(value);

    return Number.isFinite(numero) ? numero : null;
}

function redondear(valor) {
    return Math.round(valor * 100) / 100;
}

function aPreguntaRevision(row) {
    const pendiente = row.GradingStatus === 'MANUAL_REVIEW';
    const yaCorregidaManualmente = row.GradingStatus === 'GRADED' && row.GradingMethod === 'MANUAL';

    return {
        examVersionQuestionId: row.ExamVersionQuestionId,
        position: Number(row.Position),
        type: row.QuestionType,
        statement: row.Statement,
        points: Number(row.Points),
        responseText: row.ResponseText ?? null,
        gradingStatus: row.GradingStatus ?? null,
        awardedPoints: aNumero(row.AwardedPoints),
        gradingMethod: row.GradingMethod ?? null,
        needsReview: pendiente,
        editable: pendiente || yaCorregidaManualmente,
    };
}

function aRevision(intento, preguntas) {
    return {
        attemptId: intento.Id,
        examId: intento.ExamId,
        examTitle: intento.ExamTitle,
        studentId: intento.StudentId,
        studentName: `${intento.FirstName ?? ''} ${intento.LastName ?? ''}`.trim(),
        studentEmail: intento.Email,
        attemptNumber: Number(intento.ExamAttemptNumber),
        status: intento.Status,
        submittedAt: aIso(intento.SubmittedAt),
        totalScore: aNumero(intento.TotalScore),
        maxScore: aNumero(intento.MaxScore),
        gradedAt: aIso(intento.GradedAt),
        pendingCount: preguntas.filter((pregunta) => pregunta.needsReview).length,
        questions: preguntas,
    };
}

function validarCalificaciones(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.grades)) {
        throw new AuthError('Las calificaciones deben ser una lista');
    }

    const vistas = new Set();

    return body.grades.map((item) => {
        if (!item || typeof item !== 'object' || !esGuid(item.examVersionQuestionId)) {
            throw new AuthError('Cada calificación debe indicar una pregunta válida');
        }

        const awardedPoints = Number(item.awardedPoints);

        if (item.awardedPoints === null || item.awardedPoints === undefined || !Number.isFinite(awardedPoints)) {
            throw new AuthError('Cada calificación debe indicar los puntos obtenidos');
        }

        const questionId = item.examVersionQuestionId.toLowerCase();

        if (vistas.has(questionId)) {
            throw new AuthError('No se puede calificar dos veces la misma pregunta');
        }

        vistas.add(questionId);

        return { examVersionQuestionId: questionId, awardedPoints: redondear(awardedPoints) };
    });
}

class ManualGradingService {

    constructor() {
        this.examsRepository = new ExamsRepository();
        this.studentExamsRepository = new StudentExamsRepository();
        this.studentExamsService = new StudentExamsService();
    }

    async validarExamen(examId, user) {
        const exam = await this.examsRepository.findByIdAndTeacher(examId, user.id);

        if (!exam) {
            throw new AuthError('El examen no existe', 404);
        }

        return exam;
    }

    async asegurarCorreccion(attemptId) {
        await this.studentExamsService.gradeAttempt(attemptId);
    }

    async getReview(examId, attemptId, user) {
        if (!esGuid(examId) || !esGuid(attemptId)) {
            throw new AuthError('El intento no existe', 404);
        }

        await this.validarExamen(examId, user);

        let intento = await this.studentExamsRepository.findAttemptForReview(examId, attemptId, user.id);

        if (!intento) {
            throw new AuthError('El intento no existe', 404);
        }

        if (intento.Status === 'SUBMITTED') {
            await this.asegurarCorreccion(attemptId);
            intento = await this.studentExamsRepository.findAttemptForReview(examId, attemptId, user.id);
        }

        if (!ESTADOS_REVISABLES.includes(intento.Status)) {
            throw new AuthError('El intento todavía no está listo para revisión', 409);
        }

        const filas = await this.studentExamsRepository.findReviewQuestions(
            attemptId,
            intento.ExamVersionId
        );

        return aRevision(intento, filas.map(aPreguntaRevision));
    }

    async saveReview(examId, attemptId, body, user) {
        if (!esGuid(examId) || !esGuid(attemptId)) {
            throw new AuthError('El intento no existe', 404);
        }

        await this.validarExamen(examId, user);
        const grades = validarCalificaciones(body);

        let intento = await this.studentExamsRepository.findAttemptForReview(examId, attemptId, user.id);

        if (!intento) {
            throw new AuthError('El intento no existe', 404);
        }

        if (intento.Status === 'SUBMITTED') {
            await this.asegurarCorreccion(attemptId);
            intento = await this.studentExamsRepository.findAttemptForReview(examId, attemptId, user.id);
        }

        if (!ESTADOS_REVISABLES.includes(intento.Status)) {
            throw new AuthError('El intento no admite cambios en su estado actual', 409);
        }

        return this.studentExamsRepository.withTransaction(async (transaction) => {
            const actual = await this.studentExamsRepository.findAttemptForReview(
                examId,
                attemptId,
                user.id,
                { transaction, forUpdate: true }
            );

            if (!actual) {
                throw new AuthError('El intento no existe', 404);
            }

            if (!ESTADOS_REVISABLES.includes(actual.Status)) {
                throw new AuthError('El intento no admite cambios en su estado actual', 409);
            }

            const filas = await this.studentExamsRepository.findReviewQuestions(
                attemptId,
                actual.ExamVersionId,
                transaction
            );

            const porPregunta = new Map(
                filas.map((fila) => [String(fila.ExamVersionQuestionId).toLowerCase(), fila])
            );

            const calificaciones = grades.map((grade) => {
                const fila = porPregunta.get(grade.examVersionQuestionId);

                if (!fila) {
                    throw new AuthError('La pregunta no pertenece al intento', 404);
                }

                if (!fila.AnswerId) {
                    throw new AuthError('El alumno no respondió esa pregunta', 409);
                }

                const editable = fila.GradingStatus === 'MANUAL_REVIEW' ||
                    (fila.GradingStatus === 'GRADED' && fila.GradingMethod === 'MANUAL');

                if (!editable) {
                    throw new AuthError('Esa pregunta no admite revisión manual', 409);
                }

                if (grade.awardedPoints < 0 || grade.awardedPoints > Number(fila.Points)) {
                    throw new AuthError(
                        `Los puntos deben estar entre 0 y ${fila.Points}`,
                        400
                    );
                }

                return {
                    answerId: fila.AnswerId,
                    awardedPoints: grade.awardedPoints,
                };
            });

            if (calificaciones.length > 0) {
                await this.studentExamsRepository.saveManualGrades(
                    transaction,
                    user.id,
                    calificaciones
                );
            }

            const resultado = await this.studentExamsRepository.finalizeManualGrading(
                transaction,
                attemptId
            );

            if (!resultado) {
                throw new AuthError('El intento no admite cambios en su estado actual', 409);
            }

            return {
                attemptId,
                status: resultado.Status,
                totalScore: aNumero(resultado.TotalScore),
                maxScore: aNumero(resultado.MaxScore),
                gradedAt: aIso(resultado.GradedAt),
            };
        });
    }
}

module.exports = ManualGradingService;
