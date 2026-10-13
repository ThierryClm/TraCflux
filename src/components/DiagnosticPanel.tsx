import { useMemo } from 'react';
import { getCapacityColorClass } from '../utils/capacityCalc';
import { lignesDiagnostic, courantDimensionnant } from '../utils/diagnosticCarrefour';
import type { DiagnosticRow, DimensioningRow } from '../utils/diagnosticCarrefour';
import type { ActionMicro, Groupe } from '../types/projet';
import './DiagnosticPanel.css';

interface DiagnosticPanelProps {
    groups?: Groupe[];
    cycleLength: number;
    getTrafficData?: (groupId: number) => { trafficVol?: number | string };
    actionData?: ActionMicro[];
    activeTrafficDataset: string;
    onDetach?: (() => void) | null;
    detached?: boolean;
    hideTitle?: boolean;
    inhibitedGroups?: Set<number> | null;
    tip?: (text: string) => string | undefined;
}

/**
 * Panneau « Diagnostic » : indicateurs de dimensionnement par courant
 * (méthode du Guide des carrefours à feux) + synthèse carrefour. Détachable.
 *
 * Toutes les valeurs proviennent du module partagé capacityCalc et du même
 * « vert total » que le tableau Données Trafic (trafficHelpers) : aucune
 * divergence possible avec les colonnes déjà affichées.
 */
const DiagnosticPanel = ({
    groups = [],
    cycleLength,
    getTrafficData,
    actionData = [],
    activeTrafficDataset,
    onDetach = null,
    detached = false,
    hideTitle = false,
    /* Groupes inhibés par une action cochée en simulation : le tableau Données
       Trafic laisse leurs colonnes calculées vides, celui-ci doit faire pareil.
       Un degré de saturation pour un groupe dont la capacité n'est pas calculée
       juste au-dessus ne veut rien dire. Absent hors simulation. */
    inhibitedGroups = null,
    tip = (t) => t
}: DiagnosticPanelProps) => {
    const rows = useMemo<DiagnosticRow[]>(
        () => lignesDiagnostic({ groups, cycleLength, getTrafficData, actionData, inhibitedGroups }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [groups, cycleLength, getTrafficData, actionData, activeTrafficDataset, inhibitedGroups]);

    const dim = useMemo<DimensioningRow | null>(() => courantDimensionnant(rows), [rows]);

    const fmt = (v: number | null | undefined, suffix = '') => (v === null || v === undefined) ? '—' : `${v}${suffix}`;

    return (
        <div className={`diagnostic-panel${detached ? ' diagnostic-panel-detached' : ''}`}>
            {!hideTitle && (
                <h3 className="diagnostic-title">
                    Réserve de capacité
                    {onDetach && !detached && (
                        <button
                            className="detach-btn"
                            onClick={onDetach}
                            title={tip("Détacher dans une fenêtre séparée (2e écran)")}
                        >
                            Détacher
                        </button>
                    )}
                </h3>
            )}

            {rows.length === 0 ? (
                <p className="diagnostic-empty">
                    Renseignez les volumes de trafic (jeu « {activeTrafficDataset} ») pour obtenir le diagnostic.
                </p>
            ) : (
                <>
                    <table className="diagnostic-table">
                        <thead>
                            <tr>
                                <th title={tip("Groupe de feux")}>GF</th>
                                <th title={tip("Capacité offerte : 1800 × coef × vert/cycle")}>Cap.<br/>uvp/h</th>
                                <th title={tip("Degré de saturation = trafic / capacité offerte")}>Degré<br/>sat.</th>
                                <th title={tip("Réserve de capacité = capacité − trafic")}>Réserve<br/>uvp/h</th>
                                <th title={tip("Attente MOYENNE par véhicule, surcharge aléatoire comprise (Webster, 2 termes). Le tableau Trafic affiche le retard uniforme seul, plus faible.")}>Attente<br/>moy.</th>
                                <th title={tip("File d'attente MOYENNE, déduite de l'attente (loi de Little). Le tableau Trafic affiche la file maximale, plus élevée.")}>File<br/>moy.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.g.id} className={r.inhibe ? 'row-inhibited' : ''}>
                                    <td className="dg-id">GF{r.g.id}</td>
                                    {r.inhibe ? (
                                        <>
                                            <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
                                        </>
                                    ) : (
                                        <>
                                    <td>{fmt(r.capacity)}</td>
                                    <td className={getCapacityColorClass(r.capU)}>
                                        {r.x === null ? '—' : r.x.toFixed(2)}
                                    </td>
                                    <td className={r.reserve && r.reserve.veh < 0 ? 'capacity-black' : ''}>
                                        {r.reserve ? fmt(r.reserve.veh) : '—'}
                                    </td>
                                    <td>{r.delay === null ? 'saturé' : fmt(Math.round(r.delay), ' s')}</td>
                                    <td>{r.queue === null ? 'saturé' : fmt(r.queue, ' m')}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {dim && (
                        <div className="diagnostic-carrefour">
                            <span className="dg-label">Carrefour :</span>{' '}
                            courant dimensionnant <strong>GF{dim.g.id}</strong> —{' '}
                            degré de saturation{' '}
                            <strong className={getCapacityColorClass(dim.capU)}>{dim.x.toFixed(2)}</strong>{' '}
                            {(100 - dim.capU) >= 0
                                ? <>· réserve <strong>{100 - dim.capU}%</strong></>
                                : <>· <strong className="capacity-black">dépassement {dim.capU - 100}%</strong></>}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default DiagnosticPanel;
