# Contrato de exámenes e intentos

Documento de referencia para el backend y el frontend. Define el alcance del flujo de exámenes, los estados, los DTOs y las reglas de autorización que deben implementarse.

> Estado: contrato de trabajo para las etapas P0 y P1. El flujo docente, el flujo del alumno y la corrección automática con liberación de resultados están implementados (backend y frontend). La revisión manual de preguntas de desarrollo queda pendiente.

## 1. Alcance

Este contrato cubre:

- Creación, edición, asignación a grupos y publicación de exámenes por parte del docente.
- Listado de exámenes disponibles para el alumno.
- Inicio de un intento, guardado de respuestas y entrega.
- Consulta de resultados según la configuración del examen.

Queda fuera de esta primera etapa:

- Corrección manual de preguntas de desarrollo.
- Carga de archivos.
- Tipos de pregunta avanzados (`MATCHING`, `ORDERING`, `FILE_UPLOAD`, `ESSAY`).
- Eventos anti-cheat y analítica.

## 2. Roles

| Rol | Puede |
|---|---|
| `TEACHER` | Crear y administrar sus propios exámenes, preguntas y grupos. Asignar exámenes a sus grupos. Publicar y cerrar exámenes. |
| `STUDENT` | Ver y rendir exámenes publicados de los grupos a los que pertenece con membresía `ACTIVE`. Consultar sus propios intentos y resultados liberados. |
| `ADMIN` | Sin funcionalidad en esta etapa. |

Reglas generales:

- El docente solo accede a exámenes cuyo `TeacherId` coincide con su usuario.
- El alumno solo accede a exámenes vinculados a grupos donde tiene membresía `ACTIVE`.
- Un recurso ajeno o inexistente responde `404`, no `403`, para evitar enumeración.
- El rol se valida en el backend. Los guards de Angular son solo una ayuda de navegación.

## 3. Estados

### 3.1 Estado del examen (`Exams.Status`)

| Estado | Significado |
|---|---|
| `DRAFT` | En preparación. No visible para alumnos. |
| `SCHEDULED` | Publicado pero con `PublishAt` futuro. Aún no visible o no rendible. |
| `PUBLISHED` | Publicado y disponible según su ventana. |
| `CLOSED` | Cerrado. No admite nuevos intentos. |

### 3.2 Estado de la versión (`ExamVersions.Status`)

| Estado | Significado |
|---|---|
| `DRAFT` | Versión editable. |
| `PUBLISHED` | Versión visible para alumnos. Inmutable. |
| `ARCHIVED` | Versión reemplazada por una publicación posterior. Inmutable. |

Solo puede existir una versión `PUBLISHED` por examen (índice único filtrado existente).

### 3.3 Semántica de `Exams.CurrentVersionId`

Para esta etapa se adopta la siguiente regla, compatible con el esquema actual:

- `CurrentVersionId` apunta a la **última versión de trabajo** del examen (puede ser `DRAFT` o `PUBLISHED`).
- La versión visible para alumnos es siempre la que tiene `ExamVersions.Status = 'PUBLISHED'`.
- En esta etapa, un examen solo se puede editar mientras su versión de trabajo esté en `DRAFT`. Un examen publicado responde `409`.
- La clonación de una versión publicada a una nueva versión `DRAFT` (para editar un examen ya publicado) queda para una etapa posterior.
- Al publicar la versión de trabajo, en una sola transacción: se archiva la versión publicada anterior si existe, se marca la nueva como `PUBLISHED`, se actualiza `CurrentVersionId` y se actualiza el estado del examen.

Si en el futuro esta semántica genera ambigüedad, se podrá agregar `PublishedVersionId` como columna explícita. No es necesaria para el alcance P0.

### 3.4 Fechas

| Campo | Significado |
|---|---|
| `PublishAt` | Momento desde el cual el examen puede ser visto por los alumnos. Si es `NULL`, se considera visible al publicarse. |
| `OpensAt` | Inicio de la ventana de rendición. Si es `NULL`, no hay restricción de inicio. |
| `ClosesAt` | Fin de la ventana de rendición. Si es `NULL`, no hay restricción de cierre. |
| `DurationMinutes` | Duración máxima de cada intento. Si es `NULL`, el intento termina con `ClosesAt` o no tiene límite propio. |
| `DeadlineAt` | Fecha límite calculada por el servidor para un intento concreto. |

Todas las fechas se intercambian en ISO 8601 UTC (`2026-11-17T18:30:00.000Z`) y se persisten en UTC.

### 3.5 Estado del intento (`ExamAttempts.Status`)

| Estado | Significado |
|---|---|
| `IN_PROGRESS` | El alumno puede responder. |
| `SUBMITTED` | Entregado, pendiente de corrección. |
| `GRADING` | En corrección. |
| `GRADED` | Corregido. |
| `CANCELLED` | Anulado. No cuenta para el máximo de intentos. |

## 4. DTOs

### 4.1 Resumen de examen para docente

```json
{
  "id": "uuid",
  "title": "Primer parcial",
  "description": "Unidades 1 a 3",
  "status": "DRAFT",
  "currentVersionId": "uuid",
  "currentVersionStatus": "DRAFT",
  "publishAt": null,
  "opensAt": "2026-11-20T12:00:00.000Z",
  "closesAt": "2026-11-20T14:00:00.000Z",
  "durationMinutes": 90,
  "maxAttempts": 1,
  "attemptsScope": "EXAM",
  "groupIds": ["uuid"],
  "questionCount": 10,
  "attemptCount": 24,
  "resultsReleaseMode": "MANUAL",
  "resultsReleasedAt": null,
  "showCorrectAnswers": false,
  "createdAt": "2026-11-17T10:00:00.000Z",
  "updatedAt": "2026-11-17T10:30:00.000Z"
}
```

### 4.2 Detalle de examen para docente

Incluye todo lo del resumen más:

```json
{
  "currentVersionNumber": 1,
  "groups": [
    { "id": "uuid", "name": "Comisión A", "accessCode": "ABCD2345" }
  ],
  "questions": [
    {
      "examVersionQuestionId": "uuid",
      "questionId": "uuid",
      "revisionId": "uuid",
      "title": "Pregunta 1",
      "type": "SINGLE_CHOICE",
      "statement": "¿Qué es una API REST?",
      "position": 1,
      "points": 2,
      "options": [
        { "id": "uuid", "content": "Una interfaz HTTP", "position": 1, "creditFraction": 1 },
        { "id": "uuid", "content": "Un motor de base de datos", "position": 2, "creditFraction": 0 }
      ]
    }
  ]
}
```

El DTO docente puede incluir respuestas correctas y fracciones de crédito.

### 4.3 Resumen de examen para alumno

```json
{
  "id": "uuid",
  "title": "Primer parcial",
  "description": "Unidades 1 a 3",
  "groupName": "Comisión A",
  "status": "PUBLISHED",
  "opensAt": "2026-11-20T12:00:00.000Z",
  "closesAt": "2026-11-20T14:00:00.000Z",
  "durationMinutes": 90,
  "attemptsUsed": 0,
  "maxAttempts": 1,
  "hasInProgress": false,
  "questionCount": 8,
  "totalPoints": 10,
  "lastAttemptId": null,
  "lastAttemptStatus": null,
  "lastAttemptScore": null,
  "lastAttemptMaxScore": null,
  "resultAvailable": false,
  "canStart": true
}
```

`lastAttempt*` describe el intento más reciente del alumno (excluye `CANCELLED`). `resultAvailable` es `true` cuando ese intento está `GRADED` y los resultados están liberados; en ese caso `lastAttemptScore`/`lastAttemptMaxScore` traen el puntaje.

### 4.4 Detalle de examen para alumno

Incluye las preguntas y opciones, pero **nunca**:

- `creditFraction`.
- `gradingConfigJson`.
- `contentJson.acceptedAnswers`.
- La identificación de la opción correcta.
- `totalScore` o `maxScore` antes de la liberación de resultados.

```json
{
  "id": "uuid",
  "title": "Primer parcial",
  "description": "Unidades 1 a 3",
  "durationMinutes": 90,
  "opensAt": "2026-11-20T12:00:00.000Z",
  "closesAt": "2026-11-20T14:00:00.000Z",
  "attemptId": "uuid",
  "attemptStatus": "IN_PROGRESS",
  "deadlineAt": "2026-11-20T13:30:00.000Z",
  "questions": [
    {
      "examVersionQuestionId": "uuid",
      "questionId": "uuid",
      "type": "SINGLE_CHOICE",
      "statement": "¿Qué es una API REST?",
      "position": 1,
      "points": 2,
      "options": [
        { "id": "uuid", "content": "Una interfaz HTTP", "position": 1 },
        { "id": "uuid", "content": "Un motor de base de datos", "position": 2 }
      ]
    }
  ],
  "answers": [
    {
      "examVersionQuestionId": "uuid",
      "optionIds": ["uuid"],
      "text": null
    }
  ]
}
```

### 4.5 Intento

```json
{
  "attemptId": "uuid",
  "examId": "uuid",
  "examVersionId": "uuid",
  "attemptNumber": 1,
  "status": "IN_PROGRESS",
  "startedAt": "2026-11-20T12:00:00.000Z",
  "deadlineAt": "2026-11-20T13:30:00.000Z",
  "submittedAt": null,
  "gradedAt": null,
  "totalScore": null,
  "maxScore": null,
  "resultsReleased": false
}
```

### 4.6 Resultado

Solo se devuelve si el intento está `GRADED` y los resultados fueron liberados según `ResultsReleaseMode`/`ResultsReleasedAt`.

```json
{
  "attemptId": "uuid",
  "examId": "uuid",
  "status": "GRADED",
  "totalScore": 8.5,
  "maxScore": 10,
  "percentage": 85,
  "showCorrectAnswers": true,
  "submittedAt": "2026-11-20T13:20:00.000Z",
  "gradedAt": "2026-11-20T13:20:01.000Z",
  "answers": [
    {
      "examVersionQuestionId": "uuid",
      "position": 1,
      "type": "SINGLE_CHOICE",
      "statement": "¿Qué es una API REST?",
      "awardedPoints": 2,
      "maxPoints": 2,
      "isCorrect": true,
      "responseText": null,
      "selectedOptionIds": ["uuid"],
      "correctOptionIds": ["uuid"],
      "options": [
        { "id": "uuid", "content": "Una interfaz HTTP", "position": 1, "selected": true }
      ]
    }
  ]
}
```

- Incluye **todas** las preguntas de la versión, aunque el alumno no las haya respondido.
- `awardedPoints` es `null` mientras la pregunta espera revisión manual.
- `correctOptionIds` solo aparece si `Exams.ShowCorrectAnswers = 1`.
- `options` nunca incluye `creditFraction`.

## 5. Endpoints del docente

Todos requieren `Authorization: Bearer <token>` y rol `TEACHER`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/exams` | Lista los exámenes del docente. |
| `POST` | `/exams` | Crea un examen en `DRAFT` con su versión inicial. |
| `GET` | `/exams/:id` | Detalle del examen con preguntas y grupos. |
| `PUT` | `/exams/:id` | Reemplaza el documento editable de un examen en `DRAFT`. |
| `POST` | `/exams/:id/close` | Cierra el examen. |
| `POST` | `/exams/:id/release-results` | Libera los resultados a los alumnos. |
| `GET` | `/exams/:id/attempts` | Lista los intentos de los alumnos con sus puntajes. |

### 5.1 `POST /exams`

Body mínimo:

```json
{
  "title": "Primer parcial",
  "description": "Unidades 1 a 3",
  "opensAt": "2026-11-20T12:00:00.000Z",
  "closesAt": "2026-11-20T14:00:00.000Z",
  "durationMinutes": 90,
  "maxAttempts": 1,
  "resultsReleaseMode": "MANUAL",
  "showCorrectAnswers": false
}
```

`resultsReleaseMode` acepta `IMMEDIATE`, `ON_CLOSE` o `MANUAL` (por defecto `MANUAL`). `showCorrectAnswers` es booleano (por defecto `false`).

Respuesta `201`:

```json
{ "id": "uuid", "currentVersionId": "uuid", "status": "DRAFT" }
```

### 5.2 `PUT /exams/:id`

Reemplaza el documento editable. Solo se permite si el examen y la versión de trabajo están en `DRAFT`.

```json
{
  "title": "Primer parcial",
  "description": "Unidades 1 a 3",
  "opensAt": "2026-11-20T12:00:00.000Z",
  "closesAt": "2026-11-20T14:00:00.000Z",
  "durationMinutes": 90,
  "maxAttempts": 1,
  "resultsReleaseMode": "MANUAL",
  "showCorrectAnswers": false,
  "groupIds": ["uuid-grupo-propio"],
  "questions": [
    { "questionId": "uuid-pregunta-propia", "points": 2, "position": 1 }
  ]
}
```

Reglas:

- `groupIds` debe contener solo grupos `IsActive = 1` del mismo docente.
- Si `groupIds` se omite, los grupos asignados no se modifican. Una lista vacía quita todas las asignaciones.
- `questions` debe contener solo preguntas activas del mismo docente.
- No se permiten preguntas ni posiciones repetidas.
- Si el examen no está en `DRAFT` (por ejemplo, ya fue publicado), responde `409`. La clonación de la versión publicada queda para una etapa posterior.
- La operación es transaccional: metadatos, grupos y preguntas se guardan juntos o no se guarda nada.
- La respuesta es el detalle completo del examen, con el mismo formato de `GET /exams/:id`.

### 5.4 `POST /exams/:id/close`

- Solo el docente propietario.
- Pasa el examen a `CLOSED`.
- No admite nuevos intentos.
- Es idempotente: cerrar un examen ya cerrado responde `200` con `status: "CLOSED"`.
- Un examen en `DRAFT` no se puede cerrar (`409`).
- Cerrar no cancela los intentos en curso: los que ya vencieron se autoentregan al consultarse, y el resto puede seguir hasta su `DeadlineAt` o entregarse manualmente.

### 5.5 `POST /exams/:id/release-results`

- Solo el docente propietario.
- Marca `Exams.ResultsReleasedAt` con la fecha actual.
- Es idempotente: conserva la primera fecha de liberación.
- Un examen en `DRAFT` responde `409`.

```json
{
  "id": "uuid",
  "status": "CLOSED",
  "resultsReleaseMode": "MANUAL",
  "resultsReleasedAt": "2026-11-21T10:00:00.000Z"
}
```

Los modos `IMMEDIATE` y `ON_CLOSE` no necesitan esta llamada: el resultado se habilita al corregirse el intento o al cerrarse el examen, respectivamente.

### 5.6 `GET /exams/:id/attempts`

Devuelve los intentos del examen ordenados por inicio descendente:

```json
[
  {
    "attemptId": "uuid",
    "studentId": "uuid",
    "studentName": "Ana Pérez",
    "studentEmail": "ana@example.com",
    "attemptNumber": 1,
    "status": "GRADED",
    "startedAt": "2026-11-20T12:00:00.000Z",
    "submittedAt": "2026-11-20T13:20:00.000Z",
    "totalScore": 8.5,
    "maxScore": 10,
    "gradedAt": "2026-11-20T13:20:01.000Z"
  }
]
```

- Solo el docente propietario del examen.
- Incluye el puntaje aunque los resultados todavía no estén liberados a los alumnos.

## 6. Endpoints del alumno

Todos requieren `Authorization: Bearer <token>` y rol `STUDENT`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/exams/available` | Exámenes disponibles en sus grupos activos. |
| `GET` | `/exams/:id/student` | Detalle sanitizado de un examen accesible, con un intento en curso. |
| `GET` | `/attempts/:id` | Estado del intento y respuestas guardadas. |
| `PUT` | `/attempts/:id/answers/:questionId` | Guarda o reemplaza una respuesta. |
| `POST` | `/attempts/:id/submit` | Entrega el intento. |
| `GET` | `/attempts/:id/result` | Resultado, si fue corregido y liberado (P1). |

### 6.1 Regla central de acceso

Un alumno puede acceder a un examen solamente si se cumple todo:

1. El examen tiene una versión `PUBLISHED`.
2. El estado del examen es `PUBLISHED` o `SCHEDULED`.
3. El examen está asignado a un grupo activo.
4. El alumno tiene membresía `ACTIVE` en ese grupo.
5. La fecha actual está dentro de `PublishAt`/`OpensAt`/`ClosesAt` según corresponda.

La consulta de referencia es:

```sql
SELECT ...
FROM Exams e
JOIN ExamVersions v
  ON v.ExamId = e.Id AND v.Status = 'PUBLISHED'
JOIN ExamGroups eg
  ON eg.ExamId = e.Id
JOIN ClassGroups g
  ON g.Id = eg.GroupId AND g.IsActive = 1
JOIN GroupMembers gm
  ON gm.GroupId = g.Id
 AND gm.UserId = @studentId
 AND gm.Status = 'ACTIVE'
WHERE e.Id = @examId
  AND e.Status IN ('PUBLISHED', 'SCHEDULED')
  AND (e.PublishAt IS NULL OR e.PublishAt <= SYSUTCDATETIME())
  AND (e.OpensAt IS NULL OR e.OpensAt <= SYSUTCDATETIME())
  AND (e.ClosesAt IS NULL OR e.ClosesAt >= SYSUTCDATETIME())
```

Esta regla debe implementarse una sola vez en `exam-access.service.js` y reutilizarse en todos los endpoints del alumno.

Implementación: `backend/src/services/exam-access.service.js` expone `findAccessibleExams`, usado por `GET /exams/available`, `GET /exams/:id/student`.

Notas de comportamiento:

- Un examen `SCHEDULED` con `PublishAt` futuro no aparece; cuando llega `PublishAt`, sí aparece aunque el estado siga siendo `SCHEDULED`.
- `GET /exams/:id/student` exige un intento `IN_PROGRESS` para no exponer las preguntas antes de que el alumno empiece a rendir. Sin intento responde `409`.
- Los endpoints de `/attempts/:id` validan pertenencia y estado del intento; no vuelven a exigir la ventana del examen, para que el alumno pueda entregar un intento ya iniciado aunque el docente cierre el examen.
- Un examen sin `DurationMinutes` ni `ClosesAt` es accesible pero no se puede iniciar (`canStart: false` y `409` al iniciar), porque `ExamAttempts.DeadlineAt` es `NOT NULL` en el esquema actual.
- `GET /exams/available` devuelve `questionCount` y `totalPoints` de la versión publicada para que la pantalla de instrucciones los muestre sin exponer las preguntas. También devuelve `hasInProgress` para que el alumno pueda reanudar un intento.

### 6.3 `PUT /attempts/:id/answers/:questionId`

`:questionId` acepta el `examVersionQuestionId` de la versión del intento o el `questionId` del banco.

Body según tipo:

```json
{ "optionId": "uuid" }
```

```json
{ "optionIds": ["uuid", "uuid"] }
```

```json
{ "text": "respuesta escrita" }
```

Reglas:

- El intento pertenece al alumno; un intento ajeno o inexistente responde `404`.
- El intento está `IN_PROGRESS`.
- La pregunta pertenece a la versión del intento.
- La respuesta es compatible con el tipo de pregunta:
  - `SINGLE_CHOICE` y `TRUE_FALSE`: exactamente una opción (`optionId` o `optionIds` con un elemento).
  - `MULTIPLE_CHOICE`: cero o más opciones (`optionIds`).
  - `SHORT_TEXT` y `ESSAY`: `text` obligatorio.
  - `MATCHING`, `ORDERING` y `FILE_UPLOAD` no están soportados en P0 (`400`).
- `TRUE_FALSE` se guarda como dos opciones (`Verdadero`/`Falso`); el cliente envía el id de la opción elegida.
- Las opciones pertenecen a la revisión de la pregunta.
- Guardar dos veces la misma respuesta reemplaza la anterior; no se duplican filas.
- Si el intento venció, se autoentrega (`SUBMITTED`) y responde `409`.

### 6.4 `POST /attempts/:id/submit`

Respuesta `200`:

```json
{
  "attemptId": "uuid",
  "status": "GRADED",
  "submittedAt": "2026-11-20T13:20:00.000Z",
  "resultAvailable": true
}
```

Reglas:

- Solo el alumno propietario.
- Si está `IN_PROGRESS`, lo pasa a `SUBMITTED` y dispara la corrección automática.
- Si ya fue entregado (`SUBMITTED`, `GRADING` o `GRADED`), responde idempotentemente con el estado actual.
- Un intento `CANCELLED` responde `409`.
- Si se entrega después de `DeadlineAt`, se marca `IsAutoSubmitted = 1`.
- `status` refleja el resultado de la corrección: `GRADED` si todas las preguntas son automáticas, `GRADING` si alguna requiere revisión manual.
- `resultAvailable` es `true` sólo si el intento quedó `GRADED` y los resultados están liberados.
- No permite modificar respuestas después.

### 6.5 `GET /attempts/:id`

Devuelve el estado del intento (`attemptId`, `examId`, `examVersionId`, `attemptNumber`, `status`, `startedAt`, `deadlineAt`, `submittedAt`, `gradedAt`, `totalScore`, `maxScore`, `resultsReleased`) más `answers` con las respuestas guardadas.

- Solo el alumno propietario; ajeno o inexistente → `404`.
- Si el intento está `IN_PROGRESS` y venció, se autoentrega, se corrige y se devuelve como `GRADED` o `GRADING`.
- Un intento `SUBMITTED` se corrige al consultarlo (corrección diferida idempotente).
- `totalScore` y `maxScore` se devuelven en `null` hasta que los resultados estén liberados.

### 6.6 `GET /attempts/:id/result`

- Requiere que el intento esté `GRADED` y que los resultados estén liberados según `ResultsReleaseMode`/`ResultsReleasedAt`.
- Un intento `IN_PROGRESS` responde `409`; un intento `SUBMITTED` se corrige antes de responder.
- Si la corrección todavía está pendiente (`GRADING`) o los resultados no fueron liberados, responde `409`.
- `correctOptionIds` solo se incluye si `Exams.ShowCorrectAnswers = 1`.
- Incluye todas las preguntas de la versión, incluidas las no respondidas.

### 6.7 Corrección automática

La corrección se ejecuta al entregar el intento y también de forma diferida cuando el intento se consulta o se pide su resultado.

| Tipo | Regla |
|---|---|
| `SINGLE_CHOICE`, `TRUE_FALSE` | `puntos × CreditFraction` de la opción elegida. |
| `MULTIPLE_CHOICE` | `puntos × suma de CreditFraction` de las opciones elegidas, limitado a `[0, puntos]`. Los créditos negativos restan. |
| `SHORT_TEXT` | Puntaje completo si el texto coincide con alguna de `contentJson.acceptedAnswers`; si no, `0`. |
| `ESSAY` y tipos no usados | Quedan en revisión manual (`GradingStatus = MANUAL_REVIEW`) y el intento pasa a `GRADING`. |

- La comparación de `SHORT_TEXT` recorta espacios, colapsa espacios internos y respeta `gradingConfigJson.caseSensitive`.
- Una pregunta sin responder se califica con `0` automáticamente, sin pasar por revisión manual.
- `MaxScore` es la suma de `ExamVersionQuestions.Points` de la versión del intento.
- `TotalScore` suma los puntos automáticos obtenidos. Si queda alguna pregunta en revisión manual, el intento no pasa a `GRADED`.
- Las calificaciones se guardan en `AnswerGrades` y el estado por respuesta en `AttemptAnswers.GradingStatus`.
- La corrección es idempotente: sólo se ejecuta sobre intentos `SUBMITTED`.

## 7. Formato de errores

Todas las respuestas de error deben usar:

```json
{
  "message": "Descripción legible",
  "code": "OPTIONAL_CODE"
}
```

| Status | Uso |
|---|---|
| `400` | Datos inválidos o incompletos. |
| `401` | Token ausente, inválido o expirado. |
| `403` | Rol incorrecto. |
| `404` | Recurso inexistente o sin acceso (incluye recursos ajenos). |
| `409` | Conflicto de estado: ya entregado, máximo de intentos, duplicado, fuera de ventana. |
| `500` | Error interno no controlado. |

No devolver detalles de SQL, stack traces ni datos de otros usuarios.

## 8. Invariantes de base de datos

La migración `002_integrity.sql` refuerza:

- `ClassGroups.AccessCode` no nulo y único.
- `Exams.CurrentVersionId` pertenece al mismo examen.
- `ExamAttempts.ExamVersionId` pertenece al mismo examen.
- `ExamGroups` solo vincula exámenes y grupos del mismo docente.
- Índices para listados de exámenes publicados e intentos por alumno.

El runner de migraciones registra cada archivo aplicado en `dbo.SchemaMigrations` y aplica los pendientes en orden.

## 9. Criterios de aceptación del contrato

- Docente y alumno tienen DTOs distintos.
- El alumno nunca recibe respuestas correctas ni fracciones de crédito antes de la liberación.
- Todos los endpoints de alumno usan la misma regla de acceso.
- Publicar es transaccional e inmutable.
- Iniciar y entregar intentos es idempotente y resistente a concurrencia.
- Los errores son consistentes y no filtran información.
