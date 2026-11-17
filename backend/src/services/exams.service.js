const ExamsRepository = require('../repositories/exams.repository');
const ManualGradingService = require('./manual-grading.service');
const AuthError = require('../utils/auth-error');

const examsRepository = new ExamsRepository();
const manualGradingService = new ManualGradingService();
const FORMATO_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODOS_LIBERACION = ['IMMEDIATE', 'ON_CLOSE', 'MANUAL'];

function esGuid(value) {
    return typeof value === 'string' && FORMATO_GUID.test(value);
}

function aNumero(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const numero = Number(value);

    return Number.isFinite(numero) ? numero : null;
}

function aIso(value) {
    if (!value) {
        return null;
    }

    const fecha = value instanceof Date ? value : new Date(value);

    return isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

function validarDatosExamen(data) {
    const { title, description, opensAt, closesAt, durationMinutes, maxAttempts } = data;

    if (!title || typeof title !== 'string' || !title.trim()) {
        throw new AuthError('El título es obligatorio');
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
        throw new AuthError('La descripción no es válida');
    }

    if (opensAt && isNaN(new Date(opensAt).getTime())) {
        throw new AuthError('La fecha de apertura no es válida');
    }

    if (closesAt && isNaN(new Date(closesAt).getTime())) {
        throw new AuthError('La fecha de cierre no es válida');
    }

    if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
        throw new AuthError('La fecha de apertura debe ser anterior a la fecha de cierre');
    }

    if (durationMinutes !== undefined && durationMinutes !== null) {
        if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
            throw new AuthError('La duración debe ser un número entero mayor a 0');
        }
    }

    if (maxAttempts !== undefined && maxAttempts !== null) {
        if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
            throw new AuthError('La cantidad máxima de intentos debe ser un número entero mayor a 0');
        }
    }

    if (data.resultsReleaseMode !== undefined && data.resultsReleaseMode !== null &&
        !MODOS_LIBERACION.includes(data.resultsReleaseMode)) {
        throw new AuthError('El modo de liberación de resultados no es válido');
    }

    if (data.showCorrectAnswers !== undefined && data.showCorrectAnswers !== null &&
        typeof data.showCorrectAnswers !== 'boolean') {
        throw new AuthError('La opción de mostrar respuestas correctas no es válida');
    }
}

function validarPreguntas(questions) {
    if (!Array.isArray(questions)) {
        throw new AuthError('Las preguntas deben ser una lista');
    }

    if (questions.some((q) => typeof q.questionId !== 'string' || !q.questionId.trim() ||
        !FORMATO_GUID.test(q.questionId))) {
        throw new AuthError('Cada pregunta debe tener un questionId válido');
    }

    if (questions.some((q) => typeof q.points !== 'number' || q.points < 0)) {
        throw new AuthError('Los puntos deben ser mayor o igual a 0');
    }

    if (questions.some((q) => !Number.isInteger(q.position) || q.position <= 0)) {
        throw new AuthError('La posición debe ser un número entero mayor a 0');
    }

    const ids = questions.map((q) => q.questionId.toUpperCase());

    if (new Set(ids).size !== ids.length) {
        throw new AuthError('No se puede repetir una pregunta');
    }

    const posiciones = questions.map((q) => q.position);

    if (new Set(posiciones).size !== posiciones.length) {
        throw new AuthError('No se puede repetir una posición');
    }
}

function validarGroupIds(groupIds) {
    if (groupIds === undefined) {
        return undefined;
    }

    if (!Array.isArray(groupIds)) {
        throw new AuthError('Los grupos deben ser una lista');
    }

    if (groupIds.some((id) => !esGuid(id))) {
        throw new AuthError('Cada grupo debe tener un id válido');
    }

    const normalizados = groupIds.map((id) => id.toLowerCase());

    if (new Set(normalizados).size !== normalizados.length) {
        throw new AuthError('No se puede repetir un grupo');
    }

    return normalizados;
}

function toGroupIds(csv) {
    return csv ? csv.split(',') : [];
}

function toExamSummary(row) {
    return {
        id: row.Id,
        title: row.Title,
        description: row.Description ?? null,
        status: row.Status,
        currentVersionId: row.CurrentVersionId ?? null,
        currentVersionStatus: row.CurrentVersionStatus ?? null,
        publishAt: aIso(row.PublishAt),
        opensAt: aIso(row.OpensAt),
        closesAt: aIso(row.ClosesAt),
        durationMinutes: row.DurationMinutes ?? null,
        maxAttempts: row.MaxAttempts ?? null,
        attemptsScope: row.AttemptsScope,
        groupIds: toGroupIds(row.GroupIdsCsv),
        questionCount: row.QuestionCount ?? 0,
        attemptCount: Number(row.AttemptCount ?? 0),
        resultsReleaseMode: row.ResultsReleaseMode ?? 'MANUAL',
        resultsReleasedAt: aIso(row.ResultsReleasedAt),
        showCorrectAnswers: Boolean(row.ShowCorrectAnswers),
        createdAt: aIso(row.CreatedAt),
        updatedAt: aIso(row.UpdatedAt),
    };
}

function toAttempt(row) {
    return {
        attemptId: row.Id,
        studentId: row.StudentId,
        studentName: `${row.FirstName ?? ''} ${row.LastName ?? ''}`.trim(),
        studentEmail: row.Email,
        attemptNumber: row.ExamAttemptNumber,
        status: row.Status,
        startedAt: aIso(row.StartedAt),
        submittedAt: aIso(row.SubmittedAt),
        totalScore: aNumero(row.TotalScore),
        maxScore: aNumero(row.MaxScore),
        gradedAt: aIso(row.GradedAt),
    };
}

function toQuestionList(questionRows) {
    const preguntas = new Map();

    for (const row of questionRows) {
        let pregunta = preguntas.get(row.ExamVersionQuestionId);

        if (!pregunta) {
            pregunta = {
                examVersionQuestionId: row.ExamVersionQuestionId,
                questionId: row.QuestionId,
                revisionId: row.RevisionId,
                title: row.Title ?? null,
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
                creditFraction: Number(row.CreditFraction),
            });
        }
    }

    return [...preguntas.values()];
}

function toExamDetail(detail) {
    return {
        ...toExamSummary(detail.exam),
        currentVersionNumber: detail.exam.CurrentVersionNumber ?? null,
        groups: detail.groups.map((group) => ({
            id: group.Id,
            name: group.Name,
            accessCode: group.AccessCode,
        })),
        questions: toQuestionList(detail.questionRows),
    };
}

class ExamsService {

    async create(data, user) {
        validarDatosExamen(data);

        return examsRepository.create(data, user.id);
    }

    async list(user) {
        const rows = await examsRepository.findByTeacher(user.id);

        return rows.map(toExamSummary);
    }

    async getById(examId, user) {
        if (!esGuid(examId)) {
            throw new AuthError('El examen no existe', 404);
        }

        const detail = await examsRepository.findDetailByIdAndTeacher(examId, user.id);

        if (!detail) {
            throw new AuthError('El examen no existe', 404);
        }

        return toExamDetail(detail);
    }

    async update(examId, data, user) {
        if (!esGuid(examId)) {
            throw new AuthError('El examen no existe', 404);
        }

        validarDatosExamen(data);
        validarPreguntas(data.questions);

        const groupIds = validarGroupIds(data.groupIds);
        const { questions } = data;

        const exam = await examsRepository.findByIdAndTeacher(examId, user.id);

        if (!exam) {
            throw new AuthError('El examen no existe', 404);
        }

        if (exam.Status !== 'DRAFT' || exam.VersionStatus !== 'DRAFT') {
            throw new AuthError('Sólo se pueden editar exámenes en borrador', 409);
        }

        const ids = questions.map((q) => q.questionId.toUpperCase());
        const revisiones = await examsRepository.findLatestRevisions(ids, user.id);

        if (revisiones.length !== ids.length) {
            throw new AuthError('Alguna pregunta no existe o no te pertenece');
        }

        if (groupIds !== undefined) {
            const gruposPropios = await examsRepository.findOwnedActiveGroupIds(groupIds, user.id);
            const encontrados = new Set(gruposPropios.map((id) => id.toLowerCase()));

            if (groupIds.some((id) => !encontrados.has(id))) {
                throw new AuthError('Algún grupo no existe, no te pertenece o está inactivo');
            }
        }

        const preguntas = questions.map((q) => ({
            revisionId: revisiones.find((r) => r.QuestionId.toUpperCase() === q.questionId.toUpperCase()).RevisionId,
            points: q.points,
            position: q.position,
        }));

        await examsRepository.update(exam.Id, exam.CurrentVersionId, data, preguntas, groupIds);

        return this.getById(examId, user);
    }

    async publish(examId, data, user) {
        if (!esGuid(examId)) {
            throw new AuthError('El examen no existe', 404);
        }

        const publishAt = data?.publishAt ?? null;

        if (publishAt !== null && isNaN(new Date(publishAt).getTime())) {
            throw new AuthError('La fecha de publicación no es válida');
        }

        const result = await examsRepository.publish(
            examId,
            user.id,
            publishAt ? new Date(publishAt) : null
        );

        return {
            ...result,
            publishedAt: aIso(result.publishedAt),
        };
    }

    async close(examId, user) {
        if (!esGuid(examId)) {
            throw new AuthError('El examen no existe', 404);
        }

        return examsRepository.close(examId, user.id);
    }

    async releaseResults(examId, user) {
        if (!esGuid(examId)) {
            throw new AuthError('El examen no existe', 404);
        }

        const exam = await examsRepository.findByIdAndTeacher(examId, user.id);

        if (!exam) {
            throw new AuthError('El examen no existe', 404);
        }

        if (exam.Status === 'DRAFT') {
            throw new AuthError('El examen todavía no fue publicado', 409);
        }

        const resultado = await examsRepository.releaseResults(examId, user.id);

        if (!resultado) {
            throw new AuthError('El examen no existe', 404);
        }

        return {
            id: examId,
            status: resultado.Status,
            resultsReleaseMode: resultado.ResultsReleaseMode,
            resultsReleasedAt: aIso(resultado.ResultsReleasedAt),
        };
    }

    async listAttempts(examId, user) {
        if (!esGuid(examId)) {
            throw new AuthError('El examen no existe', 404);
        }

        const exam = await examsRepository.findByIdAndTeacher(examId, user.id);

        if (!exam) {
            throw new AuthError('El examen no existe', 404);
        }

        const rows = await examsRepository.findAttemptsByExam(examId, user.id);

        return rows.map(toAttempt);
    }

    async getAttemptReview(examId, attemptId, user) {
        return manualGradingService.getReview(examId, attemptId, user);
    }

    async saveAttemptReview(examId, attemptId, body, user) {
        return manualGradingService.saveReview(examId, attemptId, body, user);
    }
}

module.exports = ExamsService;