import React from 'react';
import type { Ref } from 'react';
import { getCapacityColorClass } from '../utils/capacityCalc';
import type { CelluleComparaison, ColonneComparaison } from '../utils/comparaisonCapacite';
import type { Groupe } from '../types/projet';

interface TableauComparaisonCapaciteProps {
    colonnes: ColonneComparaison[];
    cellules: Record<string, Record<number, CelluleComparaison>>;
    groupes: Groupe[];
    afficherVUtile: boolean;
    tableRef?: Ref<HTMLTableElement>;
    /** Case « Page principale » de Mise en page → Infobulles. */
    tooltipsEnabled?: boolean;
}

/**
 * Tableau du comparateur de capacité : une ligne par groupe véhicules, une
 * colonne par plan de feu ou scénario (Trafic, V.Utile facultatif, Cap.U).
 * Affiché dans la fenêtre du comparateur et dans le dossier imprimé.
 */
const TableauComparaisonCapacite = ({ colonnes, cellules, groupes, afficherVUtile, tableRef, tooltipsEnabled = true }: TableauComparaisonCapaciteProps) => {
    const tip = (text: string) => tooltipsEnabled ? text : undefined;
    // Même jeu de trafic partout : une seule colonne Trafic, au début.
    const jeuUnique = colonnes.length > 0 && colonnes.every(c => c.jeu === colonnes[0].jeu);
    const parColonne = (afficherVUtile ? 2 : 1) + (jeuUnique ? 0 : 1);
    const traficUnique = (groupId: number) => cellules[colonnes[0]?.cle]?.[groupId]?.trafficVol;

    return (
        <table className="cc-table" ref={tableRef}>
            <thead>
                <tr>
                    <th rowSpan={2} className="cc-col-group cc-corner">
                        <span className="cc-corner-pf">Plan de feu</span>
                        <span className="cc-corner-gf">Groupe de feu</span>
                    </th>
                    {jeuUnique && <th className="cc-trafic-spacer" aria-hidden="true"></th>}
                    {colonnes.map(c => (
                        <th key={c.cle} colSpan={parColonne} className={`cc-pf-header${c.scenario ? ' cc-scenario-header' : ''}`}>
                            {c.pf.name}
                            {c.scenario && <span className="cc-scenario-nom">{c.scenario.nom}</span>}
                            <span className="cc-pf-dataset" title={tip('Jeu de trafic appliqué')}>
                                {jeuUnique ? `cycle ${c.cycle}s` : `${c.jeu || '—'} · cycle ${c.cycle}s`}
                            </span>
                        </th>
                    ))}
                </tr>
                <tr className="cc-subheader">
                    {jeuUnique && (
                        <th className="cc-col-trafic-single" title={tip('Trafic (véh/h)')}>
                            Trafic<span className="cc-pf-dataset">{colonnes[0]?.jeu || '—'}</span>
                        </th>
                    )}
                    {colonnes.map(c => (
                        <React.Fragment key={c.cle}>
                            {!jeuUnique && <th title={tip('Trafic (véh/h)')}>Trafic</th>}
                            {afficherVUtile && <th title={tip('Vert utile')}>V.Utile</th>}
                            <th title={tip('Capacité utilisée')}>Cap.U</th>
                        </React.Fragment>
                    ))}
                </tr>
            </thead>
            <tbody>
                {groupes.map(group => (
                    <tr key={group.id}>
                        <td className="cc-col-group">
                            G{group.id}{group.name ? ` — ${group.name}` : ''}
                        </td>
                        {jeuUnique && (
                            <td className="cc-trafic">{traficUnique(group.id) ? traficUnique(group.id) : '-'}</td>
                        )}
                        {colonnes.map(c => {
                            const cell = cellules[c.cle]?.[group.id];
                            const cap = cell?.capacity;
                            return (
                                <React.Fragment key={c.cle}>
                                    {!jeuUnique && <td className="cc-trafic">{cell?.trafficVol ? cell.trafficVol : '-'}</td>}
                                    {afficherVUtile && (
                                        <td className="cc-vutile">{cell?.vUtile ? `${Math.round(cell.vUtile)}''` : '-'}</td>
                                    )}
                                    <td className={`cc-capacity ${getCapacityColorClass(cap?.value)}`}>{cap?.display || '-'}</td>
                                </React.Fragment>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default TableauComparaisonCapacite;
