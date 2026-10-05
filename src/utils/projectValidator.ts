export type ProjectValidationResult =
    | { ok: true; warnings: string[] }
    | { ok: false; error: string; warnings: string[] };

/**
 * Validates that a parsed JSON object looks like a Diagramme de Feux project.
 *
 * Returns:
 *   { ok: true,  warnings: string[] }  → safe to load (warnings are non-blocking)
 *   { ok: false, error: string, warnings: string[] } → reject with user-visible message
 *
 * Validation policy: strict on "is this our file format?", tolerant on
 * individual fields (we can still load a partial project). This prevents
 * accidentally loading unrelated JSON (logs, configuration files, etc.)
 * while remaining forward/backward compatible with schema tweaks.
 */
export const validateProject = (data: unknown): ProjectValidationResult => {
    const warnings: string[] = [];

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return {
            ok: false,
            error: 'Le fichier ne contient pas un objet de projet valide (attendu : un objet JSON).',
            warnings
        };
    }

    const p = data as Record<string, unknown>;

    const groups = Array.isArray(p.groups) ? p.groups : [];
    const pfTabs = Array.isArray(p.pfTabs) ? p.pfTabs : [];
    const conflictMatrix = Array.isArray(p.conflictMatrix) ? p.conflictMatrix : [];
    const hasGroups = Array.isArray(p.groups);
    const hasPfTabs = Array.isArray(p.pfTabs);
    const hasCycle = typeof p.cycleLength === 'number';
    const hasMatrix = Array.isArray(p.conflictMatrix);
    const looksLikeGreenWave = Array.isArray(p.intersections);

    if (!hasGroups && !hasPfTabs && !hasCycle && !hasMatrix) {
        if (looksLikeGreenWave) {
            return {
                ok: false,
                error: "Ce fichier est une onde verte, pas un projet de carrefour. Pour l'ouvrir, utilisez le module Onde verte (menu Onde verte de la fenêtre principale, puis Fichier → Ouvrir).",
                warnings
            };
        }
        return {
            ok: false,
            error: 'Le fichier ne ressemble pas à un projet TraCflux (aucun des champs attendus : groups, pfTabs, cycleLength, conflictMatrix).',
            warnings
        };
    }

    if (!hasGroups) warnings.push('Aucun groupe de feux trouvé (groups manquant).');
    if (!hasCycle) warnings.push('Longueur de cycle non spécifiée — valeur par défaut utilisée.');
    if (!hasMatrix) warnings.push('Matrice de conflits non fournie — elle sera vide.');

    if (hasGroups) {
        groups.forEach((g: unknown, i: number) => {
            if (!g || typeof g !== 'object') {
                warnings.push(`Groupe ${i} : format inattendu, peut être ignoré au chargement.`);
                return;
            }
            const groupe = g as Record<string, unknown>;
            if (groupe.id === undefined || groupe.id === null) warnings.push(`Groupe ${i} : identifiant manquant (id).`);
            if (!groupe.name) warnings.push(`Groupe ${i} : nom manquant (name).`);
            if (!groupe.durations || typeof groupe.durations !== 'object') {
                warnings.push(`Groupe ${i} : durées manquantes (durations).`);
            }
        });
    }

    if (hasPfTabs) {
        pfTabs.forEach((pf: unknown, i: number) => {
            if (!pf || typeof pf !== 'object') {
                warnings.push(`Plan de feux ${i} : format inattendu.`);
                return;
            }
            const plan = pf as Record<string, unknown>;
            if (plan.id === undefined || plan.id === null) warnings.push(`Plan de feux ${i} : identifiant manquant (id).`);
            if (!plan.name) warnings.push(`Plan de feux ${i} : nom manquant (name).`);
        });
    }

    if (hasGroups && hasMatrix) {
        const n = groups.length;
        if (conflictMatrix.length !== n) {
            warnings.push(`Matrice de conflits : ${conflictMatrix.length} ligne(s) pour ${n} groupe(s) — incohérence probable.`);
        }
    }

    return { ok: true, warnings };
};