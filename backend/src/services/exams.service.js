const ExamsRepository = require('../repositories/exams.repository');
const AuthError = require('../utils/auth-error');

const examsRepository = new ExamsRepository();

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

}

module.exports = ExamsService;