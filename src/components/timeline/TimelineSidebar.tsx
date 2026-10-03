import React, { type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import type { DrapeauPhase, Groupe, TypeGroupe } from '../../types/projet';
import CustomTooltip from '../CustomTooltip';
import LocalInput from '../LocalInput';
import NumericInput from '../NumericInput';
import type { TimelineSimulationResult, UpdateTimelineGroup } from './timelineTypes';

const groupNameBackground = (type: TypeGroupe) => {
    if (type === 'VL' || type === 'V') return 'rgba(100, 180, 255, 0.25)';
    if (type === 'TC' || type === 'B') return 'rgba(148, 0, 211, 0.1)';
    if (type === 'Piéton' || type === 'P') return 'rgba(0, 255, 0, 0.1)';
    if (type === 'Cycliste' || type === 'CY') return 'rgba(255, 255, 0, 0.1)';
    return 'transparent';
};

interface TimelineSidebarProps {
    biCarrefourSeparator?: number | null;
    cycleLength: number;
    effectiveCycleLength: number;
    escamotageGroupIds: Set<number>;
    groups: Groupe[];
    handleEndChange: (groupId: number, value: string | number, start: number) => void;
    handleNameMouseEnter: (groupId: number) => void;
    handleNameMouseLeave: () => void;
    handlePhaseFlagKeyDown: (event: KeyboardEvent<HTMLDivElement>, groupId: number, currentFlag?: DrapeauPhase) => void;
    handleStartChange: (groupId: number, value: string | number) => void;
    hoveredArrowGroupId?: number | null;
    hoveredArrowGroupSaturated?: boolean;
    onGroupClick: (group: Groupe) => void;
    phaseFlagTooltipId?: number | null;
    readOnly?: boolean;
    showGroupNames: boolean;
    showWrapFlash: boolean;
    simulationResult?: TimelineSimulationResult | null;
    updateGroupParams: UpdateTimelineGroup;
}

const TimelineSidebar = ({
    biCarrefourSeparator,
    cycleLength,
    effectiveCycleLength,
    escamotageGroupIds,
    groups,
    handleEndChange,
    handleNameMouseEnter,
    handleNameMouseLeave,
    handlePhaseFlagKeyDown,
    handleStartChange,
    hoveredArrowGroupId,
    hoveredArrowGroupSaturated,
    onGroupClick,
    phaseFlagTooltipId,
    readOnly,
    showGroupNames,
    showWrapFlash,
    simulationResult,
    updateGroupParams
}: TimelineSidebarProps) => (
    <div className="timeline-sidebar" style={!showGroupNames ? { width: '165px' } : undefined}>
        <div className="sidebar-header-row">
            <span className="col-label col-grp">GF</span>
            {showGroupNames && <span className="col-label col-name">Nom</span>}
            <CustomTooltip text="Code trajet (2 caractères) concernant la procédure d'approche bus.">
                <span className="col-label col-da">DA</span>
            </CustomTooltip>
            <span className="col-label col-time">Déb</span>
            <span className="col-label col-time">Fin</span>
            <span className="col-label col-time">Durée</span>
        </div>

        {groups.map((group) => {
            const simulatedGroup = simulationResult?.simulatedGroups?.find((candidate) => candidate.id === group.id) ?? null;
            const isSimEscamoted = simulatedGroup?.isEscamoted || false;
            const start = simulatedGroup
                ? simulatedGroup.simulatedOffset % effectiveCycleLength
                : group.offset % cycleLength;
            const duration = simulatedGroup ? simulatedGroup.simulatedGreen : group.durations.green;
            const end = isSimEscamoted
                ? 0
                : (start + duration) % (simulatedGroup ? effectiveCycleLength : cycleLength);
            const hasValue = !isSimEscamoted && duration > 0;
            const isLabelHighlighted = hoveredArrowGroupId === group.id;
            const rowStyle: CSSProperties = {
                ...(isLabelHighlighted
                    ? { backgroundColor: hoveredArrowGroupSaturated ? 'rgba(231, 76, 60, 0.25)' : 'rgba(100, 150, 255, 0.2)' }
                    : {}),
                ...(biCarrefourSeparator != null && group.id === biCarrefourSeparator
                    ? { borderBottom: '1px solid white' }
                    : {})
            };

            return (
                <div
                    key={group.id}
                    className="row-label-container"
                    style={rowStyle}
                    tabIndex={0}
                    onClick={() => onGroupClick(group)}
                    onKeyDown={(event) => handlePhaseFlagKeyDown(event, group.id, group.phaseFlag)}
                >
                    <span className="label-id">{group.id}</span>
                    {showGroupNames && (
                        <div
                            className="label-name-wrapper"
                            onMouseEnter={() => handleNameMouseEnter(group.id)}
                            onMouseLeave={handleNameMouseLeave}
                        >
                            <span
                                className="label-name"
                                onMouseEnter={(event: MouseEvent<HTMLSpanElement>) => {
                                    const element = event.currentTarget;
                                    element.title = element.scrollWidth > element.clientWidth ? group.name : '';
                                }}
                                style={{ backgroundColor: groupNameBackground(group.type) }}
                            >
                                {group.name || '-'}
                                {(group.phaseFlag || (!group.phaseFlag && escamotageGroupIds.has(group.id))) && (
                                    <CustomTooltip text={(group.phaseFlag || 'e') === 'a' ? 'Aiguillage' : 'Escamotage'} delay={100}>
                                        <span className="phase-flag-indicator">{group.phaseFlag || 'e'}</span>
                                    </CustomTooltip>
                                )}
                            </span>
                            {phaseFlagTooltipId === group.id && (
                                <div className="phase-flag-tooltip">Alt+A : aiguillage, Alt+E : escamotage</div>
                            )}
                        </div>
                    )}
                    {(group.type === 'V' || group.type === 'B') ? (
                        <CustomTooltip text="Code trajet">
                            <LocalInput
                                className="input-da"
                                value={group.da || ''}
                                onCommit={(value: string) => updateGroupParams(group.id, { da: value.slice(0, 2) })}
                                onClick={(event: MouseEvent<HTMLInputElement>) => event.stopPropagation()}
                                selectOnFocus
                                maxLength={2}
                                placeholder=""
                                disabled={readOnly || !!simulationResult}
                                readOnly={undefined}
                                style={undefined}
                                title={undefined}
                            />
                        </CustomTooltip>
                    ) : (
                        <span className="input-da-placeholder" />
                    )}
                    {group.type ? (
                        <>
                            <NumericInput
                                className="input-time-sm"
                                value={hasValue ? start : ''}
                                onCommit={(value: string | number) => !simulationResult && handleStartChange(group.id, value)}
                                disabled={readOnly || !!simulationResult}
                                onClick={(event: MouseEvent<HTMLInputElement>) => event.stopPropagation()}
                                selectOnFocus
                                placeholder=""
                                min={undefined}
                                max={undefined}
                                maxLength={undefined}
                                style={undefined}
                                title={undefined}
                                wrapAt={cycleLength}
                                showWrapFlash={showWrapFlash}
                            />
                            <NumericInput
                                className="input-time-sm"
                                value={hasValue ? end : ''}
                                onCommit={(value: string | number) => !simulationResult && handleEndChange(group.id, value, start)}
                                disabled={readOnly || !!simulationResult}
                                onClick={(event: MouseEvent<HTMLInputElement>) => event.stopPropagation()}
                                selectOnFocus
                                min={undefined}
                                max={undefined}
                                maxLength={undefined}
                                wrapAt={cycleLength}
                                showWrapFlash={showWrapFlash}
                                style={{ color: duration < group.minGreen ? '#ff4d4d' : 'inherit' }}
                                title={undefined}
                                placeholder=""
                            />
                            <CustomTooltip text="Durée nominale dans le cycle">
                                <input
                                    type="number"
                                    className="input-time-sm"
                                    value={hasValue && duration > 0 ? duration : ''}
                                    readOnly
                                    onClick={(event: MouseEvent<HTMLInputElement>) => event.stopPropagation()}
                                    style={{
                                        color: duration < group.minGreen ? '#ff4d4d' : 'inherit',
                                        cursor: 'default',
                                        background: 'transparent',
                                        border: 'none'
                                    }}
                                    placeholder=""
                                />
                            </CustomTooltip>
                        </>
                    ) : (
                        <>
                            <span className="input-time-sm-placeholder" />
                            <span className="input-time-sm-placeholder" />
                            <span className="input-time-sm-placeholder" />
                        </>
                    )}
                </div>
            );
        })}
    </div>
);

export default TimelineSidebar;
