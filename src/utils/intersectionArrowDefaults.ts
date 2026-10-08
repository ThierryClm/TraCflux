const TURN_ONLY_CURRENTS = new Set(['TàD', 'TàG']);

const COMBINED_TURN_CURRENTS = new Set([
    'TD_TàD',
    'TD_TàG',
    'TDTàD',
    'TDTàG',
    'TD-TàD',
    'TD-TàG',
    'TD_G_D'
]);

const LONG_CURRENTS = new Set(['Piéton', 'Cycle']);

export interface NewArrowDefaults {
    turnLength?: number;
    length?: number;
}

/**
 * Dimensions appliquées uniquement lors de la création d'une nouvelle flèche.
 * Les flèches déjà enregistrées dans un projet ne passent jamais par cette
 * fonction et conservent donc leurs valeurs.
 */
export function getNewIntersectionArrowDefaults(courant: string | undefined): NewArrowDefaults {
    if (courant === undefined) return {};

    if (TURN_ONLY_CURRENTS.has(courant)) {
        return { turnLength: 0.4 };
    }

    if (COMBINED_TURN_CURRENTS.has(courant)) {
        return { turnLength: 0.5 };
    }

    if (LONG_CURRENTS.has(courant)) {
        return { length: 2 };
    }

    return {};
}
