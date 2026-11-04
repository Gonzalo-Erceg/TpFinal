# TP Final — Plataforma de Exámenes Online

Aplicación web para la creación, administración y realización de exámenes online. El sistema permite a profesores crear grupos, administrar alumnos, gestionar un banco de preguntas y diseñar exámenes. Los alumnos pueden incorporarse a grupos y realizar los exámenes disponibles.

## Tecnologías

- **Frontend:** Angular
- **Backend:** Node.js + Express
- **Base de datos:** Microsoft SQL Server
- **Contenedores:** Docker / Docker Compose
- **Arquitectura:** Monorepo con npm Workspaces

## Requisitos previos

Antes de ejecutar el proyecto, asegurate de tener instalado:

- [Node.js](https://nodejs.org/) (versión compatible con el proyecto).
- npm.
- [Docker](https://www.docker.com/) y Docker Compose.
- Git.

Podés verificar las instalaciones con:

```bash
node --version
npm --version
docker --version
docker compose version
```

## Estructura del proyecto

```text
TpFinal/
├── backend/             # API REST con Express
├── frontend/            # Aplicación Angular
├── packages/            # Paquetes compartidos
├── db/                  # Esquema de la base de datos
├── .env.example         # Plantilla de variables de entorno
├── .env                 # Variables locales (no versionado)
├── package.json         # Configuración del monorepo
└── docker-compose.yml   # Configuración de SQL Server
```

## Instalación

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd TpFinal
```

### 2. Instalar dependencias

El proyecto utiliza npm Workspaces, por lo que las dependencias se instalan desde la raíz del repositorio.

```bash
npm install
```

No es necesario ejecutar `npm install` individualmente dentro de `backend/` o `frontend/`.

### 3. Configurar variables de entorno

Copiar el archivo de ejemplo:

```bash
cp .env.example .env
```

**Importante:**

- No subir el archivo `.env` al repositorio.
- No compartir credenciales ni secretos.
- Si modificás `.env.example`, asegurate de documentar las nuevas variables para que el resto del equipo pueda configurar su entorno.

### 4. Levantar SQL Server con Docker

Desde la raíz del proyecto:

```bash
docker compose up -d
```

Comprobar que el contenedor esté funcionando:

```bash
docker compose ps
```

Para consultar los logs:

```bash
docker compose logs -f
```

La primera ejecución puede tardar unos minutos mientras SQL Server inicializa.

La API necesita que SQL Server esté disponible y que las credenciales configuradas en `.env` coincidan con las utilizadas por el contenedor.

### 5. Ejecutar el backend

Desde la raíz:

```bash
npm run dev:back
```

### 6. Ejecutar el frontend

En otra terminal, desde la raíz:

```bash
npm run dev:front
```

## Scripts disponibles

Los siguientes comandos están definidos en el `package.json` raíz:

| Comando             | Descripción                                       |
| ------------------- | ------------------------------------------------- |
| `npm install`       | Instala las dependencias de todos los workspaces. |
| `npm run dev:back`  | Ejecuta el backend en modo desarrollo.            |
| `npm run dev:front` | Ejecuta el frontend.                              |

## Base de datos

El proyecto utiliza Microsoft SQL Server como motor de base de datos.

El contenedor Docker permite que todos los integrantes del equipo trabajen con el mismo motor sin necesidad de instalar SQL Server directamente en sus sistemas operativos.

**Consideraciones:**

- Cada integrante debe levantar su propio contenedor local.
- La configuración de conexión se encuentra en `.env`.
- Las tablas deben crearse mediante las migraciones o scripts SQL del proyecto.
- Los datos locales no se comparten automáticamente entre integrantes.

Para detener SQL Server:

```bash
docker compose down
```

Para detenerlo y eliminar también los datos persistidos en el volumen:

```bash
docker compose down -v
```

**Advertencia:** el último comando elimina los datos de la base de datos local.

## Flujo de trabajo

Se utiliza Git para el control de versiones y GitHub para la colaboración.

Recomendaciones:

1. Crear una rama por funcionalidad o issue.
2. Mantener actualizada la rama de trabajo con los últimos cambios de `main`.
3. Realizar commits descriptivos.
4. Abrir Pull Requests para integrar cambios.
5. Revisar que el proyecto compile antes de aprobar un Pull Request.

Ejemplo:

```bash
git checkout -b feature/nombre-funcionalidad

git add .
git commit -m "feat: implementa funcionalidad"

git push -u origin feature/nombre-funcionalidad
```

## Problemas frecuentes

### No se puede conectar a SQL Server

Comprobar que el contenedor esté activo:

```bash
docker compose ps
```

Consultar los logs:

```bash
docker compose logs -f
```

Verificar que las credenciales y el puerto configurados en `.env` coincidan con Docker Compose.

### No se encuentran los módulos de Node

Desde la raíz del proyecto:

```bash
npm install
```

### El backend no encuentra las variables de entorno

Verificar que exista el archivo `.env` en la ubicación esperada por el backend y que las variables estén correctamente configuradas.

---
