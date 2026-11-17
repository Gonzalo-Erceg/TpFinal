SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = N'dbo'
      AND t.name = N'ClassGroups'
      AND c.name = N'AccessCode'
      AND c.is_nullable = 1
)
BEGIN
    UPDATE dbo.ClassGroups
    SET AccessCode = UPPER(
        LEFT(
            CONVERT(varchar(64), HASHBYTES('MD5', CONVERT(varchar(36), Id)), 2),
            8
        )
    )
    WHERE AccessCode IS NULL;

    IF EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = N'UX_ClassGroups_AccessCode'
          AND object_id = OBJECT_ID(N'dbo.ClassGroups')
    )
    BEGIN
        DROP INDEX UX_ClassGroups_AccessCode ON dbo.ClassGroups;
    END

    ALTER TABLE dbo.ClassGroups
        ALTER COLUMN AccessCode NVARCHAR(50) NOT NULL;

    CREATE UNIQUE INDEX UX_ClassGroups_AccessCode
        ON dbo.ClassGroups (AccessCode);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.objects
    WHERE object_id = OBJECT_ID(N'dbo.UQ_ExamVersions_Exam_Id')
      AND type = N'UQ'
)
BEGIN
    ALTER TABLE dbo.ExamVersions
        ADD CONSTRAINT UQ_ExamVersions_Exam_Id UNIQUE (ExamId, Id);
END
GO

IF EXISTS (
    SELECT 1
    FROM dbo.Exams e
    JOIN dbo.ExamVersions v ON v.Id = e.CurrentVersionId
    WHERE v.ExamId <> e.Id
)
BEGIN
    ;THROW 50010, N'Existen exámenes cuyo CurrentVersionId pertenece a otro examen. Corregir los datos antes de aplicar la migración.', 1;
END
GO

IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_Exams_CurrentVersion'
      AND parent_object_id = OBJECT_ID(N'dbo.Exams')
)
BEGIN
    ALTER TABLE dbo.Exams DROP CONSTRAINT FK_Exams_CurrentVersion;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_Exams_CurrentVersion_SameExam'
      AND parent_object_id = OBJECT_ID(N'dbo.Exams')
)
BEGIN
    ALTER TABLE dbo.Exams
        ADD CONSTRAINT FK_Exams_CurrentVersion_SameExam
        FOREIGN KEY (Id, CurrentVersionId)
        REFERENCES dbo.ExamVersions (ExamId, Id);
END
GO

IF EXISTS (
    SELECT 1
    FROM dbo.ExamAttempts a
    JOIN dbo.ExamVersions v ON v.Id = a.ExamVersionId
    WHERE v.ExamId <> a.ExamId
)
BEGIN
    ;THROW 50011, N'Existen intentos cuya versión pertenece a otro examen. Corregir los datos antes de aplicar la migración.', 1;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_ExamAttempts_ExamVersion_SameExam'
      AND parent_object_id = OBJECT_ID(N'dbo.ExamAttempts')
)
BEGIN
    ALTER TABLE dbo.ExamAttempts
        ADD CONSTRAINT FK_ExamAttempts_ExamVersion_SameExam
        FOREIGN KEY (ExamId, ExamVersionId)
        REFERENCES dbo.ExamVersions (ExamId, Id);
END
GO

IF EXISTS (
    SELECT 1
    FROM dbo.ExamGroups eg
    JOIN dbo.Exams e ON e.Id = eg.ExamId
    JOIN dbo.ClassGroups g ON g.Id = eg.GroupId
    WHERE e.TeacherId <> g.TeacherId
)
BEGIN
    ;THROW 50013, N'Existen exámenes asignados a grupos de otro docente. Corregir los datos antes de aplicar la migración.', 1;
END
GO

CREATE OR ALTER TRIGGER dbo.TR_ExamGroups_SameTeacher
ON dbo.ExamGroups
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Exams e ON e.Id = i.ExamId
        JOIN dbo.ClassGroups g ON g.Id = i.GroupId
        WHERE e.TeacherId <> g.TeacherId
    )
    BEGIN
        ;THROW 50012, N'El examen y el grupo deben pertenecer al mismo docente.', 1;
    END
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Exams_Status_Window'
      AND object_id = OBJECT_ID(N'dbo.Exams')
)
BEGIN
    CREATE INDEX IX_Exams_Status_Window
        ON dbo.Exams (Status, OpensAt, ClosesAt);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_ExamAttempts_Student_Exam_Status'
      AND object_id = OBJECT_ID(N'dbo.ExamAttempts')
)
BEGIN
    CREATE INDEX IX_ExamAttempts_Student_Exam_Status
        ON dbo.ExamAttempts (StudentId, ExamId, Status);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_GroupMembers_Group_Status'
      AND object_id = OBJECT_ID(N'dbo.GroupMembers')
)
BEGIN
    CREATE INDEX IX_GroupMembers_Group_Status
        ON dbo.GroupMembers (GroupId, Status);
END
GO

COMMIT TRANSACTION;
GO
