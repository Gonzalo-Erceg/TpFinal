const sql = require('mssql');
const { pool } = require('../config/database');

class GroupsRepository {
    async existsByAccessCode(accessCode) {
        const db = await pool;

        const result = await db.request()
            .input('accessCode', sql.NVarChar(50), accessCode)
            .query('SELECT 1 AS found FROM ClassGroups WHERE AccessCode = @accessCode');

        return result.recordset.length > 0;
    }

    async courseBelongsToTeacher(courseId, teacherId) {
        const db = await pool;

        const result = await db.request()
            .input('courseId', sql.UniqueIdentifier, courseId)
            .input('teacherId', sql.UniqueIdentifier, teacherId)
            .query(`
                SELECT 1 AS found
                FROM Courses
                WHERE Id = @courseId AND TeacherId = @teacherId AND IsActive = 1
            `);

        return result.recordset.length > 0;
    }

    async create({ name, courseId, accessCode, teacherId }) {
        const db = await pool;

        const result = await db.request()
            .input('teacherId', sql.UniqueIdentifier, teacherId)
            .input('courseId', sql.UniqueIdentifier, courseId)
            .input('name', sql.NVarChar(150), name)
            .input('accessCode', sql.NVarChar(50), accessCode)
            .query(`
                INSERT INTO ClassGroups (TeacherId, CourseId, Name, AccessCode)
                OUTPUT INSERTED.Id
                VALUES (@teacherId, @courseId, @name, @accessCode)
            `);

        return result.recordset[0].Id;
    }

    async findByTeacher(teacherId, groupId = null) {
        const db = await pool;

        const request = db.request().input('teacherId', sql.UniqueIdentifier, teacherId);
        let groupFilter = '';

        if (groupId) {
            request.input('groupId', sql.UniqueIdentifier, groupId);
            groupFilter = 'AND g.Id = @groupId';
        }

        const result = await request.query(`
            SELECT
                g.Id,
                g.Name,
                g.AccessCode,
                c.Name AS CourseName
            FROM ClassGroups g
            LEFT JOIN Courses c ON c.Id = g.CourseId
            WHERE g.TeacherId = @teacherId
              AND g.IsActive = 1
              ${groupFilter}
            ORDER BY g.Name
        `);

        return result.recordset;
    }

    async findByStudent(studentId, groupId = null) {
        const db = await pool;

        const request = db.request().input('studentId', sql.UniqueIdentifier, studentId);
        let groupFilter = '';

        if (groupId) {
            request.input('groupId', sql.UniqueIdentifier, groupId);
            groupFilter = 'AND g.Id = @groupId';
        }

        const result = await request.query(`
            SELECT
                g.Id,
                g.Name,
                c.Name AS CourseName,
                t.FirstName AS TeacherFirstName,
                t.LastName AS TeacherLastName,
                gm.Status
            FROM GroupMembers gm
            INNER JOIN ClassGroups g ON g.Id = gm.GroupId
            INNER JOIN Users t ON t.Id = g.TeacherId
            LEFT JOIN Courses c ON c.Id = g.CourseId
            WHERE gm.UserId = @studentId
              AND g.IsActive = 1
              AND gm.Status <> 'REMOVED'
              ${groupFilter}
            ORDER BY g.Name
        `);

        return result.recordset;
    }

    async findActiveByAccessCode(accessCode) {
        const db = await pool;

        const result = await db.request()
            .input('accessCode', sql.NVarChar(50), accessCode)
            .query('SELECT Id FROM ClassGroups WHERE AccessCode = @accessCode AND IsActive = 1');

        return result.recordset[0] ?? null;
    }

    async findMembership(groupId, userId) {
        const db = await pool;

        const result = await db.request()
            .input('groupId', sql.UniqueIdentifier, groupId)
            .input('userId', sql.UniqueIdentifier, userId)
            .query('SELECT Status FROM GroupMembers WHERE GroupId = @groupId AND UserId = @userId');

        return result.recordset[0] ?? null;
    }

    async createMembership(groupId, userId) {
        const db = await pool;

        await db.request()
            .input('groupId', sql.UniqueIdentifier, groupId)
            .input('userId', sql.UniqueIdentifier, userId)
            .query('INSERT INTO GroupMembers (GroupId, UserId) VALUES (@groupId, @userId)');
    }

    // Devuelve la cantidad de filas modificadas; 0 si el estado cambió mientras tanto
    async reopenMembership(groupId, userId) {
        const db = await pool;

        const result = await db.request()
            .input('groupId', sql.UniqueIdentifier, groupId)
            .input('userId', sql.UniqueIdentifier, userId)
            .query(`
                UPDATE GroupMembers
                SET Status = 'PENDING',
                    RequestedAt = SYSUTCDATETIME(),
                    ReviewedAt = NULL,
                    ReviewedBy = NULL,
                    JoinedAt = NULL
                WHERE GroupId = @groupId
                  AND UserId = @userId
                  AND Status IN ('REJECTED', 'REMOVED')
            `);

        return result.rowsAffected[0];
    }
}

module.exports = GroupsRepository;