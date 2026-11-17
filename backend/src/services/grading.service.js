
const TIPOS_CON_CREDITO = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'];
const TIPO_TEXTO_CORTO = 'SHORT_TEXT';

function redondear(valor) {
    return Math.round(valor * 100) / 100;
}

function normalizarTexto(texto, caseSensitive) {
    const limpio = String(texto ?? '').trim().replace(/\s+/g, ' ');

    return caseSensitive ? limpio : limpio.toLowerCase();
}

function limitarPuntos(valor, maximo) {
    return Math.min(Math.max(valor, 0), Math.max(maximo, 0));
}

function leerJson(valor) {
    if (!valor) {
        return null;
    }

    if (typeof valor === 'object') {
        return valor;
    }

    try {
        return JSON.parse(valor);
    } catch {
        return null;
    }
}

function calificarOpciones(pregunta) {
    const puntos = Number(pregunta.points ?? 0);
    const elegidas = new Set(pregunta.selectedOptionIds ?? []);
    const opciones = pregunta.options ?? [];

    if (elegidas.size === 0) {
        return { gradingStatus: 'AUTO_GRADED', awardedPoints: 0 };
    }

    if (pregunta.questionType === 'MULTIPLE_CHOICE') {
        const credito = opciones
            .filter((opcion) => elegidas.has(opcion.id))
            .reduce((suma, opcion) => suma + Number(opcion.creditFraction ?? 0), 0);

        return {
            gradingStatus: 'AUTO_GRADED',
            awardedPoints: redondear(limitarPuntos(puntos * credito, puntos)),
        };
    }

    const opcion = opciones.find((item) => elegidas.has(item.id));

    if (!opcion) {
        return { gradingStatus: 'AUTO_GRADED', awardedPoints: 0 };
    }

    return {
        gradingStatus: 'AUTO_GRADED',
        awardedPoints: redondear(limitarPuntos(puntos * Number(opcion.creditFraction ?? 0), puntos)),
    };
}

function calificarTexto(pregunta) {
    const puntos = Number(pregunta.points ?? 0);
    const contenido = leerJson(pregunta.contentJson) ?? {};
    const configuracion = leerJson(pregunta.gradingConfigJson) ?? {};
    const aceptadas = Array.isArray(contenido.acceptedAnswers) ? contenido.acceptedAnswers : [];
    const caseSensitive = configuracion.caseSensitive === true;
    const respuesta = normalizarTexto(pregunta.responseText, caseSensitive);

    if (!respuesta || aceptadas.length === 0) {
        return { gradingStatus: 'AUTO_GRADED', awardedPoints: 0 };
    }

    const coincide = aceptadas.some(
        (aceptada) => normalizarTexto(aceptada, caseSensitive) === respuesta
    );

    return {
        gradingStatus: 'AUTO_GRADED',
        awardedPoints: coincide ? redondear(puntos) : 0,
    };
}

function calificarPregunta(pregunta) {
    if (!pregunta.answered) {
        return { gradingStatus: 'AUTO_GRADED', awardedPoints: 0 };
    }

    if (TIPOS_CON_CREDITO.includes(pregunta.questionType)) {
        return calificarOpciones(pregunta);
    }

    if (pregunta.questionType === TIPO_TEXTO_CORTO) {
        return calificarTexto(pregunta);
    }

    return { gradingStatus: 'MANUAL_REVIEW', awardedPoints: null };
}

module.exports = {
    calificarPregunta,
    normalizarTexto,
};
