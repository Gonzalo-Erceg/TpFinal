const crypto = require('crypto');

// Sin I, O, 0 y 1 para que el código no se confunda al leerlo
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

function generateAccessCode() {
    let code = '';

    for (let i = 0; i < LENGTH; i++) {
        code += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }

    return code;
}

module.exports = { generateAccessCode };