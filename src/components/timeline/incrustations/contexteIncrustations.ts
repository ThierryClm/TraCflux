import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ActionPlage, GroupId, SectionGroupes, ShiftedActionPosition } from '../timelineSimulation';
import type { ActionTimeField, TimelineDragState } from '../useTimelineDrag';
import type { ActionMicro, Groupe } from '../../../types/projet';

/**
 * Socle commun des incrustations du diagramme : géométrie des lignes, survol,
 * glisser-déposer des actions et positions recalculées en simulation.
 */
export interface ContexteIncrustations {
    groups: Groupe[];
    pixelsPerSecond: number;
    cycleLength: number;
    effectiveCycleLength: number;
    RULER_HEIGHT: number;
    ROW_HEIGHT: number;
    ROW_TOTAL_HEIGHT: number;
    svgHeight: number;
    totalWidth: number;
    hoveredActionId: number | null | undefined;
    setHoveredActionId: (id: number | null) => void;
    dragState: TimelineDragState | null;
    handleActionDragStart: (event: ReactMouseEvent, actionId: number, field: ActionTimeField, currentValue: string | number) => void;
    getShiftedActionPosition: (deb: number, fin: number, groupId?: GroupId | null, actionType?: string | null, actionPlage?: ActionPlage | null, actionId?: number | null, section?: SectionGroupes | null) => ShiftedActionPosition;
}

/** Action dont la plage de groupes (plage1, plage2) a été complétée. */
export type ActionAPlage = Omit<ActionMicro, 'plage1' | 'plage2'> & { plage1: string | number; plage2: string | number };

/** Morceau d'un cadre pleine largeur : sa position et les lignes qu'il couvre. */
export type MorceauCadre = ShiftedActionPosition & { premierIdx: number; dernierIdx: number };

/** Découpe d'un cadre pleine largeur en morceaux (deux en bicarrefour). */
export type MorceauxPleineLargeur = (origDeb: number, origFin: number, actionType: string, actionId: number) => MorceauCadre[];
