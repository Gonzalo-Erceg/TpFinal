const GroupsRepository = require('../repositories/groups.repository');
const { generateAccessCode } = require('../utils/access-code');
const AuthError = require('../utils/auth-error');

const groupsRepository = new GroupsRepository();

const MAX_ATTEMPTS = 5;
const DUPLICATE_KEY_ERRORS = [2601, 2627];
const ACCESS_CODE_INDEX = 'UX_ClassGroups_AccessCode';
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REOPENABLE_STATUSES = ['REJECTED', 'REMOVED'];
const MEMBER_STATUSES = ['ACTIVE', 'REJECTED', 'REMOVED'];

function isGuid(value) {
    return typeof value === 'string' && GUID_REGEX.test(value);
}

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

function toMember(row) {
    return {
        userId: row.UserId,
        firstName: row.FirstName,
        lastName: row.LastName,
        email: row.Email,
        status: row.Status,
        requestedAt: row.RequestedAt,
        reviewedAt: row.ReviewedAt,
        joinedAt: row.JoinedAt
    };
}

// Un grupo ajeno responde igual que uno inexistente
async function assertOwnGroup(groupId, teacherId) {
    if (!isGuid(groupId)) {
        throw new AuthError('El identificador del grupo no es válido');
    }

    const group = await groupsRepository.findOwnedGroup(groupId, teacherId);

    if (!group) {
        throw new AuthError('El grupo no existe', 404);
    }
}

class GroupsService {

    async create({ name, courseId }, teacher) {
        if (typeof name !== 'string' || !name.trim()) {
            throw new AuthError('El nombre del grupo es obligatorio');
        }

        name = name.trim();
        courseId = courseId || null;

        if (courseId) {
            if (!isGuid(courseId)) {
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

    async join({ code }, student) {
        if (typeof code !== 'string' || !code.trim() || code.trim().length > 50) {
            throw new AuthError('El código del grupo es obligatorio');
        }

        code = code.trim();

        const group = await groupsRepository.findActiveByAccessCode(code);

        if (!group) {
            throw new AuthError('El código no existe o el grupo no está activo', 404);
        }

        const membership = await groupsRepository.findMembership(group.Id, student.id);

        if (!membership) {
            try {
                await groupsRepository.createMembership(group.Id, student.id);
            } catch (error) {
                // Dos pedidos a la vez: la clave primaria evita la membresía duplicada
                if (DUPLICATE_KEY_ERRORS.includes(error.number)) {
                    throw new AuthError('Ya existe una solicitud para este grupo', 409);
                }

                throw error;
            }
        } else if (REOPENABLE_STATUSES.includes(membership.Status)) {
            const updatedRows = await groupsRepository.reopenMembership(group.Id, student.id);

            if (updatedRows === 0) {
                throw new AuthError('Ya existe una solicitud para este grupo', 409);
            }
        } else {
            throw new AuthError(
                membership.Status === 'ACTIVE'
                    ? 'Ya sos miembro de este grupo'
                    : 'Ya enviaste una solicitud para este grupo',
                409
            );
        }

        const [joinedGroup] = await groupsRepository.findByStudent(student.id, group.Id);
        return toStudentGroup(joinedGroup);
    }

    async listMembers(groupId, teacher) {
        await assertOwnGroup(groupId, teacher.id);

        const members = await groupsRepository.findMembers(groupId);
        return members.map(toMember);
    }

    async updateMemberStatus(groupId, userId, { status }, teacher) {
        if (!isGuid(userId)) {
            throw new AuthError('El identificador del alumno no es válido');
        }

        if (!MEMBER_STATUSES.includes(status)) {
            throw new AuthError('El estado debe ser ACTIVE, REJECTED o REMOVED');
        }

        await assertOwnGroup(groupId, teacher.id);

        const membership = await groupsRepository.findMembership(groupId, userId);

        if (!membership) {
            throw new AuthError('El alumno no pertenece a este grupo', 404);
        }

        if (membership.Status === status) {
            throw new AuthError('El alumno ya tiene ese estado', 409);
        }

        const updatedRows = await groupsRepository.updateMemberStatus({
            groupId,
            userId,
            status,
            reviewerId: teacher.id
        });

        if (updatedRows === 0) {
            throw new AuthError('El estado del alumno cambió, volvé a intentar', 409);
        }

        const [member] = await groupsRepository.findMembers(groupId, userId);
        return toMember(member);
    }
}

module.exports = GroupsService;