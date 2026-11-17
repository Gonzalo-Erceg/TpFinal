const sql = require('mssql');
const { pool } = require('../config/database');
const AuthError = require('../utils/auth-error');

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
                currentVersionId: versionId,
                status: 'DRAFT',
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
                    e.Id,
                    e.Title,
                    e.Description,
                    e.Status,
                    e.CurrentVersionId,
                    v.Status AS CurrentVersionStatus,
                    e.PublishAt,
                    e.OpensAt,
                    e.ClosesAt,
                    e.DurationMinutes,
                    e.MaxAttempts,
                    e.AttemptsScope,
                    e.CreatedAt,
                    e.UpdatedAt,
                    (
                        SELECT COUNT(*)
                        FROM ExamVersionQuestions q
                        WHERE q.ExamVersionId = e.CurrentVersionId
                    ) AS QuestionCount,
                    STUFF((
                        SELECT ',' + CONVERT(nvarchar(36), eg.GroupId)
                        FROM ExamGroups eg
                        WHERE eg.ExamId = e.Id
                        ORDER BY eg.GroupId
                        FOR XML PATH('')
                    ), 1, 1, '') AS GroupIdsCsv
                FROM Exams e
                LEFT JOIN ExamVersions v ON v.Id = e.CurrentVersionId
                WHERE e.TeacherId = @teacherId
                ORDER BY e.CreatedAt DESC
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
                LEFT JOIN ExamVersions v ON v.Id = e.CurrentVersionId
                WHERE e.Id = @examId
                  AND e.TeacherId = @teacherId
            `);

        return result.recordset[0];
    }

    async findDetailByIdAndTeacher(examId, teacherId) {
        const db = await pool;

        const examResult = await db.request()
            .input('examId', sql.UniqueIdentifier, examId)
            .input('teacherId', sql.UniqueIdentifier, teacherId)
            .query(`
                SELECT
                    e.Id,
                    e.Title,
                    e.Description,
                    e.Status,
                    e.CurrentVersionId,
                    v.Status AS CurrentVersionStatus,
                    v.VersionNumber AS CurrentVersionNumber,
                    e.PublishAt,
                    e.OpensAt,
                    e.ClosesAt,
                    e.DurationMinutes,
                    e.MaxAttempts,
                    e.AttemptsScope,
                    e.CreatedAt,
                    e.UpdatedAt,
                    (
                        SELECT COUNT(*)
                        FROM ExamVersionQuestions q
                        WHERE q.ExamVersionId = e.CurrentVersionId
                    ) AS QuestionCount,
                    STUFF((
                        SELECT ',' + CONVERT(nvarchar(36), eg.GroupId)
                        FROM ExamGroups eg
                        WHERE eg.ExamId = e.Id
                        ORDER BY eg.GroupId
                        FOR XML PATH('')
                    ), 1, 1, '') AS GroupIdsCsv
                FROM Exams e
                LEFT JOIN ExamVersions v ON v.Id = e.CurrentVersionId
                WHERE e.Id = @examId
                  AND e.TeacherId = @teacherId
            `);

        const exam = examResult.recordset[0];

        if (!exam) {
            return null;
        }

        const groupsResult = await db.request()
            .input('examId', sql.UniqueIdentifier, examId)
            .input('teacherId', sql.UniqueIdentifier, teacherId)
            .query(`
                SELECT
                    g.Id,
                    g.Name,
                    g.AccessCode
                FROM ExamGroups eg
                JOIN ClassGroups g ON g.Id = eg.GroupId
                WHERE eg.ExamId = @examId
                  AND g.TeacherId = @teacherId
                ORDER BY g.Name
            `);

        let questionRows = [];

        if (exam.CurrentVersionId) {
            const questionsResult = await db.request()
                .input('versionId', sql.UniqueIdentifier, exam.CurrentVersionId)
                .query(`
                    SELECT
                        evq.Id AS ExamVersionQuestionId,
                        r.QuestionId,
                        r.Id AS RevisionId,
                        b.Title,
                        r.QuestionType,
                        r.Statement,
                        evq.Position,
                        evq.Points,
                        o.Id AS OptionId,
                        o.Content,
                        o.Position AS OptionPosition,
                        o.CreditFraction
                    FROM ExamVersionQuestions evq
                    JOIN QuestionRevisions r ON r.Id = evq.QuestionRevisionId
                    JOIN QuestionBankItems b ON b.Id = r.QuestionId
                    LEFT JOIN QuestionOptions o ON o.QuestionRevisionId = r.Id
                    WHERE evq.ExamVersionId = @versionId
                    ORDER BY evq.Position, o.Position
                `);

            questionRows = questionsResult.recordset;
        }

        return {
            exam,
            groups: groupsResult.recordset,
            questionRows,
        };
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

    async findOwnedActiveGroupIds(groupIds, teacherId) {
        if (groupIds.length === 0) {
            return [];
        }

        const db = await pool;
        const request = db.request().input('teacherId', sql.UniqueIdentifier, teacherId);

        const nombres = groupIds.map((id, i) => {
            request.input(`g${i}`, sql.UniqueIdentifier, id);
            return `@g${i}`;
        });

        const result = await request.query(`
            SELECT g.Id
            FROM ClassGroups g
            WHERE g.TeacherId = @teacherId
              AND g.IsActive = 1
              AND g.Id IN (${nombres.join(', ')})
        `);

        return result.recordset.map((row) => row.Id);
    }

    async replaceGroups(examId, groupIds, transaction) {
        if (groupIds === undefined) {
            return;
        }

        await new sql.Request(transaction)
            .input('examId', sql.UniqueIdentifier, examId)
            .query('DELETE FROM ExamGroups WHERE ExamId = @examId');

        for (const groupId of groupIds) {
            await new sql.Request(transaction)
                .input('examId', sql.UniqueIdentifier, examId)
                .input('groupId', sql.UniqueIdentifier, groupId)
                .query(`
                    INSERT INTO ExamGroups (ExamId, GroupId)
                    VALUES (@examId, @groupId)
                `);
        }
    }

    async update(examId, versionId, data, preguntas, groupIds) {
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
                        MaxAttempts = @maxAttempts,
                        UpdatedAt = SYSUTCDATETIME()
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

            await this.replaceGroups(examId, groupIds, transaction);

            await transaction.commit();

            return {
                id: examId,
                versionId,
                questions: preguntas.length,
            };

        } catch (error) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
            }

            throw error;
        }
    }

    async close(examId, teacherId) {
        const db = await pool;
        const transaction = new sql.Transaction(db);

        await transaction.begin();

        try {
            const examResult = await new sql.Request(transaction)
                .input('examId', sql.UniqueIdentifier, examId)
                .input('teacherId', sql.UniqueIdentifier, teacherId)
                .query(`
                    SELECT
                        e.Id,
                        e.Status
                    FROM Exams e WITH (UPDLOCK, HOLDLOCK)
                    WHERE e.Id = @examId
                      AND e.TeacherId = @teacherId
                `);

            const exam = examResult.recordset[0];

            if (!exam) {
                throw new AuthError('El examen no existe', 404);
            }

            if (exam.Status === 'CLOSED') {
                await transaction.commit();

                return {
                    id: exam.Id,
                    status: 'CLOSED',
                };
            }

            if (exam.Status === 'DRAFT') {
                throw new AuthError('Sólo se puede cerrar un examen publicado', 409);
            }

            const closeResult = await new sql.Request(transaction)
                .input('examId', sql.UniqueIdentifier, examId)
                .query(`
                    UPDATE Exams
                    SET Status = 'CLOSED',
                        UpdatedAt = SYSUTCDATETIME()
                    OUTPUT INSERTED.Status AS Status
                    WHERE Id = @examId
                `);

            await transaction.commit();

            return {
                id: examId,
                status: closeResult.recordset[0].Status,
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
