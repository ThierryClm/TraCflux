import React from 'react';
import { tokenizeMicroText } from '../../utils/microVariables';

const floatingValueStyle = (dragState) => ({
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

const FloatingValue = ({ dragState, value }) => (
    <div style={floatingValueStyle(dragState)}>{Math.round(value)}s</div>
);

const joinFrench = (items) => items.length <= 1
    ? (items[0] || '')
    : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;

const ActionTooltip = ({ actionData, actionTooltip, microVariableNames }) => {
    if (!actionTooltip) return null;

    const action = actionData.find((candidate) => candidate.id === actionTooltip.actionId);
    if (!action) return null;

    const deb = parseInt(action.deb) || 0;
    const fin = parseInt(action.fin) || 0;
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
                    {tokenizeMicroText(action.micro, microVariableNames).map((token, index) =>
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

const TimelineFloatingOverlays = ({ actionData, actionTooltip, cycleLength, dragState, microVariableNames }) => {
    const hasGroupDragValue = dragState
        && dragState.deltaSeconds !== undefined
        && dragState.mouseX !== undefined
        && dragState.groupId !== undefined;
    const groupDragValue = hasGroupDragValue
        ? ((dragState.initialValue + dragState.deltaSeconds) % cycleLength + cycleLength) % cycleLength
        : null;
    const hasActionDragValue = dragState
        && dragState.showTooltip
        && dragState.mouseX !== undefined
        && dragState.currentValue !== undefined;

    return (
        <>
            {hasGroupDragValue && <FloatingValue dragState={dragState} value={groupDragValue} />}
            {hasActionDragValue && <FloatingValue dragState={dragState} value={dragState.currentValue} />}
            <ActionTooltip actionData={actionData} actionTooltip={actionTooltip} microVariableNames={microVariableNames} />
        </>
    );
};

export default TimelineFloatingOverlays;
