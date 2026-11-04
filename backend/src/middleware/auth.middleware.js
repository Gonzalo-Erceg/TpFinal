const { jwtVerify } = require('jose');

const secret = process.env.JWT_SECRET;

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                message: 'No estás autenticado'
            });
        }

        if (!secret) {
            throw new Error('JWT_SECRET no está configurado');
        }

        const token = authHeader.split(' ')[1];

        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(secret)
        );

       
        req.user = {
            id: payload.sub,
            role: payload.role
        };

        next();

    } catch (error) {
        return res.status(401).json({
            message: 'Token inválido o expirado'
        });
    }
}

function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'No estás autenticado'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'No tenés permisos para acceder a este recurso'
            });
        }

        next();
    };
}

module.exports = { authenticate, authorize };