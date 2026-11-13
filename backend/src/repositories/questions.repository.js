const sql = require('mssql');
const { pool } = require('../config/database');

class QuestionsRepository {

    async create(data, teacherId) {
        const db = await pool;
        const transaction = new sql.Transaction(db);

        await transaction.begin();

        try {
            const questionResult = await new sql.Request(transaction)
                .input('ownerId', sql.UniqueIdentifier, teacherId)
                .input('title', sql.NVarChar(200), data.title)
                .query(`
					INSERT INTO QuestionBankItems (OwnerId, Title)
					OUTPUT INSERTED.Id
					VALUES (@ownerId, @title)
				`);

            const questionId = questionResult.recordset[0].Id;

            const revisionResult = await new sql.Request(transaction)
                .input('questionId', sql.UniqueIdentifier, questionId)
                .input('questionType', sql.NVarChar(40), data.type)
                .input('statement', sql.NVarChar(sql.MAX), data.statement)
                .query(`
					INSERT INTO QuestionRevisions (
						QuestionId,
						RevisionNumber,
						QuestionType,
						Statement
					)
					OUTPUT INSERTED.Id
					VALUES (
						@questionId,
						1,
						@questionType,
						@statement
					)
				`);

            const revisionId = revisionResult.recordset[0].Id;

            if (Array.isArray(data.options)) {
                for (let i = 0; i < data.options.length; i++) {
                    const option = data.options[i];

                    await new sql.Request(transaction)
                        .input('revisionId', sql.UniqueIdentifier, revisionId)
                        .input('content', sql.NVarChar(sql.MAX), option.content)
                        .input('position', sql.Int, i + 1)
                        .input('creditFraction', sql.Decimal(8, 4), option.creditFraction)
                        .query(`
							INSERT INTO QuestionOptions (
								QuestionRevisionId,
								Content,
								Position,
								CreditFraction
							)
							VALUES (
								@revisionId,
								@content,
								@position,
								@creditFraction
							)
						`);
                }
            }

            await transaction.commit();

            return {
                id: questionId,
                revisionId
            };

        } catch (error) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
            }

            throw error;
        }
    }


    async findByTeacher(teacherId, type = null) {
        const db = await pool;

        const request = db.request()
            .input('teacherId', sql.UniqueIdentifier, teacherId);

        let typeFilter = '';

        if (type) {
            request.input('type', sql.NVarChar(40), type);
            typeFilter = 'AND qr.QuestionType = @type';
        }

        const result = await request.query(`
			SELECT
				q.Id,
				q.Title,

				qr.Id AS RevisionId,
				qr.RevisionNumber,
				qr.QuestionType,
				qr.Statement,
				qr.ContentJson,
				qr.GradingConfigJson,

				qo.Id AS OptionId,
				qo.Content AS OptionContent,
				qo.Position,
				qo.CreditFraction

			FROM QuestionBankItems q

			INNER JOIN QuestionRevisions qr
				ON qr.QuestionId = q.Id

			LEFT JOIN QuestionOptions qo
				ON qo.QuestionRevisionId = qr.Id

			WHERE q.OwnerId = @teacherId
			  AND q.IsActive = 1
			  AND qr.RevisionNumber = (
				  SELECT MAX(qr2.RevisionNumber)
				  FROM QuestionRevisions qr2
				  WHERE qr2.QuestionId = q.Id
			  )
			  ${typeFilter}

			ORDER BY q.Title, qo.Position;
		`);

        return result.recordset;
    }
}

module.exports = QuestionsRepository;