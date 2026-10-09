import { intersectionTitle } from '../../utils/greenWaveRelink';
import type { GreenWaveIntersection } from '../../types/greenWave';

/** Sens de la ligne survolée dans le tableau : GF montant (M) ou descendant (D). */
export type GreenWaveDirection = 'M' | 'D';

/** Champ de distance en cours de saisie : g1 = GF descendant, g2 = GF montant. */
export type DistanceField = 'g1' | 'g2';

interface GreenWaveDataPanelProps {
    intersections: GreenWaveIntersection[] | null;
    /** Titre du projet lu dans le cache, par nom de fichier, pour les ondes vertes qui ne le conservaient pas. */
    cachedTitles: Record<string, string | null>;
    /** Saisies de distance pas encore validées, clé `${idx}.g1|g2`. */
    distanceDrafts: Record<string, string>;
    isHovered: (idx: number, direction: GreenWaveDirection) => boolean;
    onHover: (cell: { idx: number; direction: GreenWaveDirection } | null) => void;
    /** Affiche le bouton « Détacher » (tableau rendu sous le diagramme). */
    showDetachButton: boolean;
    onDetach: () => void;
    onAddIntersection: () => void;
    onMove: (idx: number, direction: 'up' | 'down') => void;
    onRelink: (idx: number) => void;
    onSelectPf: (idx: number, pfId: number) => void;
    onSelectGroupUp: (idx: number, groupId: number) => void;
    onSelectGroupDown: (idx: number, groupId: number) => void;
    onDistanceChange: (idx: number, field: DistanceField, value: string) => void;
    onDistanceCommit: (idx: number, field: DistanceField) => void;
}

/**
 * Tableau des données saisies, partagé entre le rendu sous le diagramme et la
 * fenêtre détachée. Une ligne dont le cycle diffère du cycle le plus fréquent
 * est signalée.
 */
const GreenWaveDataPanel = ({
    intersections, cachedTitles, distanceDrafts, isHovered, onHover,
    showDetachButton, onDetach, onAddIntersection, onMove, onRelink,
    onSelectPf, onSelectGroupUp, onSelectGroupDown, onDistanceChange, onDistanceCommit
}: GreenWaveDataPanelProps) => {
    const cycleCounts: Record<number, number> = {};
    intersections?.forEach(i => {
        const c = i.cycleLength || 0;
        cycleCounts[c] = (cycleCounts[c] || 0) + 1;
    });
    const mostCommonCycle = Object.entries(cycleCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
    const referenceCycle = parseInt(mostCommonCycle as string) || 0;

    return (
        <div className="green-wave-params-panel">
            <h3>
                Tableau des données saisies
                <button
                    className="btn-add-intersection"
                    onClick={onAddIntersection}
                    title="Ajouter un carrefour"
                >+</button>
                {showDetachButton && (
                    <button
                        className="btn-detach-datatable"
                        onClick={onDetach}
                        title="Ouvrir le tableau dans une fenêtre séparée pour libérer l'espace"
                    >Détacher</button>
                )}
            </h3>
            <table className="green-wave-data-table">
                <thead>
                    <tr>
                        <th rowSpan={2}>Ordre</th>
                        <th rowSpan={2}>Carrefour</th>
                        <th rowSpan={2}>PF</th>
                        <th rowSpan={2}>Cycle</th>
                        <th colSpan={2} className="gf-montant-header">GF Montant</th>
                        <th colSpan={2} className="gf-descendant-header">GF Descendant</th>
                    </tr>
                    <tr className="sub-header">
                        <th style={{ color: '#4CAF50' }}>Groupe</th>
                        <th style={{ color: '#4CAF50' }}>Dist</th>
                        <th style={{ color: '#FF9800' }}>Groupe</th>
                        <th style={{ color: '#FF9800' }}>Dist</th>
                    </tr>
                </thead>
                <tbody>
                    {intersections?.map((intersection, idx) => {
                        const hasCycleConflict = intersection.cycleLength !== referenceCycle;

                        return (
                            <tr
                                key={idx}
                                className={hasCycleConflict ? 'row-cycle-conflict' : ''}
                                title={`Fichier : ${intersection.projectName}`}
                            >
                                <td className="col-order">
                                    <div className="order-controls">
                                        <button
                                            className="btn-move"
                                            onClick={() => onMove(idx, 'up')}
                                            disabled={idx === 0}
                                            title="Monter"
                                        >↑</button>
                                        <span>{idx + 1}</span>
                                        <button
                                            className="btn-move"
                                            onClick={() => onMove(idx, 'down')}
                                            disabled={idx === intersections.length - 1}
                                            title="Descendre"
                                        >↓</button>
                                    </div>
                                </td>
                                <td className="col-name">
                                    <div className="col-name-wrap">
                                        <span className="col-name-text">{intersectionTitle(intersection, cachedTitles[intersection.projectName])}</span>
                                        <button
                                            className="btn-relink-dossier"
                                            onClick={() => onRelink(idx)}
                                            title="Changer de dossier… (dossier renommé ou nouvelle version)"
                                        >⇄</button>
                                    </div>
                                </td>
                                <td className="col-pf">
                                    <select
                                        value={intersection.selectedPfId || ''}
                                        onChange={(e) => onSelectPf(idx, parseInt(e.target.value))}
                                    >
                                        {intersection.pfTabs?.map(pf => (
                                            <option key={pf.id} value={pf.id}>
                                                {pf.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className={`col-cycle ${hasCycleConflict ? 'cycle-conflict' : ''}`} title={hasCycleConflict ? `Cycle différent du cycle de référence (${referenceCycle}s)` : undefined}>
                                    {intersection.cycleLength}
                                </td>
                                <td
                                    className={`col-group-select ${isHovered(idx, 'M') ? 'ov-cell-hover' : ''}`}
                                    onMouseEnter={() => onHover({ idx, direction: 'M' })}
                                    onMouseLeave={() => onHover(null)}
                                >
                                    <select
                                        value={intersection.selectedGroup2 || ''}
                                        onChange={(e) => onSelectGroupUp(idx, parseInt(e.target.value))}
                                        style={{ color: '#4CAF50' }}
                                    >
                                        {intersection.groups.map(g => (
                                            <option key={g.id} value={g.id}>
                                                G{g.id} - {g.name || 'Sans nom'}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td
                                    className={`col-distance ${isHovered(idx, 'M') ? 'ov-cell-hover' : ''}`}
                                    onMouseEnter={() => onHover({ idx, direction: 'M' })}
                                    onMouseLeave={() => onHover(null)}
                                >
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="-?\d*"
                                        value={distanceDrafts[`${idx}.g2`] ?? (intersection.distanceG2 ?? intersection.distance)}
                                        onChange={(e) => onDistanceChange(idx, 'g2', e.target.value)}
                                        onBlur={() => onDistanceCommit(idx, 'g2')}
                                    />
                                </td>
                                <td
                                    className={`col-group-select ${isHovered(idx, 'D') ? 'ov-cell-hover' : ''}`}
                                    onMouseEnter={() => onHover({ idx, direction: 'D' })}
                                    onMouseLeave={() => onHover(null)}
                                >
                                    <select
                                        value={intersection.selectedGroup1 || ''}
                                        onChange={(e) => onSelectGroupDown(idx, parseInt(e.target.value))}
                                        style={{ color: '#FF9800' }}
                                    >
                                        {intersection.groups.map(g => (
                                            <option key={g.id} value={g.id}>
                                                G{g.id} - {g.name || 'Sans nom'}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td
                                    className={`col-distance ${isHovered(idx, 'D') ? 'ov-cell-hover' : ''}`}
                                    onMouseEnter={() => onHover({ idx, direction: 'D' })}
                                    onMouseLeave={() => onHover(null)}
                                >
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="-?\d*"
                                        value={distanceDrafts[`${idx}.g1`] ?? intersection.distance}
                                        onChange={(e) => onDistanceChange(idx, 'g1', e.target.value)}
                                        onBlur={() => onDistanceCommit(idx, 'g1')}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default GreenWaveDataPanel;
