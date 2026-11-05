import type { ActionAPlage, ContexteIncrustations } from './contexteIncrustations';
import { entier } from '../../../utils/entier';

/** Instant, en secondes, où se dessine une action ; null si elle n'a pas de place. */
export type InstantAction = number | null;

const plageValide = ({ groups }: ContexteIncrustations, action: ActionAPlage) => {
    const plage1 = entier(action.plage1) || 0;
    const plage2 = entier(action.plage2) || 0;
    return plage1 >= 1 && plage2 >= 1 && plage1 <= groups.length && plage2 <= groups.length;
};

/** Point de repos : il suit les décalages de la simulation. */
export const instantPointDeRepos = (ctx: ContexteIncrustations, action: ActionAPlage): InstantAction => {
    if (!plageValide(ctx, action)) return null;
    const rawDeb = entier(action.deb) || 0;
    const plage = { plage1: entier(action.plage1) || 0, plage2: entier(action.plage2) || 0 };
    const shiftedPos = ctx.getShiftedActionPosition(rawDeb, rawDeb, null, 'Point de repos', plage);
    return shiftedPos.hidden ? null : shiftedPos.deb;
};

/**
 * Synchro BTS et Instant Co : repère fixe, que les autres actions simulées ne
 * déplacent pas. Au-delà d'un cycle simulé raccourci, il n'a plus de place.
 */
export const instantRepereFixe = (ctx: ContexteIncrustations, action: ActionAPlage): InstantAction => {
    if (!plageValide(ctx, action)) return null;
    const rawDeb = entier(action.deb) || 0;
    return rawDeb < ctx.effectiveCycleLength ? rawDeb : null;
};
