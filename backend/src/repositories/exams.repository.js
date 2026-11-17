const sql = require('mssql');
const { pool } = require('../config/database');

class ExamsRepository {

    async create(data, teacherId) {
        const db = await pool;
        const transaction = new sql.Transaction(db);

        await transaction.begin();

        try {
            const examResult = await new sql.Request(transaction)
                .input('teacherId', sql.UniqueIdentifier, teacherId)
                .input('title', sql.NVarChar(200), data.title)
                .input('description', sql.NVarChar(sql.MAX), data.description || null)
                .input('opensAt', sql.DateTime2, data.opensAt ? new Date(data.opensAt) : null)
                .input('closesAt', sql.DateTime2, data.closesAt ? new Date(data.closesAt) : null)
                .input('durationMinutes', sql.Int, data.durationMinutes ?? null)
                .input('maxAttempts', sql.Int, data.maxAttempts ?? null)
                .query(`
				INSERT INTO Exams (TeacherId, Title, Description, Status, OpensAt, ClosesAt, DurationMinutes, MaxAttempts, AttemptsScope)
				OUTPUT INSERTED.Id
				VALUES (@teacherId, @title, @description, 'DRAFT', @opensAt, @closesAt, @durationMinutes, @maxAttempts, 'EXAM')
			`);

            const examId = examResult.recordset[0].Id;

            const versionResult = await new sql.Request(transaction)
                .input('examId', sql.UniqueIdentifier, examId)
                .query(`
				INSERT INTO ExamVersions (ExamId, VersionNumber, Status)
				OUTPUT INSERTED.Id
				VALUES (@examId, 1, 'DRAFT')
			`);

            const versionId = versionResult.recordset[0].Id;

            await new sql.Request(transaction)
                .input('examId', sql.UniqueIdentifier, examId)
                .input('versionId', sql.UniqueIdentifier, versionId)
                .query(`
				UPDATE Exams
				SET CurrentVersionId = @versionId
				WHERE Id = @examId
			`);

            await transaction.commit();

            return {
                id: examId,
                versionId
            };

        } catch (error) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
            }

            throw error;
        }
    }

    async findByTeacher(teacherId) {
        const db = await pool;

        const result = await db.request()
            .input('teacherId', sql.UniqueIdentifier, teacherId)
            .query(`
			SELECT
				Id,
				Title,
				Description,
				Status,
				CurrentVersionId,
				OpensAt,
				ClosesAt,
				DurationMinutes,
				MaxAttempts,
				AttemptsScope,
				CreatedAt
			FROM Exams
			WHERE TeacherId = @teacherId
			ORDER BY CreatedAt DESC
		`);

        return result.recordset;
    }

    async findByIdAndTeacher(examId, teacherId) {
        const db = await pool;

        const result = await db.request()
            .input('examId', sql.UniqueIdentifier, examId)
            .input('teacherId', sql.UniqueIdentifier, teacherId)
            .query(`
                SELECT
                    e.Id,
                    e.Status,
                    e.CurrentVersionId,
                    v.Status AS VersionStatus
                FROM Exams e
                JOIN ExamVersions v ON v.Id = e.CurrentVersionId
                WHERE e.Id = @examId
                  AND e.TeacherId = @teacherId
            `);

        return result.recordset[0];
    }

    async findLatestRevisions(questionIds, teacherId) {
        if (questionIds.length === 0) {
            return [];
        }

        const db = await pool;
        const request = db.request();

        request.input('teacherId', sql.UniqueIdentifier, teacherId);

        const nombres = questionIds.map((id, i) => {
            request.input(`q${i}`, sql.UniqueIdentifier, id);
            return `@q${i}`;
        });

        const result = await request.query(`
            SELECT
                r.QuestionId,
                r.Id AS RevisionId
            FROM QuestionRevisions r
            JOIN QuestionBankItems q ON q.Id = r.QuestionId
            WHERE q.OwnerId = @teacherId
              AND q.IsActive = 1
              AND r.QuestionId IN (${nombres.join(', ')})
              AND r.RevisionNumber = (
                  SELECT MAX(r2.RevisionNumber)
                  FROM QuestionRevisions r2
                  WHERE r2.QuestionId = r.QuestionId
              )
        `);

        return result.recordset;
    }

    async update(examId, versionId, data, preguntas) {
        const db = await pool;
        const transaction = new sql.Transaction(db);

        await transaction.begin();

        try {
            await new sql.Request(transaction)
                .input('examId', sql.UniqueIdentifier, examId)
                .input('title', sql.NVarChar(200), data.title)
                .input('description', sql.NVarChar(sql.MAX), data.description || null)
                .input('opensAt', sql.DateTime2, data.opensAt ? new Date(data.opensAt) : null)
                .input('closesAt', sql.DateTime2, data.closesAt ? new Date(data.closesAt) : null)
                .input('durationMinutes', sql.Int, data.durationMinutes ?? null)
                .input('maxAttempts', sql.Int, data.maxAttempts ?? null)
                .query(`
                    UPDATE Exams
                    SET Title = @title,
                        Description = @description,
                        OpensAt = @opensAt,
                        ClosesAt = @closesAt,
                        DurationMinutes = @durationMinutes,
                        MaxAttempts = @maxAttempts
                    WHERE Id = @examId
                `);

            await new sql.Request(transaction)
                .input('versionId', sql.UniqueIdentifier, versionId)
                .query(`
                    DELETE FROM ExamVersionQuestions
                    WHERE ExamVersionId = @versionId
                `);

            for (const pregunta of preguntas) {
                await new sql.Request(transaction)
                    .input('versionId', sql.UniqueIdentifier, versionId)
                    .input('revisionId', sql.UniqueIdentifier, pregunta.revisionId)
                    .input('position', sql.Int, pregunta.position)
                    .input('points', sql.Decimal(10, 2), pregunta.points)
                    .query(`
                        INSERT INTO ExamVersionQuestions (ExamVersionId, QuestionRevisionId, Position, Points)
                        VALUES (@versionId, @revisionId, @position, @points)
                    `);
            }

            await transaction.commit();

            return {
                id: examId,
                versionId,
                questions: preguntas.length
            };

        } catch (error) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
            }

            throw error;
        }
    }

}

module.exports = ExamsRepository;