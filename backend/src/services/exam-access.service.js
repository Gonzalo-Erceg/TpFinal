const sql = require('mssql');
const { pool } = require('../config/database');

class ExamAccessService {

    async listarExamenesDisponibles(studentId) {
        return this.findAccessibleExams(studentId, null, { incluirCerradosConIntento: true });
    }

    async obtenerExamenAccesible(studentId, examId, options = {}) {
        const filas = await this.findAccessibleExams(studentId, examId, options);

        return filas[0] ?? null;
    }

    async findAccessibleExams(studentId, examId = null, options = {}) {
        const {
            transaction = null,
            forUpdate = false,
            incluirCerradosConIntento = false,
            permitirCerradoEnCurso = false,
        } = options;

        const request = transaction
            ? new sql.Request(transaction)
            : (await pool).request();

        request
            .input('studentId', sql.UniqueIdentifier, studentId)
            .input('examId', sql.UniqueIdentifier, examId)
            .input('incluirCerradosConIntento', sql.Bit, incluirCerradosConIntento ? 1 : 0)
            .input('permitirCerradoEnCurso', sql.Bit, permitirCerradoEnCurso ? 1 : 0);

        const lockHint = forUpdate ? 'WITH (UPDLOCK, HOLDLOCK)' : '';

        const result = await request.query(`
            SELECT
                e.Id,
                e.Title,
                e.Description,
                e.Status,
                e.PublishAt,
                e.OpensAt,
                e.ClosesAt,
                e.DurationMinutes,
                e.MaxAttempts,
                e.AttemptsScope,
                e.ResultsReleaseMode,
                e.ResultsReleasedAt,
                e.ShowCorrectAnswers,
                v.Id AS PublishedVersionId,
                v.VersionNumber AS PublishedVersionNumber,
                (
                    SELECT TOP 1 g.Name
                    FROM ExamGroups eg
                    JOIN ClassGroups g ON g.Id = eg.GroupId
                    JOIN GroupMembers gm ON gm.GroupId = g.Id
                    WHERE eg.ExamId = e.Id
                      AND g.IsActive = 1
                      AND gm.UserId = @studentId
                      AND gm.Status = 'ACTIVE'
                    ORDER BY g.Name
                ) AS GroupName,
                (
                    SELECT COUNT(*)
                    FROM ExamAttempts a
                    WHERE a.StudentId = @studentId
                      AND a.Status <> 'CANCELLED'
                      AND (
                          (e.AttemptsScope = 'EXAM' AND a.ExamId = e.Id)
                          OR (e.AttemptsScope = 'VERSION' AND a.ExamVersionId = v.Id)
                      )
                ) AS AttemptsUsed,
                (
                    SELECT COUNT(*)
                    FROM ExamVersionQuestions evq
                    WHERE evq.ExamVersionId = v.Id
                ) AS QuestionCount,
                (
                    SELECT ISNULL(SUM(evq.Points), 0)
                    FROM ExamVersionQuestions evq
                    WHERE evq.ExamVersionId = v.Id
                ) AS TotalPoints,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM ExamAttempts a
                    WHERE a.StudentId = @studentId
                      AND a.ExamId = e.Id
                      AND a.Status = 'IN_PROGRESS'
                      AND a.DeadlineAt > SYSUTCDATETIME()
                ) THEN 1 ELSE 0 END AS HasInProgress,
                ultimo.Id AS LastAttemptId,
                ultimo.Status AS LastAttemptStatus,
                ultimo.TotalScore AS LastAttemptTotalScore,
                ultimo.MaxScore AS LastAttemptMaxScore,
                ultimo.SubmittedAt AS LastAttemptSubmittedAt
            FROM Exams e ${lockHint}
            JOIN ExamVersions v
              ON v.ExamId = e.Id
             AND v.Status = 'PUBLISHED'
            OUTER APPLY (
                SELECT TOP 1
                    a.Id,
                    a.Status,
                    a.TotalScore,
                    a.MaxScore,
                    a.SubmittedAt
                FROM ExamAttempts a
                WHERE a.StudentId = @studentId
                  AND a.Status <> 'CANCELLED'
                  AND (
                      (e.AttemptsScope = 'EXAM' AND a.ExamId = e.Id)
                      OR (e.AttemptsScope = 'VERSION' AND a.ExamVersionId = v.Id)
                  )
                ORDER BY a.StartedAt DESC
            ) ultimo
            WHERE (
                    (
                        e.Status IN ('PUBLISHED', 'SCHEDULED')
                        AND (e.PublishAt IS NULL OR e.PublishAt <= SYSUTCDATETIME())
                        AND (e.OpensAt IS NULL OR e.OpensAt <= SYSUTCDATETIME())
                        AND (e.ClosesAt IS NULL OR e.ClosesAt >= SYSUTCDATETIME())
                    )
                    OR (
                        e.Status = 'CLOSED'
                        AND @incluirCerradosConIntento = 1
                        AND EXISTS (
                            SELECT 1
                            FROM ExamAttempts a
                            WHERE a.StudentId = @studentId
                              AND a.ExamId = e.Id
                              AND a.Status <> 'CANCELLED'
                        )
                    )
                    OR (
                        e.Status = 'CLOSED'
                        AND @permitirCerradoEnCurso = 1
                        AND EXISTS (
                            SELECT 1
                            FROM ExamAttempts a
                            WHERE a.StudentId = @studentId
                              AND a.ExamId = e.Id
                              AND a.Status = 'IN_PROGRESS'
                        )
                    )
                )
              AND (@examId IS NULL OR e.Id = @examId)
              AND EXISTS (
                  SELECT 1
                  FROM ExamGroups eg
                  JOIN ClassGroups g ON g.Id = eg.GroupId
                  JOIN GroupMembers gm ON gm.GroupId = g.Id
                  WHERE eg.ExamId = e.Id
                    AND g.IsActive = 1
                    AND gm.UserId = @studentId
                    AND gm.Status = 'ACTIVE'
              )
            ORDER BY e.Title
        `);

        return result.recordset;
    }
}

module.exports = ExamAccessService;
