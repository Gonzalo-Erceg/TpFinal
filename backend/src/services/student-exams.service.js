const ExamAccessService = require('./exam-access.service');
const StudentExamsRepository = require('../repositories/student-exams.repository');
const AuthError = require('../utils/auth-error');

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
        return attempt.Status === 'GRADED' || attempt.TotalScore !== null;
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

        if (intento.Status !== 'IN_PROGRESS') {
            if (ESTADOS_ENTREGADOS.includes(intento.Status)) {
                return {
                    attemptId: intento.Id,
                    status: intento.Status,
                    submittedAt: aIso(intento.SubmittedAt),
                };
            }

            throw new AuthError('El intento no se puede entregar en su estado actual', 409);
        }

        const actualizado = await studentExamsRepository.submitAttempt(attemptId, user.id);

        if (!actualizado) {
            const actual = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);

            if (!actual) {
                throw new AuthError('El intento no existe', 404);
            }

            if (ESTADOS_ENTREGADOS.includes(actual.Status)) {
                return {
                    attemptId: actual.Id,
                    status: actual.Status,
                    submittedAt: aIso(actual.SubmittedAt),
                };
            }

            throw new AuthError('No se pudo entregar el intento', 409);
        }

        return {
            attemptId: actualizado.Id,
            status: actualizado.Status,
            submittedAt: aIso(actualizado.SubmittedAt),
        };
    }

    async getResult(attemptId, user) {
        if (!esGuid(attemptId)) {
            throw new AuthError('El intento no existe', 404);
        }

        const intento = await studentExamsRepository.findAttemptWithExam(attemptId, user.id);

        if (!intento) {
            throw new AuthError('El intento no existe', 404);
        }

        if (intento.Status !== 'GRADED') {
            throw new AuthError('El intento todavía no está corregido', 409);
        }

        if (!resultadosLiberados(intento)) {
            throw new AuthError('Los resultados todavía no están disponibles', 409);
        }

        const filas = await studentExamsRepository.findResultRows(attemptId);
        const respuestas = new Map();

        for (const fila of filas) {
            let respuesta = respuestas.get(fila.ExamVersionQuestionId);

            if (!respuesta) {
                const awardedPoints = aNumero(fila.AwardedPoints);

                respuesta = {
                    examVersionQuestionId: fila.ExamVersionQuestionId,
                    awardedPoints,
                    maxPoints: Number(fila.MaxPoints),
                    isCorrect: awardedPoints !== null && awardedPoints === Number(fila.MaxPoints),
                    correctOptionIds: [],
                };

                respuestas.set(fila.ExamVersionQuestionId, respuesta);
            }

            if (fila.CorrectOptionId && intento.ShowCorrectAnswers) {
                respuesta.correctOptionIds.push(fila.CorrectOptionId);
            }
        }

        const totalScore = aNumero(intento.TotalScore);
        const maxScore = aNumero(intento.MaxScore);
        const percentage = totalScore !== null && maxScore !== null && maxScore > 0
            ? Math.round((totalScore / maxScore) * 10000) / 100
            : null;

        return {
            attemptId: intento.Id,
            status: intento.Status,
            totalScore,
            maxScore,
            percentage,
            showCorrectAnswers: Boolean(intento.ShowCorrectAnswers),
            answers: [...respuestas.values()],
        };
    }
}

module.exports = StudentExamsService;
