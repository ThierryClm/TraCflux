import React, { type CSSProperties } from 'react';
import type { ActionMicro } from '../../types/projet';
import { tokenizeMicroText } from '../../utils/microVariables';
import type { TimelineActionTooltip, TimelineDragState } from './timelineTypes';

interface FloatingPosition {
    mouseX: number;
    mouseY: number;
}

const floatingValueStyle = (dragState: FloatingPosition): CSSProperties => ({
    position: 'fixed',
    left: dragState.mouseX + 12,
    top: dragState.mouseY - 28,
    background: '#222',
    color: '#4ecdc4',
    border: '1px solid #4ecdc4',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '16px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    pointerEvents: 'none',
    zIndex: 9999,
    whiteSpace: 'nowrap'
});

interface FloatingValueProps {
    dragState: FloatingPosition;
    value: number;
}

const FloatingValue = ({ dragState, value }: FloatingValueProps) => (
    <div style={floatingValueStyle(dragState)}>{Math.round(value)}s</div>
);

const joinFrench = (items: string[]) => items.length <= 1
    ? (items[0] || '')
    : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;

interface ActionTooltipProps {
    actionData: ActionMicro[];
    actionTooltip: TimelineActionTooltip | null;
    microVariableNames: string[];
}

interface MicroToken {
    text: string;
    type: 'keyword' | 'bold' | 'text';
}

const ActionTooltip = ({ actionData, actionTooltip, microVariableNames }: ActionTooltipProps) => {
    if (!actionTooltip) return null;

    const action = actionData.find((candidate) => candidate.id === actionTooltip.actionId);
    if (!action) return null;

    const deb = parseInt(String(action.deb ?? ''), 10) || 0;
    const fin = parseInt(String(action.fin ?? ''), 10) || 0;
    const isPointInTime = action.action === 'Point de repos'
        || action.action === 'Instant Co' || action.action === 'Instant CO';
    const glissementGroups = action.action === 'Fermeture anticipée'
        ? [action.actGf1, action.actGf1Gf2, action.actGf1Gf3, action.actGf1Gf4]
            .map((value) => (value == null ? '' : value.toString().replace(/[^0-9]/g, '').trim()))
            .filter((value) => value !== '')
            .map((value) => `GF${value}`)
        : [];
    const hasMicro = actionTooltip.showMicro && action.micro;

    return (
        <div className="action-hover-tooltip" style={{
            position: 'fixed',
            left: actionTooltip.x + 12,
            top: actionTooltip.y + 8,
            pointerEvents: 'none',
            zIndex: 9999,
            maxWidth: '350px'
        }}>
            <div className="action-hover-tooltip-name">{action.action}</div>
            <div className="action-hover-tooltip-seconds">{isPointInTime ? `seconde ${deb}` : `seconde ${deb} à ${fin}`}</div>
            {glissementGroups.length > 0 && (
                <div className="action-hover-tooltip-seconds">glissement sur {joinFrench(glissementGroups)}</div>
            )}
            {hasMicro && (
                <div className="action-hover-tooltip-micro">
                    {tokenizeMicroText(action.micro ?? '', microVariableNames).map((token: MicroToken, index: number) =>
                        token.type === 'keyword'
                            ? <span key={index} className="micro-keyword">{token.text}</span>
                            : token.type === 'bold'
                                ? <span key={index} className="micro-bold">{token.text}</span>
                                : token.text
                    )}
                </div>
            )}
        </div>
    );
};

interface TimelineFloatingOverlaysProps {
    actionData: ActionMicro[];
    actionTooltip: TimelineActionTooltip | null;
    cycleLength: number;
    dragState: TimelineDragState | null;
    microVariableNames: string[];
}

const TimelineFloatingOverlays = ({ actionData, actionTooltip, cycleLength, dragState, microVariableNames }: TimelineFloatingOverlaysProps) => {
    let groupDrag: { position: FloatingPosition; value: number } | null = null;
    let actionDrag: { position: FloatingPosition; value: number } | null = null;

    if (dragState
        && typeof dragState.deltaSeconds === 'number'
        && typeof dragState.initialValue === 'number'
        && typeof dragState.mouseX === 'number'
        && typeof dragState.mouseY === 'number'
        && typeof dragState.groupId === 'number') {
        groupDrag = {
            position: { mouseX: dragState.mouseX, mouseY: dragState.mouseY },
            value: ((dragState.initialValue + dragState.deltaSeconds) % cycleLength + cycleLength) % cycleLength
        };
    }

    if (dragState
        && dragState.showTooltip
        && typeof dragState.mouseX === 'number'
        && typeof dragState.mouseY === 'number'
        && typeof dragState.currentValue === 'number') {
        actionDrag = {
            position: { mouseX: dragState.mouseX, mouseY: dragState.mouseY },
            value: dragState.currentValue
        };
    }

    return (
        <>
            {groupDrag && <FloatingValue dragState={groupDrag.position} value={groupDrag.value} />}
            {actionDrag && <FloatingValue dragState={actionDrag.position} value={actionDrag.value} />}
            <ActionTooltip actionData={actionData} actionTooltip={actionTooltip} microVariableNames={microVariableNames} />
        </>
    );
};

export default TimelineFloatingOverlays;
