import { entier } from './entier';
import type { ActionMicro, Groupe } from '../types/projet';

/** Numéro de groupe lu dans un champ de condition (« 9 », « G9 », 9) ; NaN sinon. */
const numeroGf = (v: unknown) => entier(String(v ?? '').replace(/[Gg]/g, '').trim());

/** Actions à zone : seuls les groupes dont le vert tombe dans la zone sont concernés. */
const ACTIONS_A_ZONE = ['Adaptatif vertical', 'Escamotage de phase'];

/** Plage Plage 1 → 2 de l'action (bornes dans les deux sens) ; null si elle n'en a pas. */
const plageDe = (action: Pick<ActionMicro, 'plage1' | 'plage2'>): [number, number] | null => {
    const debut = numeroGf(action.plage1);
    const fin = numeroGf(action.plage2);
    if (debut > 0 && fin > 0) return [Math.min(debut, fin), Math.max(debut, fin)];
    if (debut > 0) return [debut, debut];
    if (fin > 0) return [fin, fin];
    return null;
};

/** Le vert [début, début + durée[ chevauche-t-il la zone [deb, fin[, sur un cycle ? */
const vertDansZone = (groupe: Groupe, deb: number, fin: number, cycle: number): boolean => {
    const vert = groupe.durations?.green || 0;
    if (vert <= 0 || cycle <= 0) return false;
    const mod = (t: number) => ((t % cycle) + cycle) % cycle;
    // Les secondes du cycle couvertes par le vert, puis par la zone.
    const debutVert = mod(groupe.offset || 0);
    const debutZone = mod(deb);
    const largeurZone = fin > deb ? fin - deb : mod(fin - deb);
    for (let s = 0; s < vert; s++) {
        if (mod(debutVert + s - debutZone) < largeurZone) return true;
    }
    return false;
};

/**
 * Groupes dont la flèche s'allume au survol d'une action dans l'onglet
 * Simulation :
 * - adaptatif vertical, escamotage de phase : les groupes dont le vert tombe
 *   dans la zone [Déb, Fin] de l'action — dans sa plage si elle en a une ;
 * - autres actions : le groupe de l'action (GF) et ceux de sa plage.
 * Les groupes des colonnes « Action GF » ne s'allument jamais.
 */
export const groupesSurlignesParAction = (
    action: Pick<ActionMicro, 'action' | 'gf' | 'plage1' | 'plage2' | 'deb' | 'fin'> | null | undefined,
    groupes: Groupe[] = [],
    cycle = 0
): number[] => {
    if (!action) return [];
    const plage = plageDe(action);
    const deb = entier(action.deb);
    const fin = entier(action.fin);
    if (ACTIONS_A_ZONE.includes(action.action) && !isNaN(deb) && !isNaN(fin)) {
        return groupes
            .filter(g => !plage || (g.id >= plage[0] && g.id <= plage[1]))
            .filter(g => vertDansZone(g, deb, fin, cycle))
            .map(g => g.id);
    }
    const ids = new Set<number>();
    const gf = numeroGf(action.gf);
    if (gf > 0) ids.add(gf);
    if (plage) for (let g = plage[0]; g <= plage[1]; g++) ids.add(g);
    return [...ids];
};
