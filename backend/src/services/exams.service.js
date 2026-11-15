const ExamsRepository = require('../repositories/exams.repository');
const AuthError = require('../utils/auth-error');

const examsRepository = new ExamsRepository();
// Formato de un GUID (ej: DD2772C9-03F9-4EBB-870A-59CFEAADDB5F)
const FORMATO_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida título, descripción, fechas, duración e intentos del examen
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
}

class ExamsService {

    async create(data, user) {
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

        return examsRepository.create(data, user.id);
    }

    async list(user) {
        return examsRepository.findByTeacher(user.id);
    }

    // Edita un examen propio en borrador y reemplaza sus preguntas
    async update(examId, data, user) {
        if (!FORMATO_GUID.test(examId)) {
            throw new AuthError('El examen no existe', 404);
        }
        validarDatosExamen(data);

        const { questions } = data;

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

        const exam = await examsRepository.findByIdAndTeacher(examId, user.id);
        if (!exam) {
            throw new AuthError('El examen no existe', 404);
        }

        if (exam.Status !== 'DRAFT' || exam.VersionStatus !== 'DRAFT') {
            throw new AuthError('Sólo se pueden editar exámenes en borrador', 409);
        }

        const revisiones = await examsRepository.findLatestRevisions(ids, user.id);
        if (revisiones.length !== ids.length) {
            throw new AuthError('Alguna pregunta no existe o no te pertenece');
        }

        const preguntas = questions.map((q) => ({
            revisionId: revisiones.find((r) => r.QuestionId.toUpperCase() === q.questionId.toUpperCase()).RevisionId,
            points: q.points,
            position: q.position,
        }));

        return examsRepository.update(exam.Id, exam.CurrentVersionId, data, preguntas);
    }
}

module.exports = ExamsService;