/**
 * Accès du module Onde verte au cache du navigateur.
 *
 * Les dossiers TraCflux y sont rangés sous `traffic_project_<nom>`, avec
 * `traffic_project_order` pour l'ordre d'usage ; les ondes vertes, sous
 * `savedGreenWaves`, indexées par nom.
 */
import type { ActionMicro } from '../types/projet';
import type { GreenWaveIntersection, GreenWaveProjectSource, SavedGreenWave } from '../types/greenWave';

const PROJECT_PREFIX = 'traffic_project_';
const PROJECT_ORDER_KEY = 'traffic_project_order';
const SAVED_GREEN_WAVES_KEY = 'savedGreenWaves';

/** Dossier présent dans le cache, pour les listes de choix. */
export interface CachedProjectSave {
    name: string;
    savedAt: string | null;
    size: number;
}

/** Onde verte du cache, pour la liste « Restaurer un projet récent ». */
export interface RecentGreenWave {
    name: string;
    savedAt?: string;
    count: number;
}

/** Clé d'un dossier de carrefour (hors sauvegardes et clé d'ordre). */
const isProjectKey = (key: string | null): key is string =>
    !!key && key.startsWith(PROJECT_PREFIX) && !key.endsWith('_backup') && key !== PROJECT_ORDER_KEY;

/** Lit un dossier du cache ; null s'il est absent ou illisible. */
export const readCachedProject = (name: string): GreenWaveProjectSource | null => {
    try {
        const raw = localStorage.getItem(`${PROJECT_PREFIX}${name}`);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

/**
 * Dossiers du cache, du plus récemment enregistré au plus ancien
 * (équivalent du getAllSaves de useTrafficLight).
 */
export const listCachedProjectSaves = (): CachedProjectSave[] => {
    const saves: CachedProjectSave[] = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!isProjectKey(key)) continue;
            const name = key.replace(PROJECT_PREFIX, '');
            if (!name) continue;
            const raw = localStorage.getItem(key);
            let savedAt: string | null = null;
            let size = 0;
            if (raw) {
                size = raw.length;
                try {
                    const data = JSON.parse(raw);
                    savedAt = data.savedAt || null;
                } catch { /* dossier illisible : listé sans date */ }
            }
            saves.push({ name, savedAt, size });
        }
    } catch { /* cache inaccessible : liste vide */ }
    saves.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    return saves;
};

/** Noms des dossiers du cache, dans l'ordre d'usage du module principal. */
export const listCachedProjectNamesByUse = (): string[] => {
    const availableProjects: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!isProjectKey(key)) continue;
        availableProjects.push(key.replace(PROJECT_PREFIX, ''));
    }

    // Sort by saved order if available
    const orderRaw = localStorage.getItem(PROJECT_ORDER_KEY);
    if (orderRaw) {
        try {
            const order: string[] = JSON.parse(orderRaw);
            availableProjects.sort((a, b) => {
                const idxA = order.indexOf(a);
                const idxB = order.indexOf(b);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
        } catch {
            // ordre illisible : ordre du cache
        }
    }
    return availableProjects;
};

/** Ondes vertes du cache, indexées par nom. */
export const readSavedGreenWaves = (): Record<string, SavedGreenWave> =>
    JSON.parse(localStorage.getItem(SAVED_GREEN_WAVES_KEY) || '{}');

export const writeSavedGreenWaves = (all: Record<string, SavedGreenWave>): void => {
    localStorage.setItem(SAVED_GREEN_WAVES_KEY, JSON.stringify(all));
};

/**
 * Ondes vertes exploitables du cache (champ intersections présent), de la plus
 * récente à la plus ancienne.
 */
export const listRecentGreenWaves = (): RecentGreenWave[] => {
    const raw = localStorage.getItem(SAVED_GREEN_WAVES_KEY);
    const all: Record<string, Partial<SavedGreenWave>> = raw ? JSON.parse(raw) : {};
    return Object.entries(all)
        .filter(([, data]) => data && Array.isArray(data.intersections))
        .map(([name, data]) => ({ name, savedAt: data.savedAt, count: data.intersections!.length }))
        .sort((a, b) => {
            const dA = a.savedAt ? new Date(a.savedAt) : new Date(0);
            const dB = b.savedAt ? new Date(b.savedAt) : new Date(0);
            return dB.getTime() - dA.getTime();
        });
};

const isEmptyActionRow = (r: Partial<ActionMicro> | null | undefined): boolean => !r || (
    !r.gf && !r.action && !r.description && !r.deb && !r.fin &&
    !r.abrv && !r.micro && !r.plage1 && !r.plage2 &&
    !r.actGf1 && !r.actGf1Gf2 && !r.actGf1Gf3 && !r.actGf1Gf4
);

const slimActions = <T extends ActionMicro[] | undefined>(arr: T): T =>
    (Array.isArray(arr) ? arr.filter(r => !isEmptyActionRow(r)) : arr) as T;

/**
 * Copie allégée des carrefours pour l'export : sans les matrices d'intervert
 * (jamais lues par l'onde verte) ni les lignes d'action entièrement vides.
 * Les données en mémoire restent complètes.
 */
export const slimIntersectionsForExport = (intersections: readonly GreenWaveIntersection[]): GreenWaveIntersection[] =>
    intersections.map(it => {
        const copy = { ...it, actionData: slimActions(it.actionData) };
        if (Array.isArray(it.pfTabs)) {
            copy.pfTabs = it.pfTabs.map(pf => {
                const pfCopy = { ...pf, data: slimActions(pf.data) };
                delete pfCopy.conflictMatrix;
                return pfCopy;
            });
        }
        return copy;
    });
