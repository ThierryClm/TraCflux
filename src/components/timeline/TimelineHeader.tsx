import React, { type ChangeEvent } from 'react';
import CustomTooltip from '../CustomTooltip';
import NumericInput from '../NumericInput';
import type { TimelineSimulationResult } from './timelineTypes';

interface TimelineHeaderProps {
    activePFName?: string;
    cycleLength: number;
    cycleLengthInput?: string | number;
    cycleSimulationSpeed?: (() => void) | null;
    isPlayingSimulation: boolean;
    onDetach?: (() => void) | null;
    planName?: string;
    readOnly?: boolean;
    setCycleLength?: (value: number) => void;
    setCycleLengthInput?: (value: string) => void;
    setIsPlayingSimulation?: (value: boolean) => void;
    setSimulationCurrentTime?: (value: number) => void;
    simulationCurrentTime?: number | null;
    simulationResult?: TimelineSimulationResult | null;
    simulationSpeed: number;
    titreEnBandeau?: boolean;
    tooltipsEnabled: boolean;
}

const TimelineHeader = ({
    activePFName,
    cycleLength,
    cycleLengthInput,
    cycleSimulationSpeed,
    isPlayingSimulation,
    onDetach,
    planName,
    readOnly,
    setCycleLength,
    setCycleLengthInput,
    setIsPlayingSimulation,
    setSimulationCurrentTime,
    simulationCurrentTime,
    simulationResult,
    simulationSpeed,
    titreEnBandeau,
    tooltipsEnabled
}: TimelineHeaderProps) => {
    if (titreEnBandeau) return null;

    const tip = (text: string) => tooltipsEnabled ? text : undefined;
    const displayedCycleLength = simulationResult?.simulatedCycleLength || cycleLength;

    const commitCycleLength = (value: string | number) => {
        const newCycle = parseInt(String(value), 10);
        if (!isNaN(newCycle) && newCycle >= 10 && newCycle !== cycleLength && setCycleLength) {
            setCycleLength(newCycle);
        } else {
            setCycleLengthInput?.(cycleLength.toString());
        }
    };

    return (
        <h3 className="diagram-title">
            <span>Diagramme{planName ? ` : simulation du plan de feu ${planName}` : (activePFName ? ` - ${activePFName}` : '')}</span>
            {setCycleLengthInput && (
                (planName || readOnly) ? (
                    <span style={{ marginLeft: '50px', fontSize: '14px', fontWeight: 'normal' }}>
                        Cycle {displayedCycleLength} secondes
                    </span>
                ) : (
                    <label className="cycle-input-label" style={{ marginLeft: '50px', fontSize: '14px', fontWeight: 'normal' }}>
                        Cycle:
                        <NumericInput
                            className="input-count"
                            value={cycleLengthInput}
                            min={10}
                            max={undefined}
                            maxLength={undefined}
                            allowEmpty={false}
                            onClick={undefined}
                            selectOnFocus
                            onCommit={commitCycleLength}
                            style={undefined}
                            title={tip('Durée du cycle (min 10s)')}
                            wrapAt={undefined}
                        />
                        <span>s</span>
                    </label>
                )
            )}
            {onDetach && !readOnly && (
                <button
                    className="detach-btn diagram-detach-btn"
                    onClick={onDetach}
                    title={tip('Ouvrir le diagramme dans une fenêtre séparée (miroir lecture seule, ex. 2e écran)')}
                >Détacher</button>
            )}
            {planName && setIsPlayingSimulation && !readOnly && (
                <div className="diagram-playback" style={{ marginLeft: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'normal' }}>
                    <CustomTooltip text={isPlayingSimulation ? 'Pause' : 'Lecture'}>
                        <button
                            className={`sim-btn ${isPlayingSimulation ? 'playing' : ''}`}
                            onClick={() => setIsPlayingSimulation(!isPlayingSimulation)}
                            aria-label={isPlayingSimulation ? 'Mettre la simulation en pause' : 'Lancer la simulation'}
                        >
                            {isPlayingSimulation ? '⏸' : '▶'}
                        </button>
                    </CustomTooltip>
                    <CustomTooltip text="Réinitialiser">
                        <button
                            className="sim-btn reset-btn"
                            onClick={() => { setIsPlayingSimulation(false); setSimulationCurrentTime?.(0); }}
                            aria-label="Réinitialiser la simulation"
                        >
                            ⏹
                        </button>
                    </CustomTooltip>
                    {cycleSimulationSpeed && (
                        <CustomTooltip text="Vitesse de déroulement — cliquer pour changer">
                            <button
                                className={`sim-btn sim-speed-btn ${simulationSpeed > 1 ? 'accelere' : ''}`}
                                onClick={cycleSimulationSpeed}
                                aria-label={`Vitesse de déroulement : ×${simulationSpeed}. Cliquer pour changer.`}
                            >
                                ×{simulationSpeed}
                            </button>
                        </CustomTooltip>
                    )}
                    <CustomTooltip text="Position dans le cycle">
                        <input
                            type="range"
                            min="0"
                            max={displayedCycleLength - 1}
                            value={simulationCurrentTime || 0}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => setSimulationCurrentTime?.(parseInt(event.target.value, 10) || 0)}
                            className="time-slider"
                            aria-label="Position courante dans le cycle de simulation"
                        />
                    </CustomTooltip>
                    <span className="sim-time" style={{ color: '#fff', whiteSpace: 'nowrap', fontSize: '14px' }}>
                        {simulationCurrentTime || 0}s / {displayedCycleLength}s
                    </span>
                </div>
            )}
        </h3>
    );
};

export default TimelineHeader;
