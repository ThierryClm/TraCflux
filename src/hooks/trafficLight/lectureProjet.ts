/**
 * Lecture d'un projet : remise au format actuel des données relues du cache
 * ou d'un fichier. Fonctions pures, appelées par useTrafficLight.
 */
import { entier } from '../../utils/entier';
import type { LargeursColonnes } from '../../components/ActionTable';
import type { CaseMatrice, Durees, Groupe, LigneDiagramme, Matrice, PlanDeFeu } from '../../types/projet';
import type { EtatProjet, GroupeEnregistre, ProjetEnregistre } from './types';

/** Un groupe piéton ou cycliste admet un intervert de 0 s ; les autres, 3 s. */
export const intervertMinimal = (groupe: Pick<Groupe, 'type'> | GroupeEnregistre | undefined) =>
    (groupe && (groupe.type === 'Piéton' || groupe.type === 'P' || groupe.type === 'Cycliste' || groupe.type === 'CY')) ? 0 : 3;

/** Groupes relus du cache, remis au format actuel (anciens formats de durées, champs manquants). */
export const migrerGroupes = (groupes: GroupeEnregistre[]): Groupe[] => groupes.map((g, index): Groupe => {
        // Ensure all required fields exist with proper defaults
        const id = g.id !== undefined ? g.id : index + 1;

        // Handle old duration formats
        let durations = g.durations;
        if (!durations || typeof durations !== 'object') {
            // Old format might have green/orange/red directly on group
            durations = {
                green: g.green !== undefined ? g.green : (g.greenDuration !== undefined ? g.greenDuration : 10),
                orange: g.orange !== undefined ? g.orange : 3,
                red: g.red !== undefined ? g.red : 0
            };
        }
        // Validate duration values
        const dureesValides: Durees = {
            green: !isNaN(Number(durations.green)) ? Number(durations.green) : 10,
            orange: !isNaN(Number(durations.orange)) ? Number(durations.orange) : 3,
            red: !isNaN(Number(durations.red)) ? Number(durations.red) : 0
        };

        return {
            id,
            name: g.name || `Groupe ${id}`,
            type: g.type || 'VL',
            ...(g.signal ? { signal: g.signal } : {}),
            courant: g.courant || '',
            minGreen: g.minGreen !== undefined && !isNaN(g.minGreen) ? g.minGreen : 6,
            durations: dureesValides,
            offset: g.offset !== undefined && !isNaN(g.offset) ? g.offset : 0,
            da: g.da || '',
            phaseFlag: g.phaseFlag || '',
            comment: g.comment || '',
            commentColor: g.commentColor || '',
            // Traffic Engineering Props
            trafficStream: g.trafficStream || '',
            laneCoef: g.laneCoef !== undefined ? g.laneCoef : 1,
            trafficVol: g.trafficVol !== undefined ? g.trafficVol : 0,
            effectiveGreen: g.effectiveGreen !== undefined ? g.effectiveGreen : 0,
            usedCapacity: g.usedCapacity !== undefined ? g.usedCapacity : 0,
            delay: g.delay !== undefined ? g.delay : 0,
            queueLength: g.queueLength !== undefined ? g.queueLength : 0
        };
});

/**
 * Matrice relue du cache, redimensionnée au nombre de groupes et purgée des
 * valeurs hors bornes ; null quand le projet n'a pas de groupes.
 */
export const matriceDuCache = (data: ProjetEnregistre): Matrice | null => {
    const groupCount = data.groups ? data.groups.length : 0;
    if (data.conflictMatrix && groupCount > 0) {
        // Clean values outside valid range, resize to match group count
        // Minimum is 0 for Piéton/Cycliste from-group, 3 for others
        const loadedGroups = data.groups || [];
        const cleanedMatrix = Array.from({ length: groupCount }, (_, r) => {
            return Array.from({ length: groupCount }, (_, c) => {
                const val = data.conflictMatrix?.[r]?.[c];
                if (val === undefined || val === null) return '';
                const fromGroup = loadedGroups[r];
                const minVal = intervertMinimal(fromGroup);
                const numericVal = typeof val === 'number' ? val : entier(val);
                if (isNaN(numericVal) || numericVal < minVal || numericVal > 20) return '';
                return numericVal;
            });
        });
        return cleanedMatrix;
    } else if (groupCount > 0) {
        // No matrix in data, create empty one
        return Array.from({ length: groupCount }, () => new Array<CaseMatrice>(groupCount).fill(''));
    }
    return null;
};

/**
 * Plans de feux relus du cache, structure complétée ; un projet d'avant les
 * plans de feux (une seule table d'actions) devient un plan PF1. null si le
 * projet ne porte ni l'un ni l'autre.
 */
export const plansDuCache = (data: ProjetEnregistre): { pfTabs: PlanDeFeu[]; activePFId: number | null } | null => {
    if (data.pfTabs) {
        // Migrate and validate pfTabs structure
        const groupCount = data.groups ? data.groups.length : 0;
        const migratedPfTabs = data.pfTabs.map((pf): PlanDeFeu => {
            const migrated: PlanDeFeu = { ...pf };

            // Ensure data array exists
            if (!migrated.data) {
                migrated.data = [];
            }

            // Ensure diagram array exists with valid data
            if (!migrated.diagram || !Array.isArray(migrated.diagram) || migrated.diagram.length === 0) {
                // Initialize diagram from groups if available
                if (data.groups) {
                    migrated.diagram = data.groups.map(g => ({
                        groupId: g.id,
                        offset: g.offset !== undefined && !isNaN(g.offset) ? g.offset : 0,
                        greenDuration: g.durations?.green !== undefined && !isNaN(g.durations.green) ? g.durations.green : 10,
                        da: g.da || '',
                        comment: g.comment || '',
                        commentColor: g.commentColor || '#000000',
                        phaseFlag: g.phaseFlag || ''
                    }));
                } else {
                    migrated.diagram = [];
                }
            } else {
                // Validate existing diagram entries
                migrated.diagram = migrated.diagram.map(d => ({
                    ...d,
                    offset: d.offset !== undefined && !isNaN(d.offset) ? d.offset : 0,
                    greenDuration: d.greenDuration !== undefined && !isNaN(d.greenDuration) ? d.greenDuration : 10
                }));
            }

            // Ensure conflictMatrix exists with proper size
            if (!migrated.conflictMatrix || !Array.isArray(migrated.conflictMatrix) || migrated.conflictMatrix.length === 0) {
                // Initialize from main conflict matrix or create empty
                if (data.conflictMatrix && data.conflictMatrix.length > 0) {
                    migrated.conflictMatrix = data.conflictMatrix.map(row => [...row]);
                } else if (groupCount > 0) {
                    migrated.conflictMatrix = Array.from({ length: groupCount }, () =>
                        new Array(groupCount).fill('')
                    );
                }
            }

            // Ensure remarques field exists
            if (migrated.remarques === undefined) {
                migrated.remarques = '';
            }

            return migrated;
        });
        return { pfTabs: migratedPfTabs, activePFId: data.activePFId || null };
    } else if (data.actionData) {
        // Handle old format for backward compatibility
        const groupCount = data.groups ? data.groups.length : 0;
        const initialDiagram: LigneDiagramme[] = data.groups ? data.groups.map(g => ({
            groupId: g.id,
            offset: g.offset !== undefined && !isNaN(g.offset) ? g.offset : 0,
            greenDuration: g.durations?.green !== undefined && !isNaN(g.durations.green) ? g.durations.green : 10,
            da: g.da || '',
            comment: g.comment || '',
            commentColor: g.commentColor || '#000000'
        })) : [];
        const initialMatrix = data.conflictMatrix && data.conflictMatrix.length > 0
            ? data.conflictMatrix.map(row => [...row])
            : (groupCount > 0 ? Array.from({ length: groupCount }, () => new Array<CaseMatrice>(groupCount).fill('')) : []);
        return {
            pfTabs: [{
                id: 1,
                name: 'PF1',
                data: data.actionData,
                diagram: initialDiagram,
                conflictMatrix: initialMatrix,
                remarques: ''
            }],
            activePFId: 1
        };
    }
    return null;
};

/** Matrice d'un projet ouvert depuis un fichier ou dupliqué, purgée des valeurs hors bornes. */
export const matriceDuFichier = (state: EtatProjet): Matrice => {
    if (state.conflictMatrix && Array.isArray(state.conflictMatrix)) {
        // Minimum is 0 for Piéton/Cycliste from-group, 3 for others
        const loadedGroups = state.groups || [];
        const cleanedMatrix = state.conflictMatrix.map((row, r) => row.map((val): CaseMatrice => {
            if (val === undefined || val === null) return '';
            const fromGroup = loadedGroups[r];
            const minVal = intervertMinimal(fromGroup);
            const numericVal = typeof val === 'number' ? val : entier(val);
            if (isNaN(numericVal) || numericVal < minVal || numericVal > 20) return '';
            return numericVal;
        }));
        return cleanedMatrix;
    } else {
        // Réinitialiser la matrice selon le nombre de groupes
        const groupCount = (state.groups && state.groups.length) || 5;
        return Array.from({ length: groupCount }, () => Array<CaseMatrice>(groupCount).fill(''));
    }
};

/** Largeurs des colonnes de la micro-régulation, bornées ; valeur par défaut si absente ou invalide. */
export const largeursColonnesBornees = (acw: Partial<LargeursColonnes> = {}): LargeursColonnes => {
    const clamp = (v: unknown, lo: number, hi: number, def: number) => {
        const n = Number(v);
        if (!isFinite(n)) return def;
        return Math.min(hi, Math.max(lo, Math.round(n)));
    };
    return {
        description: clamp(acw.description, 100, 350, 160),
        micro: clamp(acw.micro, 300, 700, 420),
        abrv: clamp(acw.abrv, 38, 75, 38)
    };
};
