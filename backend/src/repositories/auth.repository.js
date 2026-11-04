const sql = require('mssql');
const { pool } = require('../config/database');

class AuthRepository {
    async findByEmail(email) {
        const db = await pool;

        const result = await db.request()
            .input('email', sql.NVarChar(255), email)
            .query(`
                SELECT
                    Id,
                    FirstName,
                    LastName,
                    Email,
                    PasswordHash,
                    IsActive
                FROM Users
                WHERE Email = @email
            `);

        return result.recordset[0] ?? null;
    }

    async create({ firstName, lastName, email, passwordHash, role }) {
        const db = await pool;

        const transaction = new sql.Transaction(db);

        await transaction.begin();

        try {
    
            const roleResult = await new sql.Request(transaction)
                .input('role', sql.NVarChar(50), role)
                .query(`
                    SELECT Id
                    FROM Roles
                    WHERE Name = @role
                `);

            if (roleResult.recordset.length === 0) {
                throw new Error(`El rol ${role} no existe en la base de datos`);
            }

            const roleId = roleResult.recordset[0].Id;

    
            const userResult = await new sql.Request(transaction)
                .input('firstName', sql.NVarChar(100), firstName)
                .input('lastName', sql.NVarChar(100), lastName)
                .input('email', sql.NVarChar(255), email)
                .input('passwordHash', sql.NVarChar(255), passwordHash)
                .query(`
                    INSERT INTO Users (
                        FirstName,
                        LastName,
                        Email,
                        PasswordHash
                    )
                    OUTPUT
                        INSERTED.Id,
                        INSERTED.FirstName,
                        INSERTED.LastName,
                        INSERTED.Email
                    VALUES (
                        @firstName,
                        @lastName,
                        @email,
                        @passwordHash
                    )
                `);

            const user = userResult.recordset[0];

            await new sql.Request(transaction)
                .input('userId', sql.UniqueIdentifier, user.Id)
                .input('roleId', sql.Int, roleId)
                .query(`
                    INSERT INTO UserRoles (UserId, RoleId)
                    VALUES (@userId, @roleId)
                `);

         
            await transaction.commit();

            return {
                ...user,
                Role: role
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

module.exports = AuthRepository;