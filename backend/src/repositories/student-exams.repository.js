const sql = require('mssql');
const { pool } = require('../config/database');

async function requestFor(transaction) {
    if (transaction) {
        return new sql.Request(transaction);
    }

    return (await pool).request();
}

class StudentExamsRepository {

    async withTransaction(work) {
        const db = await pool;
        const transaction = new sql.Transaction(db);

        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        try {
            const result = await work(transaction);
            await transaction.commit();

            return result;

        } catch (error) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
            }

            throw error;
        }
    }

    async findInProgressAttempt(studentId, examId, transaction = null, forUpdate = false) {
        const request = await requestFor(transaction);
        const lockHint = forUpdate ? 'WITH (UPDLOCK, HOLDLOCK)' : '';

        const result = await request
            .input('studentId', sql.UniqueIdentifier, studentId)
            .input('examId', sql.UniqueIdentifier, examId)
            .query(`
                SELECT TOP 1
                    a.Id,
                    a.ExamId,
                    a.ExamVersionId,
                    a.StudentId,
                    a.ExamAttemptNumber,
                    a.VersionAttemptNumber,
                    a.Status,
                    a.StartedAt,
                    a.DeadlineAt,
                    a.SubmittedAt,
                    a.IsAutoSubmitted,
                    a.TotalScore,
                    a.MaxScore
                FROM ExamAttempts a ${lockHint}
                WHERE a.StudentId = @studentId
                  AND a.ExamId = @examId
                  AND a.Status = 'IN_PROGRESS'
                ORDER BY a.StartedAt DESC
            `);

        return result.recordset[0] ?? null;
    }

    async findAttemptWithExam(attemptId, studentId, options = {}) {
        const { transaction = null, forUpdate = false } = options;
        const request = await requestFor(transaction);
        const lockHint = forUpdate ? 'WITH (UPDLOCK, HOLDLOCK)' : '';

        const result = await request
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .input('studentId', sql.UniqueIdentifier, studentId)
            .query(`
                SELECT
                    a.Id,
                    a.ExamId,
                    a.ExamVersionId,
                    a.StudentId,
                    a.ExamAttemptNumber,
                    a.VersionAttemptNumber,
                    a.Status,
                    a.StartedAt,
                    a.DeadlineAt,
                    a.SubmittedAt,
                    a.IsAutoSubmitted,
                    a.TotalScore,
                    a.MaxScore,
                    a.GradedAt,
                    e.Status AS ExamStatus,
                    e.ResultsReleaseMode,
                    e.ResultsReleasedAt,
                    e.ShowCorrectAnswers
                FROM ExamAttempts a ${lockHint}
                JOIN Exams e ON e.Id = a.ExamId
                WHERE a.Id = @attemptId
                  AND a.StudentId = @studentId
            `);

        return result.recordset[0] ?? null;
    }

    async expireAttempt(attemptId) {
        const db = await pool;

        const result = await db.request()
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .query(`
                UPDATE ExamAttempts
                SET Status = 'SUBMITTED',
                    SubmittedAt = DeadlineAt,
                    IsAutoSubmitted = 1
                OUTPUT
                    INSERTED.Id,
                    INSERTED.Status,
                    INSERTED.SubmittedAt
                WHERE Id = @attemptId
                  AND Status = 'IN_PROGRESS'
                  AND DeadlineAt <= SYSUTCDATETIME()
            `);

        return result.recordset[0] ?? null;
    }

    async findQuestionsForVersion(examVersionId) {
        const db = await pool;

        const result = await db.request()
            .input('examVersionId', sql.UniqueIdentifier, examVersionId)
            .query(`
                SELECT
                    evq.Id AS ExamVersionQuestionId,
                    r.QuestionId,
                    r.QuestionType,
                    r.Statement,
                    evq.Position,
                    evq.Points,
                    o.Id AS OptionId,
                    o.Content,
                    o.Position AS OptionPosition
                FROM ExamVersionQuestions evq
                JOIN QuestionRevisions r ON r.Id = evq.QuestionRevisionId
                LEFT JOIN QuestionOptions o ON o.QuestionRevisionId = r.Id
                WHERE evq.ExamVersionId = @examVersionId
                ORDER BY evq.Position, o.Position
            `);

        return result.recordset;
    }

    async findAnswers(attemptId, transaction = null) {
        const request = await requestFor(transaction);

        const result = await request
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .query(`
                SELECT
                    aa.Id AS AnswerId,
                    aa.ExamVersionQuestionId,
                    aa.ResponseText,
                    aa.AnsweredAt,
                    o.Id AS OptionId
                FROM AttemptAnswers aa
                LEFT JOIN AttemptAnswerOptions aao ON aao.AnswerId = aa.Id
                LEFT JOIN QuestionOptions o ON o.Id = aao.OptionId
                WHERE aa.AttemptId = @attemptId
                ORDER BY aa.DisplayOrder, o.Position
            `);

        return result.recordset;
    }

    async findQuestionInVersion(examVersionId, questionId) {
        const db = await pool;

        const result = await db.request()
            .input('examVersionId', sql.UniqueIdentifier, examVersionId)
            .input('questionId', sql.UniqueIdentifier, questionId)
            .query(`
                SELECT TOP 1
                    evq.Id AS ExamVersionQuestionId,
                    evq.QuestionRevisionId,
                    evq.Position,
                    r.QuestionId,
                    r.QuestionType
                FROM ExamVersionQuestions evq
                JOIN QuestionRevisions r ON r.Id = evq.QuestionRevisionId
                WHERE evq.ExamVersionId = @examVersionId
                  AND (evq.Id = @questionId OR r.QuestionId = @questionId)
                ORDER BY CASE WHEN evq.Id = @questionId THEN 0 ELSE 1 END
            `);

        return result.recordset[0] ?? null;
    }

    async findValidOptionIds(questionRevisionId, optionIds) {
        if (optionIds.length === 0) {
            return [];
        }

        const db = await pool;
        const request = db.request()
            .input('questionRevisionId', sql.UniqueIdentifier, questionRevisionId);

        const nombres = optionIds.map((id, indice) => {
            request.input(`option${indice}`, sql.UniqueIdentifier, id);
            return `@option${indice}`;
        });

        const result = await request.query(`
            SELECT Id
            FROM QuestionOptions
            WHERE QuestionRevisionId = @questionRevisionId
              AND Id IN (${nombres.join(', ')})
        `);

        return result.recordset.map((row) => row.Id);
    }

    async upsertAnswer(transaction, data) {
        const actualizacion = await new sql.Request(transaction)
            .input('attemptId', sql.UniqueIdentifier, data.attemptId)
            .input('examVersionQuestionId', sql.UniqueIdentifier, data.examVersionQuestionId)
            .input('responseText', sql.NVarChar(sql.MAX), data.responseText ?? null)
            .query(`
                UPDATE AttemptAnswers
                SET ResponseText = @responseText,
                    AnsweredAt = SYSUTCDATETIME(),
                    GradingStatus = 'PENDING'
                OUTPUT INSERTED.Id
                WHERE AttemptId = @attemptId
                  AND ExamVersionQuestionId = @examVersionQuestionId
            `);

        if (actualizacion.recordset[0]) {
            return actualizacion.recordset[0].Id;
        }

        const insercion = await new sql.Request(transaction)
            .input('attemptId', sql.UniqueIdentifier, data.attemptId)
            .input('examVersionQuestionId', sql.UniqueIdentifier, data.examVersionQuestionId)
            .input('displayOrder', sql.Int, data.displayOrder)
            .input('responseText', sql.NVarChar(sql.MAX), data.responseText ?? null)
            .query(`
                INSERT INTO AttemptAnswers (
                    AttemptId,
                    ExamVersionQuestionId,
                    DisplayOrder,
                    ResponseText,
                    AnsweredAt,
                    GradingStatus
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @attemptId,
                    @examVersionQuestionId,
                    @displayOrder,
                    @responseText,
                    SYSUTCDATETIME(),
                    'PENDING'
                )
            `);

        return insercion.recordset[0].Id;
    }

    async replaceAnswerOptions(transaction, answerId, optionIds) {
        await new sql.Request(transaction)
            .input('answerId', sql.UniqueIdentifier, answerId)
            .query('DELETE FROM AttemptAnswerOptions WHERE AnswerId = @answerId');

        for (const optionId of optionIds) {
            await new sql.Request(transaction)
                .input('answerId', sql.UniqueIdentifier, answerId)
                .input('optionId', sql.UniqueIdentifier, optionId)
                .query(`
                    INSERT INTO AttemptAnswerOptions (AnswerId, OptionId)
                    VALUES (@answerId, @optionId)
                `);
        }
    }

    async findAnswer(attemptId, examVersionQuestionId, transaction = null) {
        const request = await requestFor(transaction);

        const result = await request
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .input('examVersionQuestionId', sql.UniqueIdentifier, examVersionQuestionId)
            .query(`
                SELECT
                    aa.Id AS AnswerId,
                    aa.ExamVersionQuestionId,
                    aa.ResponseText,
                    aa.AnsweredAt,
                    o.Id AS OptionId
                FROM AttemptAnswers aa
                LEFT JOIN AttemptAnswerOptions aao ON aao.AnswerId = aa.Id
                LEFT JOIN QuestionOptions o ON o.Id = aao.OptionId
                WHERE aa.AttemptId = @attemptId
                  AND aa.ExamVersionQuestionId = @examVersionQuestionId
                ORDER BY o.Position
            `);

        return result.recordset;
    }

    async submitAttempt(attemptId, studentId) {
        const db = await pool;

        const result = await db.request()
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .input('studentId', sql.UniqueIdentifier, studentId)
            .query(`
                UPDATE ExamAttempts
                SET Status = 'SUBMITTED',
                    SubmittedAt = SYSUTCDATETIME(),
                    IsAutoSubmitted = CASE
                        WHEN DeadlineAt <= SYSUTCDATETIME() THEN 1
                        ELSE 0
                    END
                OUTPUT
                    INSERTED.Id,
                    INSERTED.Status,
                    INSERTED.SubmittedAt,
                    INSERTED.IsAutoSubmitted
                WHERE Id = @attemptId
                  AND StudentId = @studentId
                  AND Status = 'IN_PROGRESS'
            `);

        return result.recordset[0] ?? null;
    }

    async findAttemptForGrading(attemptId, transaction) {
        const result = await new sql.Request(transaction)
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .query(`
                SELECT
                    a.Id,
                    a.ExamId,
                    a.ExamVersionId,
                    a.StudentId,
                    a.Status,
                    a.StartedAt,
                    a.DeadlineAt,
                    a.SubmittedAt,
                    a.IsAutoSubmitted,
                    a.TotalScore,
                    a.MaxScore,
                    a.GradedAt
                FROM ExamAttempts a WITH (UPDLOCK, HOLDLOCK)
                WHERE a.Id = @attemptId
            `);

        return result.recordset[0] ?? null;
    }

    async findGradingQuestions(attemptId, examVersionId, transaction) {
        const result = await new sql.Request(transaction)
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .input('examVersionId', sql.UniqueIdentifier, examVersionId)
            .query(`
                SELECT
                    evq.Id AS ExamVersionQuestionId,
                    evq.Position,
                    evq.Points,
                    r.QuestionType,
                    r.ContentJson,
                    r.GradingConfigJson,
                    aa.Id AS AnswerId,
                    aa.ResponseText,
                    o.Id AS OptionId,
                    o.CreditFraction
                FROM ExamVersionQuestions evq
                JOIN QuestionRevisions r ON r.Id = evq.QuestionRevisionId
                LEFT JOIN AttemptAnswers aa
                    ON aa.AttemptId = @attemptId
                   AND aa.ExamVersionQuestionId = evq.Id
                LEFT JOIN AttemptAnswerOptions aao ON aao.AnswerId = aa.Id
                LEFT JOIN QuestionOptions o
                    ON o.Id = aao.OptionId
                   AND o.QuestionRevisionId = r.Id
                WHERE evq.ExamVersionId = @examVersionId
                ORDER BY evq.Position, o.Position
            `);

        return result.recordset;
    }

    async replaceGrades(transaction, attemptId, calificaciones) {
        await new sql.Request(transaction)
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .query(`
                DELETE FROM AnswerGrades
                WHERE AnswerId IN (
                    SELECT Id FROM AttemptAnswers WHERE AttemptId = @attemptId
                )
            `);

        for (const calificacion of calificaciones) {
            if (!calificacion.answerId) {
                continue;
            }

            await new sql.Request(transaction)
                .input('answerId', sql.UniqueIdentifier, calificacion.answerId)
                .input('gradingStatus', sql.NVarChar(20), calificacion.gradingStatus)
                .query(`
                    UPDATE AttemptAnswers
                    SET GradingStatus = @gradingStatus
                    WHERE Id = @answerId
                `);

            if (calificacion.awardedPoints !== null) {
                await new sql.Request(transaction)
                    .input('answerId', sql.UniqueIdentifier, calificacion.answerId)
                    .input('awardedPoints', sql.Decimal(10, 2), calificacion.awardedPoints)
                    .query(`
                        INSERT INTO AnswerGrades (AnswerId, AwardedPoints, GradingMethod)
                        VALUES (@answerId, @awardedPoints, 'AUTOMATIC')
                    `);
            }
        }
    }

    async completeGrading(transaction, attemptId, data) {
        const result = await new sql.Request(transaction)
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .input('status', sql.NVarChar(30), data.status)
            .input('totalScore', sql.Decimal(10, 2), data.totalScore)
            .input('maxScore', sql.Decimal(10, 2), data.maxScore)
            .query(`
                UPDATE ExamAttempts
                SET Status = @status,
                    TotalScore = @totalScore,
                    MaxScore = @maxScore,
                    GradedAt = CASE WHEN @status = 'GRADED' THEN SYSUTCDATETIME() ELSE NULL END
                OUTPUT
                    INSERTED.Id,
                    INSERTED.Status,
                    INSERTED.TotalScore,
                    INSERTED.MaxScore,
                    INSERTED.GradedAt
                WHERE Id = @attemptId
                  AND Status = 'SUBMITTED'
            `);

        return result.recordset[0] ?? null;
    }

    async findResultRows(attemptId, examVersionId) {
        const db = await pool;

        const result = await db.request()
            .input('attemptId', sql.UniqueIdentifier, attemptId)
            .input('examVersionId', sql.UniqueIdentifier, examVersionId)
            .query(`
                SELECT
                    evq.Id AS ExamVersionQuestionId,
                    evq.Position,
                    evq.Points AS MaxPoints,
                    r.QuestionType,
                    r.Statement,
                    aa.Id AS AnswerId,
                    aa.ResponseText,
                    ag.AwardedPoints,
                    o.Id AS OptionId,
                    o.Content AS OptionContent,
                    o.Position AS OptionPosition,
                    o.CreditFraction,
                    CASE WHEN aao.OptionId IS NOT NULL THEN 1 ELSE 0 END AS Selected
                FROM ExamVersionQuestions evq
                JOIN QuestionRevisions r ON r.Id = evq.QuestionRevisionId
                LEFT JOIN AttemptAnswers aa
                    ON aa.AttemptId = @attemptId
                   AND aa.ExamVersionQuestionId = evq.Id
                LEFT JOIN AnswerGrades ag ON ag.AnswerId = aa.Id
                LEFT JOIN QuestionOptions o ON o.QuestionRevisionId = r.Id
                LEFT JOIN AttemptAnswerOptions aao
                    ON aao.AnswerId = aa.Id
                   AND aao.OptionId = o.Id
                WHERE evq.ExamVersionId = @examVersionId
                ORDER BY evq.Position, o.Position
            `);

        return result.recordset;
    }
}

module.exports = StudentExamsRepository;
