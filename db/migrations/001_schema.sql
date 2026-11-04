




CREATE TABLE Users (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY
                CONSTRAINT DF_Users_Id DEFAULT NEWSEQUENTIALID(),
    FirstName   NVARCHAR(100) NOT NULL,
    LastName    NVARCHAR(100) NOT NULL,
    Email       NVARCHAR(255) NOT NULL CONSTRAINT UQ_Users_Email UNIQUE, 
    PasswordHash NVARCHAR(255) NULL,
    IsActive    BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    CreatedAt   DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2 NULL
);






CREATE TABLE Roles (
    Id    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    Name  NVARCHAR(50) NOT NULL CONSTRAINT UQ_Roles_Name UNIQUE
);

INSERT INTO Roles (Name) VALUES (N'ADMIN'), (N'TEACHER'), (N'STUDENT');

CREATE TABLE UserRoles (
    UserId  UNIQUEIDENTIFIER NOT NULL,
    RoleId  INT NOT NULL,
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_User FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_UserRoles_Role FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

CREATE TABLE ExternalIdentities (
    Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ExternalIdentities PRIMARY KEY
               CONSTRAINT DF_ExternalIdentities_Id DEFAULT NEWSEQUENTIALID(),
    UserId     UNIQUEIDENTIFIER NOT NULL,
    Issuer     NVARCHAR(450) NOT NULL,  
    Subject    NVARCHAR(255) NOT NULL,
    Provider   NVARCHAR(50)  NOT NULL, 
    CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_ExternalIdentities_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ExternalIdentities_User FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT UQ_ExternalIdentities_IssuerSubject UNIQUE (Issuer, Subject)
);
CREATE INDEX IX_ExternalIdentities_UserId ON ExternalIdentities(UserId);


CREATE TABLE StorageObjects (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_StorageObjects PRIMARY KEY
                 CONSTRAINT DF_StorageObjects_Id DEFAULT NEWSEQUENTIALID(),
    OwnerId      UNIQUEIDENTIFIER NOT NULL,
    Provider     NVARCHAR(30)  NOT NULL, 
    Bucket       NVARCHAR(200) NULL,
    ObjectKey    NVARCHAR(500) NOT NULL,
    FileName     NVARCHAR(255) NOT NULL,
    ContentType  NVARCHAR(150) NULL,
    SizeBytes    BIGINT NOT NULL,
    Sha256       CHAR(64) NULL,
    CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_StorageObjects_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_StorageObjects_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id),
    CONSTRAINT CK_StorageObjects_Size CHECK (SizeBytes >= 0)
);
CREATE INDEX IX_StorageObjects_OwnerId ON StorageObjects(OwnerId);



CREATE TABLE Courses (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Courses PRIMARY KEY
                 CONSTRAINT DF_Courses_Id DEFAULT NEWSEQUENTIALID(),
    TeacherId    UNIQUEIDENTIFIER NOT NULL,
    Name         NVARCHAR(150) NOT NULL,
    Description  NVARCHAR(MAX) NULL,
    IsActive     BIT NOT NULL CONSTRAINT DF_Courses_IsActive DEFAULT 1,
    CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_Courses_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Courses_Teacher FOREIGN KEY (TeacherId) REFERENCES Users(Id)
);
CREATE INDEX IX_Courses_TeacherId ON Courses(TeacherId);


CREATE TABLE ClassGroups (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ClassGroups PRIMARY KEY
                CONSTRAINT DF_ClassGroups_Id DEFAULT NEWSEQUENTIALID(),
    CourseId    UNIQUEIDENTIFIER NULL,         
    TeacherId   UNIQUEIDENTIFIER NOT NULL,      
    Name        NVARCHAR(150) NOT NULL,
    AccessCode  NVARCHAR(50) NULL,             
    IsActive    BIT NOT NULL CONSTRAINT DF_ClassGroups_IsActive DEFAULT 1,
    CreatedAt   DATETIME2 NOT NULL CONSTRAINT DF_ClassGroups_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ClassGroups_Course  FOREIGN KEY (CourseId)  REFERENCES Courses(Id),
    CONSTRAINT FK_ClassGroups_Teacher FOREIGN KEY (TeacherId) REFERENCES Users(Id)
);



CREATE UNIQUE INDEX UX_ClassGroups_AccessCode ON ClassGroups(AccessCode) WHERE AccessCode IS NOT NULL;
CREATE INDEX IX_ClassGroups_TeacherId ON ClassGroups(TeacherId);
CREATE INDEX IX_ClassGroups_CourseId  ON ClassGroups(CourseId);

CREATE TABLE GroupMembers (
    GroupId      UNIQUEIDENTIFIER NOT NULL,
    UserId       UNIQUEIDENTIFIER NOT NULL,
    Status       NVARCHAR(20) NOT NULL CONSTRAINT DF_GroupMembers_Status DEFAULT 'PENDING',
    RequestedAt  DATETIME2 NOT NULL CONSTRAINT DF_GroupMembers_RequestedAt DEFAULT SYSUTCDATETIME(),
    ReviewedAt   DATETIME2 NULL,
    ReviewedBy   UNIQUEIDENTIFIER NULL,
    JoinedAt     DATETIME2 NULL,                
    CONSTRAINT PK_GroupMembers PRIMARY KEY (GroupId, UserId),
    CONSTRAINT FK_GroupMembers_Group    FOREIGN KEY (GroupId)    REFERENCES ClassGroups(Id),
    CONSTRAINT FK_GroupMembers_User     FOREIGN KEY (UserId)     REFERENCES Users(Id),
    CONSTRAINT FK_GroupMembers_Reviewer FOREIGN KEY (ReviewedBy) REFERENCES Users(Id),
    CONSTRAINT CK_GroupMembers_Status CHECK (Status IN ('PENDING','ACTIVE','REJECTED','REMOVED'))
);
CREATE INDEX IX_GroupMembers_UserId ON GroupMembers(UserId, Status);


CREATE TABLE QuestionBankItems (
    Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_QuestionBankItems PRIMARY KEY
               CONSTRAINT DF_QuestionBankItems_Id DEFAULT NEWSEQUENTIALID(),
    OwnerId    UNIQUEIDENTIFIER NOT NULL,
    Title      NVARCHAR(200) NULL,
    IsActive   BIT NOT NULL CONSTRAINT DF_QuestionBankItems_IsActive DEFAULT 1,
    CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_QuestionBankItems_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_QuestionBankItems_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id)
);
CREATE INDEX IX_QuestionBankItems_OwnerId ON QuestionBankItems(OwnerId, IsActive);

CREATE TABLE QuestionRevisions (
    Id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_QuestionRevisions PRIMARY KEY
                       CONSTRAINT DF_QuestionRevisions_Id DEFAULT NEWSEQUENTIALID(),
    QuestionId         UNIQUEIDENTIFIER NOT NULL,
    RevisionNumber     INT NOT NULL,
    QuestionType       NVARCHAR(40) NOT NULL,
    Statement          NVARCHAR(MAX) NOT NULL,   
    ContentJson        NVARCHAR(MAX) NULL,
    GradingConfigJson  NVARCHAR(MAX) NULL,
    CreatedAt          DATETIME2 NOT NULL CONSTRAINT DF_QuestionRevisions_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_QuestionRevisions_Question FOREIGN KEY (QuestionId) REFERENCES QuestionBankItems(Id),
    CONSTRAINT UQ_QuestionRevisions_Number UNIQUE (QuestionId, RevisionNumber),
    CONSTRAINT CK_QuestionRevisions_ContentJson  CHECK (ContentJson IS NULL OR ISJSON(ContentJson) = 1),
    CONSTRAINT CK_QuestionRevisions_GradingJson  CHECK (GradingConfigJson IS NULL OR ISJSON(GradingConfigJson) = 1),
    CONSTRAINT CK_QuestionRevisions_Type CHECK (QuestionType IN (
        'SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','SHORT_TEXT',
        'ESSAY','MATCHING','ORDERING','FILE_UPLOAD'))
);

CREATE TABLE QuestionOptions (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_QuestionOptions PRIMARY KEY
                        CONSTRAINT DF_QuestionOptions_Id DEFAULT NEWSEQUENTIALID(),
    QuestionRevisionId  UNIQUEIDENTIFIER NOT NULL,
    Content             NVARCHAR(MAX) NOT NULL,
    Position            INT NOT NULL,                  
    CreditFraction      DECIMAL(8,4) NOT NULL CONSTRAINT DF_QuestionOptions_Credit DEFAULT 0,
    CONSTRAINT FK_QuestionOptions_Revision FOREIGN KEY (QuestionRevisionId) REFERENCES QuestionRevisions(Id),
    CONSTRAINT UQ_QuestionOptions_Position UNIQUE (QuestionRevisionId, Position),
    CONSTRAINT CK_QuestionOptions_Credit CHECK (CreditFraction BETWEEN -1 AND 1)
);



CREATE TABLE Exams (
    Id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Exams PRIMARY KEY
                         CONSTRAINT DF_Exams_Id DEFAULT NEWSEQUENTIALID(),
    TeacherId            UNIQUEIDENTIFIER NOT NULL,
    Title                NVARCHAR(200) NOT NULL,
    Description          NVARCHAR(MAX) NULL,

    Status               NVARCHAR(20) NOT NULL CONSTRAINT DF_Exams_Status DEFAULT 'DRAFT',
    CurrentVersionId     UNIQUEIDENTIFIER NULL,       

    PublishAt            DATETIME2 NULL,
    OpensAt              DATETIME2 NULL,
    ClosesAt             DATETIME2 NULL,
    DurationMinutes      INT NULL,


    MaxAttempts          INT NULL,                    
    AttemptsScope        NVARCHAR(10) NOT NULL CONSTRAINT DF_Exams_AttemptsScope DEFAULT 'EXAM',


    ShuffleQuestions     BIT NOT NULL CONSTRAINT DF_Exams_ShuffleQuestions DEFAULT 0,
    ShuffleOptions       BIT NOT NULL CONSTRAINT DF_Exams_ShuffleOptions   DEFAULT 0,

  
    ResultsReleaseMode   NVARCHAR(15) NOT NULL CONSTRAINT DF_Exams_ReleaseMode DEFAULT 'MANUAL',
    ResultsReleasedAt    DATETIME2 NULL,                
    ShowCorrectAnswers   BIT NOT NULL CONSTRAINT DF_Exams_ShowCorrect DEFAULT 0,

    CreatedAt            DATETIME2 NOT NULL CONSTRAINT DF_Exams_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt            DATETIME2 NULL,
    RowVersion           ROWVERSION NOT NULL,

    CONSTRAINT FK_Exams_Teacher FOREIGN KEY (TeacherId) REFERENCES Users(Id),
    CONSTRAINT CK_Exams_Status CHECK (Status IN ('DRAFT','SCHEDULED','PUBLISHED','CLOSED')),
    CONSTRAINT CK_Exams_AttemptsScope CHECK (AttemptsScope IN ('EXAM','VERSION')),
    CONSTRAINT CK_Exams_ReleaseMode CHECK (ResultsReleaseMode IN ('IMMEDIATE','ON_CLOSE','MANUAL')),
    CONSTRAINT CK_Exams_MaxAttempts CHECK (MaxAttempts IS NULL OR MaxAttempts > 0),
    CONSTRAINT CK_Exams_Duration CHECK (DurationMinutes IS NULL OR DurationMinutes > 0),
    CONSTRAINT CK_Exams_Window CHECK (OpensAt IS NULL OR ClosesAt IS NULL OR OpensAt < ClosesAt)
);
CREATE INDEX IX_Exams_TeacherId ON Exams(TeacherId, Status);

CREATE TABLE ExamVersions (
    Id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ExamVersions PRIMARY KEY
                   CONSTRAINT DF_ExamVersions_Id DEFAULT NEWSEQUENTIALID(),
    ExamId         UNIQUEIDENTIFIER NOT NULL,
    VersionNumber  INT NOT NULL,
    Status         NVARCHAR(15) NOT NULL CONSTRAINT DF_ExamVersions_Status DEFAULT 'DRAFT',
    PublishedAt    DATETIME2 NULL,
    CreatedAt      DATETIME2 NOT NULL CONSTRAINT DF_ExamVersions_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ExamVersions_Exam FOREIGN KEY (ExamId) REFERENCES Exams(Id),
    CONSTRAINT UQ_ExamVersions_Number UNIQUE (ExamId, VersionNumber),
    CONSTRAINT CK_ExamVersions_Status CHECK (Status IN ('DRAFT','PUBLISHED','ARCHIVED'))
);

CREATE UNIQUE INDEX UX_ExamVersions_OnePublished ON ExamVersions(ExamId) WHERE Status = 'PUBLISHED';

ALTER TABLE Exams
    ADD CONSTRAINT FK_Exams_CurrentVersion FOREIGN KEY (CurrentVersionId) REFERENCES ExamVersions(Id);

CREATE TABLE ExamVersionQuestions (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ExamVersionQuestions PRIMARY KEY
                        CONSTRAINT DF_ExamVersionQuestions_Id DEFAULT NEWSEQUENTIALID(),
    ExamVersionId       UNIQUEIDENTIFIER NOT NULL,
    QuestionRevisionId  UNIQUEIDENTIFIER NOT NULL,
    Position            INT NOT NULL,                   -- orden "canonico" del examen
    Points              DECIMAL(10,2) NOT NULL,
    CONSTRAINT FK_EVQ_Version  FOREIGN KEY (ExamVersionId)      REFERENCES ExamVersions(Id),
    CONSTRAINT FK_EVQ_Revision FOREIGN KEY (QuestionRevisionId) REFERENCES QuestionRevisions(Id),
    CONSTRAINT UQ_EVQ_Position UNIQUE (ExamVersionId, Position),
    CONSTRAINT UQ_EVQ_Revision UNIQUE (ExamVersionId, QuestionRevisionId),
    CONSTRAINT CK_EVQ_Points CHECK (Points >= 0)
);
CREATE INDEX IX_EVQ_QuestionRevisionId ON ExamVersionQuestions(QuestionRevisionId);

CREATE TABLE ExamGroups (
    ExamId      UNIQUEIDENTIFIER NOT NULL,
    GroupId     UNIQUEIDENTIFIER NOT NULL,
    AssignedAt  DATETIME2 NOT NULL CONSTRAINT DF_ExamGroups_AssignedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ExamGroups PRIMARY KEY (ExamId, GroupId),
    CONSTRAINT FK_ExamGroups_Exam  FOREIGN KEY (ExamId)  REFERENCES Exams(Id),
    CONSTRAINT FK_ExamGroups_Group FOREIGN KEY (GroupId) REFERENCES ClassGroups(Id)
);
CREATE INDEX IX_ExamGroups_GroupId ON ExamGroups(GroupId);



CREATE TABLE ExamAttempts (
    Id                     UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ExamAttempts PRIMARY KEY
                           CONSTRAINT DF_ExamAttempts_Id DEFAULT NEWSEQUENTIALID(),
    ExamId                 UNIQUEIDENTIFIER NOT NULL,   
    ExamVersionId          UNIQUEIDENTIFIER NOT NULL,
    StudentId              UNIQUEIDENTIFIER NOT NULL,

    ExamAttemptNumber      INT NOT NULL,                
    VersionAttemptNumber   INT NOT NULL,               

    Status                 NVARCHAR(30) NOT NULL CONSTRAINT DF_ExamAttempts_Status DEFAULT 'IN_PROGRESS',

    StartedAt              DATETIME2 NOT NULL CONSTRAINT DF_ExamAttempts_StartedAt DEFAULT SYSUTCDATETIME(),
    DeadlineAt             DATETIME2 NOT NULL,         
    SubmittedAt            DATETIME2 NULL,
    IsAutoSubmitted        BIT NOT NULL CONSTRAINT DF_ExamAttempts_AutoSubmitted DEFAULT 0,

    TotalScore             DECIMAL(10,2) NULL,         
    MaxScore               DECIMAL(10,2) NULL,
    GradedAt               DATETIME2 NULL,

    RowVersion             ROWVERSION NOT NULL,

    CONSTRAINT FK_ExamAttempts_Exam    FOREIGN KEY (ExamId)        REFERENCES Exams(Id),
    CONSTRAINT FK_ExamAttempts_Version FOREIGN KEY (ExamVersionId) REFERENCES ExamVersions(Id),
    CONSTRAINT FK_ExamAttempts_Student FOREIGN KEY (StudentId)     REFERENCES Users(Id),
    CONSTRAINT UQ_ExamAttempts_ExamNumber    UNIQUE (ExamId, StudentId, ExamAttemptNumber),
    CONSTRAINT UQ_ExamAttempts_VersionNumber UNIQUE (ExamVersionId, StudentId, VersionAttemptNumber),
    CONSTRAINT CK_ExamAttempts_Status CHECK (Status IN
        ('IN_PROGRESS','SUBMITTED','GRADING','GRADED','CANCELLED'))
);
CREATE INDEX IX_ExamAttempts_Student ON ExamAttempts(StudentId, ExamVersionId);
CREATE INDEX IX_ExamAttempts_Exam    ON ExamAttempts(ExamId, Status);
CREATE INDEX IX_ExamAttempts_Version ON ExamAttempts(ExamVersionId, Status);

CREATE INDEX IX_ExamAttempts_Deadline ON ExamAttempts(DeadlineAt) WHERE Status = 'IN_PROGRESS';


CREATE TABLE AttemptAnswers (
    Id                      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AttemptAnswers PRIMARY KEY
                            CONSTRAINT DF_AttemptAnswers_Id DEFAULT NEWSEQUENTIALID(),
    AttemptId               UNIQUEIDENTIFIER NOT NULL,
    ExamVersionQuestionId   UNIQUEIDENTIFIER NOT NULL,

    DisplayOrder            INT NOT NULL,              
    OptionOrderJson         NVARCHAR(MAX) NULL,         

    ResponseText            NVARCHAR(MAX) NULL,
    ResponseJson            NVARCHAR(MAX) NULL,         
    AnsweredAt              DATETIME2 NULL,

    GradingStatus           NVARCHAR(20) NOT NULL CONSTRAINT DF_AttemptAnswers_GradingStatus DEFAULT 'PENDING',
    RowVersion              ROWVERSION NOT NULL,        

    CONSTRAINT FK_AttemptAnswers_Attempt  FOREIGN KEY (AttemptId) REFERENCES ExamAttempts(Id),
    CONSTRAINT FK_AttemptAnswers_Question FOREIGN KEY (ExamVersionQuestionId) REFERENCES ExamVersionQuestions(Id),
    CONSTRAINT UQ_AttemptAnswers_Question UNIQUE (AttemptId, ExamVersionQuestionId),
    CONSTRAINT UQ_AttemptAnswers_Order    UNIQUE (AttemptId, DisplayOrder),
    CONSTRAINT CK_AttemptAnswers_ResponseJson CHECK (ResponseJson IS NULL OR ISJSON(ResponseJson) = 1),
    CONSTRAINT CK_AttemptAnswers_OptionOrder  CHECK (OptionOrderJson IS NULL OR ISJSON(OptionOrderJson) = 1),
    CONSTRAINT CK_AttemptAnswers_GradingStatus CHECK (GradingStatus IN
        ('PENDING','AUTO_GRADED','MANUAL_REVIEW','GRADED'))
);

CREATE INDEX IX_AttemptAnswers_Question ON AttemptAnswers(ExamVersionQuestionId);
CREATE INDEX IX_AttemptAnswers_Review   ON AttemptAnswers(GradingStatus) WHERE GradingStatus = 'MANUAL_REVIEW';

CREATE TABLE AttemptAnswerOptions (
    AnswerId  UNIQUEIDENTIFIER NOT NULL,
    OptionId  UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_AttemptAnswerOptions PRIMARY KEY (AnswerId, OptionId),
    CONSTRAINT FK_AAO_Answer FOREIGN KEY (AnswerId) REFERENCES AttemptAnswers(Id),
    CONSTRAINT FK_AAO_Option FOREIGN KEY (OptionId) REFERENCES QuestionOptions(Id)
);
CREATE INDEX IX_AAO_OptionId ON AttemptAnswerOptions(OptionId);

CREATE TABLE AnswerFiles (
    AnswerId         UNIQUEIDENTIFIER NOT NULL,
    StorageObjectId  UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_AnswerFiles PRIMARY KEY (AnswerId, StorageObjectId),
    CONSTRAINT FK_AnswerFiles_Answer  FOREIGN KEY (AnswerId)        REFERENCES AttemptAnswers(Id),
    CONSTRAINT FK_AnswerFiles_Storage FOREIGN KEY (StorageObjectId) REFERENCES StorageObjects(Id)
);
CREATE INDEX IX_AnswerFiles_StorageObjectId ON AnswerFiles(StorageObjectId);

CREATE TABLE AnswerGrades (
    Id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AnswerGrades PRIMARY KEY
                   CONSTRAINT DF_AnswerGrades_Id DEFAULT NEWSEQUENTIALID(),
    AnswerId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_AnswerGrades_Answer UNIQUE,
    AwardedPoints  DECIMAL(10,2) NOT NULL,     
    GradingMethod  NVARCHAR(20) NOT NULL,
    GraderId       UNIQUEIDENTIFIER NULL,    
    GradedAt       DATETIME2 NOT NULL CONSTRAINT DF_AnswerGrades_GradedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AnswerGrades_Answer FOREIGN KEY (AnswerId) REFERENCES AttemptAnswers(Id),
    CONSTRAINT FK_AnswerGrades_Grader FOREIGN KEY (GraderId) REFERENCES Users(Id),
    CONSTRAINT CK_AnswerGrades_Method CHECK (GradingMethod IN ('AUTOMATIC','MANUAL'))
);
CREATE INDEX IX_AnswerGrades_GraderId ON AnswerGrades(GraderId);


CREATE TABLE AttemptEventTypes (
    Code         NVARCHAR(80) NOT NULL CONSTRAINT PK_AttemptEventTypes PRIMARY KEY,
    Description  NVARCHAR(200) NULL,
    IsSuspicious BIT NOT NULL CONSTRAINT DF_AttemptEventTypes_Suspicious DEFAULT 0
);

INSERT INTO AttemptEventTypes (Code, Description, IsSuspicious) VALUES
 (N'ATTEMPT_STARTED',   N'Inicio del intento', 0),
 (N'ANSWER_SAVED',      N'Respuesta guardada', 0),
 (N'HEARTBEAT',         N'Latido de conexion', 0),
 (N'ATTEMPT_SUBMITTED', N'Entrega manual', 0),
 (N'AUTO_SUBMITTED',    N'Entrega automatica por vencimiento', 0),
 (N'TAB_BLUR',          N'El alumno salio de la pestana/ventana', 1),
 (N'TAB_FOCUS',         N'El alumno volvio a la pestana/ventana', 0),
 (N'FULLSCREEN_ENTER',  N'Entro a pantalla completa', 0),
 (N'FULLSCREEN_EXIT',   N'Salio de pantalla completa', 1),
 (N'COPY',              N'Copiar', 1),
 (N'CUT',               N'Cortar', 1),
 (N'PASTE',             N'Pegar', 1),
 (N'CONTEXT_MENU',      N'Menu contextual', 1),
 (N'NETWORK_OFFLINE',   N'Se perdio la conexion', 0),
 (N'NETWORK_ONLINE',    N'Se recupero la conexion', 0);


CREATE TABLE AttemptEvents (
    Id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AttemptEvents PRIMARY KEY,
    AttemptId        UNIQUEIDENTIFIER NOT NULL,
    EventType        NVARCHAR(80) NOT NULL,
    OccurredAt       DATETIME2 NOT NULL CONSTRAINT DF_AttemptEvents_OccurredAt DEFAULT SYSUTCDATETIME(), -- hora del servidor
    ClientOccurredAt DATETIME2 NULL,                                                                      -- hora reportada por el cliente
    DetailsJson      NVARCHAR(MAX) NULL,
    IpAddress        VARCHAR(45) NULL,
    UserAgent        NVARCHAR(500) NULL,
    CONSTRAINT FK_AttemptEvents_Attempt FOREIGN KEY (AttemptId) REFERENCES ExamAttempts(Id),
    CONSTRAINT FK_AttemptEvents_Type    FOREIGN KEY (EventType) REFERENCES AttemptEventTypes(Code),
    CONSTRAINT CK_AttemptEvents_Details CHECK (DetailsJson IS NULL OR ISJSON(DetailsJson) = 1)
);
CREATE INDEX IX_AttemptEvents_Attempt ON AttemptEvents(AttemptId, OccurredAt);
GO


CREATE TRIGGER TR_ExamVersionQuestions_Immutable
ON ExamVersionQuestions
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM ExamVersions v
        WHERE v.Status <> 'DRAFT'
          AND v.Id IN (SELECT ExamVersionId FROM inserted
                       UNION
                       SELECT ExamVersionId FROM deleted)
    )
        THROW 50001, 'No se pueden modificar las preguntas de una version publicada o archivada. Cree una version nueva.', 1;
END;
GO


CREATE TRIGGER TR_QuestionRevisions_Immutable
ON QuestionRevisions
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM ExamVersionQuestions evq
        WHERE evq.QuestionRevisionId IN (SELECT Id FROM deleted)
    )
        THROW 50002, 'La revision de pregunta ya esta usada en un examen. Cree una revision nueva.', 1;
END;
GO









