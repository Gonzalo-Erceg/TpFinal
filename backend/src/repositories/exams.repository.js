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

}

module.exports = ExamsRepository;