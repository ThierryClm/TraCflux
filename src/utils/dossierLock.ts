import type { Projet } from '../types/projet';

/**
 * Marqueur « dossier en lecture seule » pour l'export, volontairement obscurci.
 *
 * Ce verrou est une convention et non une protection cryptographique.
 */
const FIELD = 'stamp';

/** Ajoute le marqueur lecture seule à un objet projet, sans le modifier. */
export const stampReadOnly = (data: Projet): Projet & Record<string, unknown> => ({
    ...data,
    [FIELD]: btoa(JSON.stringify({ ro: 1, v: 1 }))
});

/** Vrai si l'objet projet porte le marqueur lecture seule. */
export const isReadOnlyStamped = (data: unknown): boolean => {
    try {
        const raw = data && typeof data === 'object'
            ? (data as Record<string, unknown>)[FIELD]
            : undefined;
        if (typeof raw !== 'string' || !raw) return false;
        const obj: unknown = JSON.parse(atob(raw));
        return !!obj && typeof obj === 'object' && (obj as Record<string, unknown>).ro === 1;
    } catch {
        return false;
    }
};
