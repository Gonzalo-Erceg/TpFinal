#!/usr/bin/env bash

set -euo pipefail

SQLCMD="${SQLCMD:-/opt/mssql-tools18/bin/sqlcmd}"
SERVER="${DB_SERVER:-sqlserver}"
PASSWORD="${MSSQL_SA_PASSWORD:?MSSQL_SA_PASSWORD no está definida}"
DB="${DB_NAME:-ExamPlatform}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/db/migrations}"

if [ ! -x "$SQLCMD" ]; then
    echo "ERROR: no se encontró sqlcmd en $SQLCMD" >&2
    exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "ERROR: no existe el directorio de migraciones $MIGRATIONS_DIR" >&2
    exit 1
fi

if [[ ! "$DB" =~ ^[A-Za-z0-9_]+$ ]]; then
    echo "ERROR: DB_NAME contiene caracteres no permitidos: $DB" >&2
    exit 1
fi

sql() {
    "$SQLCMD" -C -b -I -S "$SERVER" -U sa -P "$PASSWORD" "$@"
}

for attempt in $(seq 1 60); do
    if sql -Q "SELECT 1" >/dev/null 2>&1; then
        break
    fi

    if [ "$attempt" -eq 60 ]; then
        echo "ERROR: no se pudo conectar a SQL Server en $SERVER" >&2
        exit 1
    fi

    sleep 2
done

echo "Creando la base '$DB' si no existe..."
sql -Q "IF DB_ID(N'$DB') IS NULL CREATE DATABASE [$DB];"

echo "Asegurando la tabla de control de migraciones..."
sql -d "$DB" -Q "
IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SchemaMigrations (
        MigrationId NVARCHAR(255) NOT NULL
            CONSTRAINT PK_SchemaMigrations PRIMARY KEY,
        AppliedAt DATETIME2 NOT NULL
            CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME()
    );
END"

is_applied() {
    local migration_id="$1"

    sql -d "$DB" -h -1 -W -Q "
SET NOCOUNT ON;
SELECT CASE
    WHEN EXISTS (
        SELECT 1
        FROM dbo.SchemaMigrations
        WHERE MigrationId = N'$migration_id'
    ) THEN 1
    ELSE 0
END" | tr -d '[:space:]'
}

mark_applied() {
    local migration_id="$1"

    sql -d "$DB" -Q "
INSERT INTO dbo.SchemaMigrations (MigrationId)
VALUES (N'$migration_id');"
}

HAS_USERS="$(sql -d "$DB" -h -1 -W -Q "
SET NOCOUNT ON;
SELECT CASE
    WHEN OBJECT_ID(N'dbo.Users', N'U') IS NULL THEN 0
    ELSE 1
END" | tr -d '[:space:]')"

BASE_TABLES="$(sql -d "$DB" -h -1 -W -Q "
SET NOCOUNT ON;
SELECT COUNT(*)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name = N'dbo'
  AND t.name IN (
    N'Users',
    N'Roles',
    N'UserRoles',
    N'ClassGroups',
    N'GroupMembers',
    N'QuestionBankItems',
    N'QuestionRevisions',
    N'QuestionOptions',
    N'Exams',
    N'ExamVersions',
    N'ExamVersionQuestions',
    N'ExamGroups',
    N'ExamAttempts'
)" | tr -d '[:space:]')"

if [ "$HAS_USERS" = "1" ] && [ "$BASE_TABLES" != "13" ]; then
    echo "ERROR: la base existente no tiene el esquema base esperado ($BASE_TABLES/13 tablas)." >&2
    echo "Revisar el estado del esquema antes de aplicar migraciones." >&2
    exit 1
fi

if [ "$HAS_USERS" = "0" ]; then
    if [ "$(is_applied "001_schema.sql")" = "1" ]; then
        echo "ERROR: la tabla Users no existe pero 001_schema.sql figura como aplicada." >&2
        exit 1
    fi

    echo "Aplicando 001_schema.sql..."
    sql -d "$DB" -i "$MIGRATIONS_DIR/001_schema.sql"
    mark_applied "001_schema.sql"
    echo "001_schema.sql aplicada."
else
    if [ "$(is_applied "001_schema.sql")" = "0" ]; then
        echo "Base existente sin registro de 001_schema.sql; se registra como aplicada."
        mark_applied "001_schema.sql"
    fi
fi

while IFS= read -r file; do
    migration_id="$(basename "$file")"

    if [ "$migration_id" = "001_schema.sql" ]; then
        continue
    fi

    if [[ ! "$migration_id" =~ ^[A-Za-z0-9_.-]+$ ]]; then
        echo "ERROR: nombre de migración no permitido: $migration_id" >&2
        exit 1
    fi

    if [ "$(is_applied "$migration_id")" = "1" ]; then
        echo "Ya aplicada: $migration_id"
        continue
    fi

    echo "Aplicando $migration_id..."
    sql -d "$DB" -i "$file"
    mark_applied "$migration_id"
    echo "$migration_id aplicada."
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort)

echo "Migraciones al día en la base '$DB'."
