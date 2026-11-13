const QuestionsRepository = require('../repositories/questions.repository');
const AuthError = require('../utils/auth-error');
const questionsRepository = new QuestionsRepository();

const QUESTION_TYPES = [
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'TRUE_FALSE',
    'SHORT_TEXT',
    'ESSAY',
    'MATCHING',
    'ORDERING',
    'FILE_UPLOAD'
];

class QuestionsService {

    async create(data, user) {
        const { title, type, statement, options } = data;

        if (!title || typeof title !== 'string' || !title.trim()) {
            throw new AuthError('El título es obligatorio');
        }

        if (!type || !QUESTION_TYPES.includes(type)) {
            throw new AuthError('El tipo de pregunta no es válido');
        }

        if (!statement || typeof statement !== 'string' || !statement.trim()) {
            throw new AuthError('El enunciado es obligatorio');
        }

        if (type === 'SINGLE_CHOICE') {
            if (!Array.isArray(options) || options.length < 2) {
                throw new AuthError('Debe tener al menos dos opciones');
            }

            if (options.some(option => !option.content || !option.content.trim())) {
                throw new AuthError('Las opciones no pueden estar vacías');
            }

            if (options.filter(option => option.creditFraction === 1).length !== 1) {
                throw new AuthError('Debe tener una sola opción correcta');
            }

            if (options.some(option =>
                option.creditFraction !== 0 &&
                option.creditFraction !== 1
            )) {
                throw new AuthError('Las opciones deben tener crédito 0 o 1');
            }
        }

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
            let question = questions.find(
                question => question.id === questionRow.Id
            );

            if (!question) {
                question = {
                    id: questionRow.Id,
                    title: questionRow.Title,
                    revision: {
                        id: questionRow.RevisionId,
                        number: questionRow.RevisionNumber,
                        type: questionRow.QuestionType,
                        statement: questionRow.Statement,
                        contentJson: questionRow.ContentJson,
                        gradingConfigJson: questionRow.GradingConfigJson,
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
}

module.exports = QuestionsService;