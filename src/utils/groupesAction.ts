import { entier } from './entier';
import type { ActionMicro } from '../types/projet';

/** Numéro de groupe lu dans un champ de condition (« 9 », « G9 », 9) ; NaN sinon. */
const numeroGf = (v: unknown) => entier(String(v ?? '').replace(/[Gg]/g, '').trim());

/**
 * Groupes dont la flèche s'allume au survol d'une action dans l'onglet
 * Simulation : le groupe de l'action (GF) et ceux de sa plage (Plage 1 → 2).
 * Les groupes des colonnes « Action GF » ne s'allument pas.
 */
export const groupesSurlignesParAction = (action: Pick<ActionMicro, 'gf' | 'plage1' | 'plage2'> | null | undefined): number[] => {
    if (!action) return [];
    const groupes = new Set<number>();
    const gf = numeroGf(action.gf);
    if (gf > 0) groupes.add(gf);
    const debut = numeroGf(action.plage1);
    const fin = numeroGf(action.plage2);
    if (debut > 0 && fin > 0) {
        for (let g = Math.min(debut, fin); g <= Math.max(debut, fin); g++) groupes.add(g);
    } else if (debut > 0) {
        groupes.add(debut);
    } else if (fin > 0) {
        groupes.add(fin);
    }
    return [...groupes];
};
