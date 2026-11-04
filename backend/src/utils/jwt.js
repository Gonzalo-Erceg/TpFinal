const { SignJWT } = require('jose');

async function generateToken(user) {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    return await new SignJWT({
        role: user.Role
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.Id)
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret);
}

module.exports = { generateToken };