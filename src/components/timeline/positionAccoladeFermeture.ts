import type { ActionMicro, Groupe } from '../../types/projet';
import type { SimulationResult } from '../../simulation/types';
import type { ContexteIncrustations } from './incrustations/contexteIncrustations';
import { entier } from '../../utils/entier';

export interface ZoneAccolade {
    deb: number; fin: number; rawDeb: number; rawFin: number;
    plage1?: number; plage2?: number; isPartial?: boolean;
}

/** Position commune à l’accolade et aux flèches Action GF, y compris en simulation. */
export const positionAccoladeFermeture = (
    action: ActionMicro, group: Groupe, ctx: ContexteIncrustations,
    simulationResult: SimulationResult | null, braceZoneRanges: ZoneAccolade[] = []
) => {
    const { cycleLength, effectiveCycleLength, getShiftedActionPosition } = ctx;
    const simGroup = ctx.getSimulatedGroup(group.id);
    const origDeb = entier(action.deb) || 0, origFin = entier(action.fin) || 0;
    const shifted = getShiftedActionPosition(origDeb, origFin, group.id, action.action, null, action.id);
    const { deb, fin } = shifted;
    // For Fermeture anticipée: calculate brace start position
    // Si l'adaptatif vertical décale la fin de vert, l'accolade se décale du même delta
    // Si la fin de vert n'est pas décalée, l'accolade reste à sa position d'origine
    let fermetureStartPos = deb; // Default to shifted deb
    let fermetureEndPos = fin; // Default to shifted fin
    if (action.action === 'Fermeture anticipée' && simGroup) {
        const originalGreenEnd = group.offset + group.durations.green;
        const simulatedGreenEnd = simGroup.simulatedOffset + simGroup.simulatedGreen;
        // Compare modular ends (not raw sums) to detect actual end-of-green change
        // Wrapping groups may have different raw sums but same modular end
        const originalGreenEndMod = originalGreenEnd % cycleLength;
        const simulatedGreenEndMod = simulatedGreenEnd % effectiveCycleLength;
        if (originalGreenEndMod !== simulatedGreenEndMod) {
            // Vérifier si un Point de repos étire ce vert. Dans ce cas, on
            // ne repositionne PAS (la logique « suivre la fin de vert » est
            // conçue pour AV/EP, où le vert se DÉPLACE ; avec PR il s'ÉTIRE,
            // et la fermeture doit suivre la règle uniforme deb < t inchangé,
            // deb >= t décalé — déjà calculée par getShiftedActionPosition).
            const greenStartOrig = group.offset;
            const greenEndOrig = group.offset + group.durations.green;
            // Un vert qui chevauche la fin du cycle couvre aussi, au début du
            // cycle suivant, les instants jusqu'à greenEndOrig - cycleLength.
            const restPointStretchesGreen = simulationResult?.restPoints?.some(rp =>
                (rp.originalDeb >= greenStartOrig && rp.originalDeb <= greenEndOrig) ||
                rp.originalDeb <= greenEndOrig - cycleLength
            );

            // Vérifier si l'accolade chevauche une zone AV/EP (début avant, fin dans ou après la zone)
            let straddlesZone = false;
            for (const zone of braceZoneRanges) {
                if (zone.isPartial) {
                    const gId = group.id;
                    if (gId < (zone.plage1 ?? 0) || gId > (zone.plage2 ?? 0)) continue;
                }
                // La fermeture chevauche la zone : début avant, fin dans ou après
                if (origDeb < zone.rawDeb && origFin > zone.rawDeb) {
                    straddlesZone = true;
                    break;
                }
            }

            if (!straddlesZone && !restPointStretchesGreen) {
                // Pas de chevauchement AV/EP et pas d'étirement par PR :
                // repositionner relativement à la fin de vert simulée
                const simGreenEnd = simulatedGreenEnd % effectiveCycleLength;
                fermetureStartPos = ((simGreenEnd + (origDeb - originalGreenEnd)) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
                fermetureEndPos = ((simGreenEnd + (origFin - originalGreenEnd)) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
            }
            // Sinon : garder deb/fin de getShiftedActionPosition (déjà corrects)
        }
    }
    // Tronquer l'accolade si elle chevauche une zone Adaptatif partiel
    // Les zones full (AV/EP sélectionnées) sont retirées de la timeline,
    // donc la troncature ne s'applique qu'aux zones partielles
    if (action.action === 'Fermeture anticipée') {
        for (const zone of braceZoneRanges) {
            // Seules les zones partielles tronquent les accolades
            if (!zone.isPartial) continue;
            const gId = group.id;
            if (gId < (zone.plage1 ?? 0) || gId > (zone.plage2 ?? 0)) continue;
            // Seule une accolade qui chevauche la zone dans le plan
            // d'origine est tronquée. Les positions comparées
            // ci-dessous sont déjà décalées : une accolade située
            // après la zone, ramenée vers la gauche de la durée de
            // l'adaptatif, y retombait et voyait son début repoussé
            // en fin de zone au lieu de suivre le décalage.
            const chevauche = (debut: number, finale: number) => debut < zone.rawFin && finale > zone.rawDeb;
            const chevaucheOrigine = origDeb <= origFin
                ? chevauche(origDeb, origFin)
                : chevauche(origDeb, cycleLength) || chevauche(0, origFin);
            if (!chevaucheOrigine) continue;
            if (zone.deb < zone.fin && fermetureStartPos < fermetureEndPos) {
                if (fermetureStartPos < zone.deb && fermetureEndPos > zone.deb) {
                    // Début accolade < début zone : tronquer la fin au début de la zone
                    fermetureEndPos = zone.deb;
                } else if (fermetureStartPos >= zone.deb && fermetureStartPos < zone.fin) {
                    // Début accolade dans la zone : pousser le début après la zone
                    fermetureStartPos = zone.fin;
                }
            }
        }
    }
    const duree = fermetureEndPos >= fermetureStartPos
        ? fermetureEndPos - fermetureStartPos
        : effectiveCycleLength - fermetureStartPos + fermetureEndPos;
    const sansAccolade = action.action === 'Fermeture anticipée' && (
        duree <= 0 || duree >= effectiveCycleLength - 1 || simGroup?.isEscamoted ||
        (simGroup ? simGroup.simulatedGreen : group.durations.green) <= 0);
    return { deb: fermetureStartPos, fin: fermetureEndPos, hidden: shifted.hidden || sansAccolade };
};
