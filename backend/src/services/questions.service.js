const QuestionsRepository = require('../repositories/questions.repository');
const AuthError = require('../utils/auth-error');
const questionsRepository = new QuestionsRepository();

const QUESTION_TYPES = [
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'TRUE_FALSE',
    'SHORT_TEXT',
];
// La base de datos contiene otros tipos para un futuro,
// pero actualmente la aplicación solo usa estos cuatro.

class QuestionsService {

    async create(data, user) {
        const { title, type, statement } = data;

        if (!title || typeof title !== 'string' || !title.trim()) {
            throw new AuthError('El título es obligatorio');
        }

        if (!type || !QUESTION_TYPES.includes(type)) {
            throw new AuthError('El tipo de pregunta no es válido');
        }

        if (!statement || typeof statement !== 'string' || !statement.trim()) {
            throw new AuthError('El enunciado es obligatorio');
        }

        this.validateByType(data);

        return questionsRepository.create(data, user.id);
    }

    async list(user, filters) {
        if (filters.type && !QUESTION_TYPES.includes(filters.type)) {
            throw new AuthError('El tipo de pregunta no es válido');
        }

        const rows = await questionsRepository.findByTeacher(
            user.id,
            filters.type
        );

        const questions = [];

        for (const questionRow of rows) {
            let question = questions.find(question => question.id === questionRow.Id);

            if (!question) {
                question = {
                    id: questionRow.Id,
                    title: questionRow.Title,
                    revision: {
                        id: questionRow.RevisionId,
                        number: questionRow.RevisionNumber,
                        type: questionRow.QuestionType,
                        statement: questionRow.Statement,
                        contentJson: questionRow.ContentJson ? JSON.parse(questionRow.ContentJson) : null,
                        gradingConfigJson: questionRow.GradingConfigJson ? JSON.parse(questionRow.GradingConfigJson) : null,
                        options: []
                    }
                };

                questions.push(question);
            }

            if (questionRow.OptionId) {
                question.revision.options.push({
                    id: questionRow.OptionId,
                    content: questionRow.OptionContent,
                    position: questionRow.Position,
                    creditFraction: questionRow.CreditFraction
                });
            }
        }

        return questions;
    }

    async delete(questionId, teacherId) {
        const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        if (!guidRegex.test(questionId)) {
            throw new AuthError('ID de pregunta inválido', 400);
        }

        const deleted = await questionsRepository.delete(questionId, teacherId);

        if (deleted === 0) {
            throw new AuthError('Pregunta no encontrada', 404);
        }

        return { message: 'Pregunta eliminada correctamente' };
    }

    async update(questionId, teacherId, data) {
        const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        if (!guidRegex.test(questionId)) {
            throw new AuthError('ID de pregunta inválido', 400);
        }

        const question = await questionsRepository.findByIdAndTeacher(questionId, teacherId);

        if (!question) {
            throw new AuthError('Pregunta no encontrada', 404);
        }

        const { title, type, statement } = data;

        if (!title || typeof title !== 'string' || !title.trim()) {
            throw new AuthError('El título es obligatorio');
        }

        if (!type || !QUESTION_TYPES.includes(type)) {
            throw new AuthError('El tipo de pregunta no es válido');
        }

        if (!statement || typeof statement !== 'string' || !statement.trim()) {
            throw new AuthError('El enunciado es obligatorio');
        }

        this.validateByType(data);

        return questionsRepository.update(questionId, data);
    }

    validateByType(data) {
        switch (data.type) {
            case 'SINGLE_CHOICE':
                return this.validateSingleChoice(data);

            case 'MULTIPLE_CHOICE':
                return this.validateMultipleChoice(data);

            case 'TRUE_FALSE':
                return this.validateTrueFalse(data);

            case 'SHORT_TEXT':
                return this.validateShortText(data);
        }
    }

    validateSingleChoice(data) {
        const { options } = data;

        if (!Array.isArray(options) || options.length < 2) {
            throw new AuthError('Debe tener al menos dos opciones');
        }

        if (options.some(option => typeof option.content !== 'string' || !option.content.trim())) {
            throw new AuthError('Las opciones no pueden estar vacías');
        }

        if (options.filter(option => option.creditFraction === 1).length !== 1) {
            throw new AuthError('Debe tener una sola opción correcta');
        }

        if (options.some(option => option.creditFraction !== 0 && option.creditFraction !== 1)) {
            throw new AuthError('Las opciones deben tener crédito 0 o 1');
        }
    }

    validateMultipleChoice(data) {
        const { options } = data;

        if (!Array.isArray(options) || options.length < 2) {
            throw new AuthError('Debe tener al menos dos opciones');
        }

        if (options.some(option => typeof option.content !== 'string' || !option.content.trim())) {
            throw new AuthError('Las opciones no pueden estar vacías');
        }

        if (options.some(option =>
            typeof option.creditFraction !== 'number' || option.creditFraction < -1 || option.creditFraction > 1)) {
            throw new AuthError('Las fracciones de crédito deben estar entre -1 y 1');
        }

        const positiveCredits = options
            .filter(option => option.creditFraction > 0)
            .reduce((sum, option) => sum + option.creditFraction, 0);

        if (positiveCredits === 0) {
            throw new AuthError('Debe haber al menos una opción correcta');
        }

        const roundedCredits = Math.round(positiveCredits * 10000) / 10000;

        if (roundedCredits !== 1) {
            throw new AuthError('La suma de los créditos positivos debe ser 1');
        }
    }

    validateTrueFalse(data) {
        const { options } = data;

        if (!Array.isArray(options) || options.length !== 2) {
            throw new AuthError('Debe tener exactamente dos opciones');
        }

        if (options.some(option => typeof option.content !== 'string' || !option.content.trim())) {
            throw new AuthError('Las opciones no pueden estar vacías');
        }

        const contents = options.map(option => option.content.trim().toLowerCase());

        if (!contents.includes('verdadero') || !contents.includes('falso')) {
            throw new AuthError('Las opciones deben ser Verdadero y Falso');
        }

        if (options.some(option => option.creditFraction !== 0 && option.creditFraction !== 1)) {
            throw new AuthError('Las opciones deben tener crédito 0 o 1');
        }

        if (options.filter(option => option.creditFraction === 1).length !== 1) {
            throw new AuthError('Debe tener una sola opción correcta');
        }
    }

    validateShortText(data) {
        const { contentJson, gradingConfigJson } = data;

        if (!contentJson || !Array.isArray(contentJson.acceptedAnswers) || contentJson.acceptedAnswers.length === 0) {
            throw new AuthError('Debe haber al menos una respuesta aceptada');
        }

        if (contentJson.acceptedAnswers.some(answer => typeof answer !== 'string' || !answer.trim())) {
            throw new AuthError('Las respuestas aceptadas no pueden estar vacías');
        }

        if (!gradingConfigJson || typeof gradingConfigJson.caseSensitive !== 'boolean') {
            throw new AuthError('Debe indicar si distingue mayúsculas y minúsculas');
        }
    }
}

module.exports = QuestionsService;