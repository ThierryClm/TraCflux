import React from 'react';
import EmptyState from '../EmptyState';

export const TimelineEmptyState = ({ conflictMatrix, groups, tooltipsEnabled }) => {
    if (groups.length === 0 || groups.some((group) => (group.durations?.green || 0) > 0)) return null;

    const formEmpty = groups.every((group) => !group.type || group.type === '');
    const matrixEmpty = Array.isArray(conflictMatrix)
        && conflictMatrix.length > 0
        && conflictMatrix.every((row) => row.every((value) => value === '' || value === null || value === undefined));
    const steps = [];
    if (formEmpty) steps.push('Renseigner le formulaire des groupes de feu (onglet Configuration)');
    if (matrixEmpty) steps.push('Renseigner la matrice des temps interverts');
    steps.push('Saisir les durées de vert pour voir les phases apparaître');

    return (
        <div className="empty-state-overlay">
            <EmptyState
                icon="diagram"
                title={tooltipsEnabled ? 'Diagramme vide' : undefined}
                hint={`Veuillez :\n${steps.map((step) => `•  ${step}`).join('\n')}`}
            />
        </div>
    );
};

const TimelineGridBackground = ({
    groups,
    isPlayingSimulation,
    pixelsPerSecond,
    playbackTime,
    rowTotalHeight,
    rulerHeight,
    simulationCurrentTime,
    simulationResult,
    timeWindow,
    tooltipsEnabled
}) => {
    const overlayHeight = rulerHeight + 1 + groups.length * rowTotalHeight + 30;
    const tip = (text) => tooltipsEnabled ? text : undefined;

    return (
        <>
            <div className="timeline-grid">
                {Array.from({ length: timeWindow + 1 }).map((_, index) => {
                    let gridClass = 'grid-line grid-1s';
                    if (index === timeWindow) gridClass = 'grid-line grid-cycle-end';
                    else if (index % 10 === 0) gridClass = 'grid-line grid-10s';
                    else if (index % 5 === 0) gridClass = 'grid-line grid-5s';
                    return <div key={index} className={gridClass} style={{ left: `${index * pixelsPerSecond}px` }} />;
                })}
            </div>

            <div className="timeline-ruler">
                {Array.from({ length: timeWindow / 5 + 1 }).map((_, index) => (
                    <div key={index} className="ruler-tick" style={{ left: `${index * 5 * pixelsPerSecond}px` }}>
                        {index * 5}
                    </div>
                ))}
                {playbackTime !== null && (
                    <div
                        className="ruler-playback"
                        style={{ width: `${(((playbackTime % timeWindow) + timeWindow) % timeWindow) * pixelsPerSecond}px` }}
                        title={tip(`Animation en cours — ${Math.floor(playbackTime)}s / ${timeWindow}s`)}
                    />
                )}
            </div>

            {simulationResult?.restPoints?.map((restPoint, index) => (
                <div
                    key={`rest-${index}`}
                    className="rest-point-band"
                    style={{
                        left: `${restPoint.deb * pixelsPerSecond}px`,
                        width: `${restPoint.duration * pixelsPerSecond}px`,
                        height: `${overlayHeight}px`
                    }}
                    title={tip(`Point de repos — ${restPoint.duration}s à t=${restPoint.originalDeb}s`)}
                >
                    <span className="rest-point-label">Repos</span>
                </div>
            ))}

            {simulationCurrentTime !== null && (
                <div
                    className={`simulation-playhead ${isPlayingSimulation ? 'playing' : ''}`}
                    style={{
                        left: `${simulationCurrentTime * pixelsPerSecond}px`,
                        height: `${overlayHeight}px`
                    }}
                >
                    <div className="playhead-time">{simulationCurrentTime}s</div>
                </div>
            )}
        </>
    );
};

export default TimelineGridBackground;
