const GroupsRepository = require('../repositories/groups.repository');
const { generateAccessCode } = require('../utils/access-code');
const AuthError = require('../utils/auth-error');

const groupsRepository = new GroupsRepository();

const MAX_ATTEMPTS = 5;
const DUPLICATE_KEY_ERRORS = [2601, 2627];
const ACCESS_CODE_INDEX = 'UX_ClassGroups_AccessCode';
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toTeacherGroup(row) {
    return {
        id: row.Id,
        name: row.Name,
        subject: row.CourseName ?? null,
        accessCode: row.AccessCode
    };
}

// El alumno no recibe el código de acceso
function toStudentGroup(row) {
    return {
        id: row.Id,
        name: row.Name,
        subject: row.CourseName ?? null,
        teacher: `${row.TeacherFirstName} ${row.TeacherLastName}`,
        membershipStatus: row.Status
    };
}

class GroupsService {

    async create({ name, courseId }, teacher) {
        if (typeof name !== 'string' || !name.trim()) {
            throw new AuthError('El nombre del grupo es obligatorio');
        }

        name = name.trim();
        courseId = courseId || null;

        if (courseId) {
            if (typeof courseId !== 'string' || !GUID_REGEX.test(courseId)) {
                throw new AuthError('La materia seleccionada no es válida');
            }

            const isOwnCourse = await groupsRepository.courseBelongsToTeacher(courseId, teacher.id);

            if (!isOwnCourse) {
                throw new AuthError('La materia no existe', 404);
            }
        }

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const accessCode = generateAccessCode();

            if (await groupsRepository.existsByAccessCode(accessCode)) {
                continue;
            }

            try {
                const groupId = await groupsRepository.create({
                    name,
                    courseId,
                    accessCode,
                    teacherId: teacher.id
                });

                const [group] = await groupsRepository.findByTeacher(teacher.id, groupId);
                return toTeacherGroup(group);
            } catch (error) {
                // Otro pedido pudo tomar el mismo código entre el SELECT y el INSERT
                const isCodeCollision =
                    DUPLICATE_KEY_ERRORS.includes(error.number) &&
                    error.message.includes(ACCESS_CODE_INDEX);

                if (!isCodeCollision) {
                    throw error;
                }
            }
        }

        throw new AuthError('No se pudo generar un código de acceso único, intentá de nuevo', 503);
    }

    async list(user) {
        if (user.role === 'TEACHER') {
            const groups = await groupsRepository.findByTeacher(user.id);
            return groups.map(toTeacherGroup);
        }

        if (user.role === 'STUDENT') {
            const groups = await groupsRepository.findByStudent(user.id);
            return groups.map(toStudentGroup);
        }

        throw new AuthError('No tenés permisos para acceder a este recurso', 403);
    }
}

module.exports = GroupsService;