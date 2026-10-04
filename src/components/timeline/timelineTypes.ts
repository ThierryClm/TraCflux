import type { ActionMicro, Groupe } from '../../types/projet';

export interface TimelineSimulatedGroup {
    id: number;
    simulatedOffset: number;
    simulatedGreen: number;
    isEscamoted?: boolean;
}

export interface TimelineRestPoint {
    deb: number;
    duration: number;
    originalDeb: number;
}

/** Sous-ensemble du résultat de simulation consommé par les composants visuels. */
export interface TimelineSimulationResult {
    simulatedCycleLength?: number;
    simulatedGroups?: TimelineSimulatedGroup[];
    restPoints?: TimelineRestPoint[];
}

export interface TimelineDragState {
    groupId?: number;
    initialValue?: number;
    deltaSeconds?: number;
    mouseX?: number;
    mouseY?: number;
    showTooltip?: boolean;
    currentValue?: number;
}

export interface TimelineActionTooltip {
    actionId: ActionMicro['id'];
    showMicro: boolean;
    x: number;
    y: number;
}

export type UpdateTimelineGroup = (groupId: number, params: Partial<Groupe>) => void;
