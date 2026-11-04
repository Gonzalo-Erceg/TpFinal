const bcrypt = require('bcrypt');
const AuthRepository = require('../repositories/auth.repository');
const { generateToken } = require('../utils/jwt');
const AuthError = require('../utils/auth-error');

const authRepository = new AuthRepository();

class AuthService {

        async register({ firstName, lastName, email, password, role = 'STUDENT' }) {
        if (!firstName || !lastName || !email || !password) {
            throw new AuthError('Todos los campos son obligatorios');
        }

        firstName = firstName.trim();
        lastName = lastName.trim();
        email = email.trim().toLowerCase();
        role = role.toUpperCase();

        if (password.length < 8) {
            throw new AuthError('La contraseña debe tener al menos 8 caracteres');
        }


        if (!['STUDENT', 'TEACHER'].includes(role)) {
            throw new AuthError('El rol seleccionado no es válido');
        }

        const existingUser = await authRepository.findByEmail(email);

        if (existingUser) {
            throw new AuthError('El email ya está registrado', 409);
        }

        const passwordHash = await bcrypt.hash(password, 12);

        let user;

        try {
            user = await authRepository.create({
                firstName,
                lastName,
                email,
                passwordHash,
                role
            });
        } catch (error) {
         
            if (error.number === 2627 || error.number === 2601) {
                throw new AuthError('El email ya está registrado', 409);
            }

            throw error;
        }

        const token = await generateToken(user);

        return { user, token };
    }

    async login({ email, password }) {
        if (!email || !password) {
            throw new AuthError('Email y contraseña son obligatorios');
        }

        email = email.trim().toLowerCase();

        const user = await authRepository.findByEmail(email);

        if (!user || !user.PasswordHash) {
            throw new AuthError('Credenciales incorrectas', 401);
        }

        if (!user.IsActive) {
            throw new AuthError('Usuario deshabilitado', 403);
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.PasswordHash
        );

        if (!passwordMatches) {
            throw new AuthError('Credenciales incorrectas', 401);
        }

        const token = await generateToken(user);

        return {
            user: {
                id: user.Id,
                firstName: user.FirstName,
                lastName: user.LastName,
                email: user.Email
            },
            token
        };
    }
}

module.exports = AuthService;