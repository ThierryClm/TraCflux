import { entier } from '../../utils/entier';
import type { ActionMicro, Groupe } from '../../types/projet';
import type { TrafficConflict } from '../../utils/conflictUtils';
import type { TimelineConflict } from './useTimelineDrag';

/** Même filtrage pour le fond du diagramme et le repère fixe. */
export const groupeEnConflit = (group: Groupe, groups: Groupe[], activeConflicts: (TrafficConflict | TimelineConflict)[], selectedEscamotageGroup: ActionMicro[]) => activeConflicts.some(c => {
    if (c.from !== group.id && c.to !== group.id) return false;
    // Un escamotage sélectionné peut inhiber ce conflit.
    const isInhibitedByEscamotage = selectedEscamotageGroup.some(action => {
        const sourceGfId = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
        const targetGfId = entier(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
        return (sourceGfId === c.from && targetGfId === c.to) ||
               (sourceGfId === c.to && targetGfId === c.from);
    });
    if (isInhibitedByEscamotage) return false;
    // Le drapeau de phase du groupe source gère ce conflit.
    const fromGrp = groups.find(g => g.id === c.from);
    if (fromGrp?.phaseFlag) return false;
    return true;
});
