const sql = require("mssql")
console.log(process.env.DB_HOST)
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: Number(process.env.MSSQL_PORT || 1433),
    options: {
        encrypt: false,
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true"
    }
};
exports.pool = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Connected to SQL Server');
        return pool;
    });