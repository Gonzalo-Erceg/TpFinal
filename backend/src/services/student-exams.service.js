const ExamAccessService = require('./exam-access.service');
const StudentExamsRepository = require('../repositories/student-exams.repository');
const AuthError = require('../utils/auth-error');
const { calificarPregunta } = require('./grading.service');

const examAccessService = new ExamAccessService();
const studentExamsRepository = new StudentExamsRepository();

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS_CON_OPCIONES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'];
const TIPOS_TEXTO = ['SHORT_TEXT', 'ESSAY'];
const ESTADOS_ENTREGADOS = ['SUBMITTED', 'GRADING', 'GRADED'];
const ERRORES_DUPLICADO = [2601, 2627];

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

function estaVencido(deadlineAt) {
    if (!deadlineAt) {
        return false;
    }

    const fecha = deadlineAt instanceof Date ? deadlineAt : new Date(deadlineAt);

    return !isNaN(fecha.getTime()) && fecha.getTime() <= Date.now();
}

function resultadosLiberados(attempt) {
    if (attempt.ResultsReleasedAt) {
        return true;
    }

    if (attempt.ResultsReleaseMode === 'ON_CLOSE') {
        return attempt.ExamStatus === 'CLOSED';
    }

    if (attempt.ResultsReleaseMode === 'IMMEDIATE') {
        return attempt.Status === 'GRADED';
    }

    return false;
}

function aDisponible(row) {
    const attemptsUsed = Number(row.AttemptsUsed ?? 0);
    const maxAttempts = row.MaxAttempts ?? null;
    const tieneDeadline = (row.DurationMinutes !== null && row.DurationMinutes !== undefined) ||
        (row.ClosesAt !== null && row.ClosesAt !== undefined);
    const tieneIntentoEnCurso = Boolean(row.HasInProgress);
    const puedeIniciar = tieneDeadline &&
        (tieneIntentoEnCurso || maxAttempts === null || attemptsUsed < maxAttempts);

    const ultimoEntregado = row.LastAttemptStatus === 'GRADED' && resultadosLiberados({
        Status: row.LastAttemptStatus,
        TotalScore: row.LastAttemptTotalScore,
        ExamStatus: row.Status,
        ResultsReleaseMode: row.ResultsReleaseMode,
        ResultsReleasedAt: row.ResultsReleasedAt,
    });

    return {
        id: row.Id,
        title: row.Title,
        description: row.Description ?? null,
        groupName: row.GroupName ?? null,
        status: row.Status,
        opensAt: aIso(row.OpensAt),
        closesAt: aIso(row.ClosesAt),
        durationMinutes: row.DurationMinutes ?? null,
        attemptsUsed,
        maxAttempts,
        hasInProgress: tieneIntentoEnCurso,
        questionCount: Number(row.QuestionCount ?? 0),
        totalPoints: Number(row.TotalPoints ?? 0),
        lastAttemptId: row.LastAttemptId ?? null,
        lastAttemptStatus: row.LastAttemptStatus ?? null,
        lastAttemptScore: ultimoEntregado ? aNumero(row.LastAttemptTotalScore) : null,
        lastAttemptMaxScore: ultimoEntregado ? aNumero(row.LastAttemptMaxScore) : null,
        resultAvailable: ultimoEntregado,
        canStart: puedeIniciar,
    };
}

function aPreguntas(rows) {
    const preguntas = new Map();

    for (const row of rows) {
        let pregunta = preguntas.get(row.ExamVersionQuestionId);

        if (!pregunta) {
            pregunta = {
                examVersionQuestionId: row.ExamVersionQuestionId,
                questionId: row.QuestionId,
                type: row.QuestionType,
                statement: row.Statement,
                position: row.Position,
                points: Number(row.Points),
                options: [],
            };

            preguntas.set(row.ExamVersionQuestionId, pregunta);
        }

        if (row.OptionId) {
            pregunta.options.push({
                id: row.OptionId,
                content: row.Content,
                position: row.OptionPosition,
            });
        }
    }

    return [...preguntas.values()];
}

function aRespuestas(rows) {
    const respuestas = new Map();

    for (const row of rows) {
        let respuesta = respuestas.get(row.ExamVersionQuestionId);

        if (!respuesta) {
            respuesta = {
                examVersionQuestionId: row.ExamVersionQuestionId,
                optionIds: [],
                text: row.ResponseText ?? null,
                answeredAt: aIso(row.AnsweredAt),
            };

            respuestas.set(row.ExamVersionQuestionId, respuesta);
        }

        if (row.OptionId) {
            respuesta.optionIds.push(row.OptionId);
        }
    }

    return [...respuestas.values()];
}

function aIntento(row, respuestas = null) {
    const liberado = resultadosLiberados(row);

    const intento = {
        attemptId: row.Id,
        examId: row.ExamId,
        examVersionId: row.ExamVersionId,
        attemptNumber: row.ExamAttemptNumber,
        status: row.Status,
        startedAt: aIso(row.StartedAt),
        deadlineAt: aIso(row.DeadlineAt),
        submittedAt: aIso(row.SubmittedAt),
        gradedAt: aIso(row.GradedAt),
        totalScore: liberado ? aNumero(row.TotalScore) : null,
        maxScore: liberado ? aNumero(row.MaxScore) : null,
        resultsReleased: liberado,
    };

    if (respuestas) {
        intento.answers = respuestas;
    }

    return intento;
}

function aRespuestaGuardada(rows, pregunta) {
    const primera = rows[0];

    return {
        examVersionQuestionId: pregunta.ExamVersionQuestionId,
        questionId: pregunta.QuestionId,
        optionIds: rows.filter((row) => row.OptionId).map((row) => row.OptionId),
        text: primera?.ResponseText ?? null,
        answeredAt: aIso(primera?.AnsweredAt),
    };
}

function normalizarRespuesta(body, tipo) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AuthError('La respuesta no es válida');
    }

    if (TIPOS_TEXTO.includes(tipo)) {
        if (typeof body.text !== 'string') {
            throw new AuthError('La respuesta debe incluir el texto');
        }

        return { text: body.text, optionIds: [] };
    }

    if (!TIPOS_CON_OPCIONES.includes(tipo)) {
        throw new AuthError('El tipo de pregunta no está soportado');
    }

    const opciones = [];

    if (body.optionId !== undefined) {
        if (typeof body.optionId !== 'string' || !esGuid(body.optionId)) {
            throw new AuthError('La opción no es válida');
        }

        opciones.push(body.optionId.toLowerCase());
    }

    if (body.optionIds !== undefined) {
        if (!Array.isArray(body.optionIds)) {
            throw new AuthError('Las opciones deben ser una lista');
        }

        for (const optionId of body.optionIds) {
            if (typeof optionId !== 'string' || !esGuid(optionId)) {
                throw new AuthError('Cada opción debe tener un id válido');
            }

            opciones.push(optionId.toLowerCase());
        }
    }

    const unicas = [...new Set(opciones)];

    if ((tipo === 'SINGLE_CHOICE' || tipo === 'TRUE_FALSE') && unicas.length !== 1) {
        throw new AuthError('Debe elegir exactamente una opción');
    }

    return { text: null, optionIds: unicas };
}

function aPreguntasParaCorregir(rows) {
    const preguntas = new Map();

    for (const row of rows) {
        let pregunta = preguntas.get(row.ExamVersionQuestionId);

        if (!pregunta) {
            pregunta = {
                examVersionQuestionId: row.ExamVersionQuestionId,
                answerId: row.AnswerId ?? null,
                answered: row.AnswerId !== null && row.AnswerId !== undefined,
                questionType: row.QuestionType,
                points: Number(row.Points),
                contentJson: row.ContentJson ?? null,
                gradingConfigJson: row.GradingConfigJson ?? null,
                responseText: row.ResponseText ?? null,
                selectedOptionIds: [],
                options: [],
            };

            preguntas.set(row.ExamVersionQuestionId, pregunta);
        }

        if (row.OptionId) {
            pregunta.selectedOptionIds.push(row.OptionId);
            pregunta.options.push({
                id: row.OptionId,
                creditFraction: Number(row.CreditFraction),
            });
        }
    }

    return [...preguntas.values()];
}

function aResultado(rows, mostrarCorrectas) {
    const preguntas = new Map();

    for (const row of rows) {
        let pregunta = preguntas.get(row.ExamVersionQuestionId);

        if (!pregunta) {
            const awardedPoints = aNumero(row.AwardedPoints) ?? 0;
            const maxPoints = Number(row.MaxPoints);

            pregunta = {
                examVersionQuestionId: row.ExamVersionQuestionId,
                position: row.Position,
                type: row.QuestionType,
                statement: row.Statement,
                awardedPoints,
                maxPoints,
                isCorrect: awardedPoints !== null && Math.abs(awardedPoints - maxPoints) < 0.000001,
                responseText: row.ResponseText ?? null,
                selectedOptionIds: [],
                correctOptionIds: [],
                options: [],
            };

            preguntas.set(row.ExamVersionQuestionId, pregunta);
        }

        if (row.OptionId) {
            const elegida = Boolean(row.Selected);

            pregunta.options.push({
                id: row.OptionId,
                content: row.OptionContent,
                position: row.OptionPosition,
                selected: elegida,
            });

            if (elegida) {
                pregunta.selectedOptionIds.push(row.OptionId);
            }

            if (mostrarCorrectas && Number(row.CreditFraction) > 0) {
                pregunta.correctOptionIds.push(row.OptionId);
            }
        }
    }

    return [...preguntas.values()];
}

class StudentExamsService {

    async listAvailable(user) {
        const filas = await examAccessService.listarExamenesDisponibles(user.id);

        return filas.map(aDisponible);
    }

    async getExamDetail(examId, user) {
        if (!esGuid(examId)) {
            throw new AuthError('El examen no existe', 404);
        }

        const acceso = await examAccessService.obtenerExamenAccesible(user.id, examId);

        if (!acceso) {
            throw new AuthError('El examen no existe o no está disponible', 404);
        }

        const intento = await studentExamsRepository.findInProgressAttempt(user.id, examId);

        if (!intento) {
            throw new AuthError('No hay un intento en curso para este examen', 409);
        }

        if (estaVencido(intento.DeadlineAt)) {
            await studentExamsRepository.expireAttempt(intento.Id);
            throw new AuthError('El intento venció y fue entregado automáticamente', 409);
        }

        const [preguntas, respuestas] = await Promise.all([
            studentExamsRepository.findQuestionsForVersion(intento.ExamVersionId),
            studentExamsRepository.findAnswers(intento.Id),
        ]);

        return {
            id: acceso.Id,
            title: acceso.Title,
            description: acceso.Description ?? null,
            durationMinutes: acceso.DurationMinutes ?? null,
            opensAt: aIso(acceso.OpensAt),
            closesAt: aIso(acceso.ClosesAt),
            attemptId: intento.Id,
            attemptStatus: intento.Status,
            deadlineAt: aIso(intento.DeadlineAt),
            attemptsUsed: Number(acceso.AttemptsUsed ?? 0),
            maxAttempts: acceso.MaxAttempts ?? null,
            questions: aPreguntas(preguntas),
            answers: aRespuestas(respuestas),
        };
    }

    async getAttempt(attemptId, user) {
        if (!esGuid(attemptId)) {
            throw new AuthError('El intento no existe', 404);
        }

        let intento = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);

        if (!intento) {
            throw new AuthError('El intento no existe', 404);
        }

        if (intento.Status === 'IN_PROGRESS' && estaVencido(intento.DeadlineAt)) {
            await studentExamsRepository.expireAttempt(attemptId);
            await this.gradeAttempt(attemptId);
            intento = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);
        } else if (intento.Status === 'SUBMITTED') {
            await this.gradeAttempt(attemptId);
            intento = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);
        }

        const respuestas = await studentExamsRepository.findAnswers(attemptId);

        return aIntento(intento, aRespuestas(respuestas));
    }

    async saveAnswer(attemptId, questionId, body, user) {
        if (!esGuid(attemptId)) {
            throw new AuthError('El intento no existe', 404);
        }

        if (!esGuid(questionId)) {
            throw new AuthError('La pregunta no existe', 404);
        }

        const intento = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);

        if (!intento) {
            throw new AuthError('El intento no existe', 404);
        }

        if (intento.Status !== 'IN_PROGRESS') {
            throw new AuthError('El intento ya no admite respuestas', 409);
        }

        if (estaVencido(intento.DeadlineAt)) {
            await studentExamsRepository.expireAttempt(attemptId);
            throw new AuthError('El intento venció y fue entregado automáticamente', 409);
        }

        const pregunta = await studentExamsRepository.findQuestionInVersion(
            intento.ExamVersionId,
            questionId
        );

        if (!pregunta) {
            throw new AuthError('La pregunta no pertenece al intento', 404);
        }

        const respuesta = normalizarRespuesta(body, pregunta.QuestionType);

        if (respuesta.optionIds.length > 0) {
            const opcionesValidas = await studentExamsRepository.findValidOptionIds(
                pregunta.QuestionRevisionId,
                respuesta.optionIds
            );

            const ids = new Set(opcionesValidas.map((id) => id.toLowerCase()));

            if (respuesta.optionIds.some((id) => !ids.has(id))) {
                throw new AuthError('Alguna opción no pertenece a la pregunta');
            }
        }

        return studentExamsRepository.withTransaction(async (transaction) => {
            const actual = await studentExamsRepository.findAttemptWithExam(attemptId, user.id, {
                transaction,
                forUpdate: true,
            });

            if (!actual) {
                throw new AuthError('El intento no existe', 404);
            }

            if (actual.Status !== 'IN_PROGRESS') {
                throw new AuthError('El intento ya no admite respuestas', 409);
            }

            if (estaVencido(actual.DeadlineAt)) {
                throw new AuthError('El intento venció y fue entregado automáticamente', 409);
            }

            const answerId = await studentExamsRepository.upsertAnswer(transaction, {
                attemptId,
                examVersionQuestionId: pregunta.ExamVersionQuestionId,
                displayOrder: pregunta.Position,
                responseText: respuesta.text,
            });

            await studentExamsRepository.replaceAnswerOptions(
                transaction,
                answerId,
                respuesta.optionIds
            );

            const filas = await studentExamsRepository.findAnswer(
                attemptId,
                pregunta.ExamVersionQuestionId,
                transaction
            );

            return aRespuestaGuardada(filas, pregunta);
        });
    }

    async submitAttempt(attemptId, user) {
        if (!esGuid(attemptId)) {
            throw new AuthError('El intento no existe', 404);
        }

        const intento = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);

        if (!intento) {
            throw new AuthError('El intento no existe', 404);
        }

        if (intento.Status === 'IN_PROGRESS') {
            const actualizado = await studentExamsRepository.submitAttempt(attemptId, user.id);

            if (!actualizado) {
                const actual = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);

                if (!actual || !ESTADOS_ENTREGADOS.includes(actual.Status)) {
                    throw new AuthError('No se pudo entregar el intento', 409);
                }
            }
        } else if (!ESTADOS_ENTREGADOS.includes(intento.Status)) {
            throw new AuthError('El intento no se puede entregar en su estado actual', 409);
        }

        await this.gradeAttempt(attemptId);

        const actual = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);

        if (!actual) {
            throw new AuthError('El intento no existe', 404);
        }

        return {
            attemptId: actual.Id,
            status: actual.Status,
            submittedAt: aIso(actual.SubmittedAt),
            resultAvailable: actual.Status === 'GRADED' && resultadosLiberados(actual),
        };
    }

    async gradeAttempt(attemptId) {
        return studentExamsRepository.withTransaction(async (transaction) => {
            const intento = await studentExamsRepository.findAttemptForGrading(attemptId, transaction);

            if (!intento) {
                return null;
            }

            if (intento.Status !== 'SUBMITTED') {
                return {
                    status: intento.Status,
                    totalScore: aNumero(intento.TotalScore),
                    maxScore: aNumero(intento.MaxScore),
                };
            }

            const filas = await studentExamsRepository.findGradingQuestions(
                attemptId,
                intento.ExamVersionId,
                transaction
            );

            const preguntas = aPreguntasParaCorregir(filas);

            let totalScore = 0;
            let maxScore = 0;
            let requiereRevision = false;

            const calificaciones = preguntas.map((pregunta) => {
                const calificacion = calificarPregunta(pregunta);

                maxScore += pregunta.points;

                if (calificacion.awardedPoints !== null) {
                    totalScore += calificacion.awardedPoints;
                }

                if (calificacion.gradingStatus === 'MANUAL_REVIEW') {
                    requiereRevision = true;
                }

                return {
                    answerId: pregunta.answerId,
                    gradingStatus: calificacion.gradingStatus,
                    awardedPoints: calificacion.awardedPoints,
                };
            });

            totalScore = Math.round(totalScore * 100) / 100;
            maxScore = Math.round(maxScore * 100) / 100;

            const status = requiereRevision ? 'GRADING' : 'GRADED';

            await studentExamsRepository.replaceGrades(transaction, attemptId, calificaciones);

            const actualizado = await studentExamsRepository.completeGrading(transaction, attemptId, {
                status,
                totalScore,
                maxScore,
            });

            return {
                status: actualizado?.Status ?? status,
                totalScore: aNumero(actualizado?.TotalScore ?? totalScore),
                maxScore: aNumero(actualizado?.MaxScore ?? maxScore),
            };
        });
    }

    async getResult(attemptId, user) {
        if (!esGuid(attemptId)) {
            throw new AuthError('El intento no existe', 404);
        }

        let intento = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);

        if (!intento) {
            throw new AuthError('El intento no existe', 404);
        }

        if (intento.Status === 'IN_PROGRESS' && estaVencido(intento.DeadlineAt)) {
            await studentExamsRepository.expireAttempt(attemptId);
            intento = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);
        }

        if (intento.Status === 'IN_PROGRESS') {
            throw new AuthError('El intento todavía no fue entregado', 409);
        }

        if (intento.Status === 'SUBMITTED') {
            await this.gradeAttempt(attemptId);
            intento = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);
        }

        if (intento.Status === 'GRADING') {
            throw new AuthError('La corrección todavía está pendiente', 409);
        }

        if (intento.Status !== 'GRADED') {
            throw new AuthError('El intento todavía no está corregido', 409);
        }

        if (!resultadosLiberados(intento)) {
            throw new AuthError('Los resultados todavía no están disponibles', 409);
        }

        const filas = await studentExamsRepository.findResultRows(attemptId, intento.ExamVersionId);
        const mostrarCorrectas = Boolean(intento.ShowCorrectAnswers);

        const totalScore = aNumero(intento.TotalScore);
        const maxScore = aNumero(intento.MaxScore);
        const percentage = totalScore !== null && maxScore !== null && maxScore > 0
            ? Math.round((totalScore / maxScore) * 10000) / 100
            : null;

        return {
            attemptId: intento.Id,
            examId: intento.ExamId,
            status: intento.Status,
            totalScore,
            maxScore,
            percentage,
            showCorrectAnswers: mostrarCorrectas,
            submittedAt: aIso(intento.SubmittedAt),
            gradedAt: aIso(intento.GradedAt),
            answers: aResultado(filas, mostrarCorrectas),
        };
    }
}

module.exports = StudentExamsService;
