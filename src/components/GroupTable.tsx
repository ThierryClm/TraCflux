import LocalInput from './LocalInput';
import NumericInput from './NumericInput';
import EmptyState from './EmptyState';
import type { Groupe, TypeGroupe } from '../types/projet';
import './GroupTable.css';
import { ZoneVerrouSaisie } from '../utils/verrouSaisie';

type GroupUpdates = Omit<Partial<Groupe>, 'durations'> & {
    durations?: Partial<Groupe['durations']>;
};

interface GroupTableProps {
    groups: Groupe[];
    updateGroupParams: (id: number, updates: GroupUpdates) => void;
    cycleLength: number;
    showGroupNames?: boolean;
    onDetach?: () => void;
    hoveredGroupId?: number | null;
    tooltipsEnabled?: boolean;
    titreEnBandeau?: boolean;
}

// Infobulles des colonnes Mini et Jaune, d'après l'ISR (livre 1, 6e partie,
// art. 110 C1). Les feux piétons R12 n'ont pas de jaune : pour un piéton (et
// un cycle géré par R12m), la colonne Jaune porte le temps de dégagement,
// dessiné en rouge après le vert.
const INFOBULLE_MINI = "Durée minimale du vert : 6 s au moins (ISR, 6e partie, art. 110 C1)";
const INFOBULLE_JAUNE_ENTETE = "Véhicules : jaune fixe de 3 s (agglomération) ou 5 s (hors agglomération, feu au jaune clignotant). "
    + "Piétons : temps de dégagement, les feux piétons n'ayant pas de jaune (ISR, 6e partie, art. 110 C1)";
const infobulleJaune = (type: string | undefined): string => {
    if (type === 'P' || type === 'Piéton') {
        return "Temps de dégagement piéton : les feux piétons R12 n'ont pas de jaune (ISR, 6e partie, art. 110 C1). "
            + "Durée de traversée à 1 m/s, dessinée en rouge après le vert";
    }
    if (type === 'CY' || type === 'Cycliste') {
        return "Temps de dégagement du cycle, dessiné en pointillé rouge après le vert. "
            + "Sur feu tricolore cycles (R13c), jaune fixe de 3 s ou 5 s (ISR, 6e partie, art. 110 C1)";
    }
    return "Jaune fixe : 3 s en agglomération, 5 s hors agglomération ou pour un feu au jaune clignotant (ISR, 6e partie, art. 110 C1)";
};

const GroupTable = ({ groups, updateGroupParams, cycleLength, showGroupNames = true, onDetach, hoveredGroupId, tooltipsEnabled = true, titreEnBandeau = false }: GroupTableProps) => {
    const tip = (text: string) => tooltipsEnabled ? text : undefined;

    const handleTypeChange = (id: number, value: TypeGroupe) => {
        const updates: GroupUpdates = { type: value };
        if (value === 'P') {
            updates.courant = 'Piéton';
        } else if (value === 'CY') {
            updates.courant = 'Cycle';
        }
        updateGroupParams(id, updates);
    };

    const handleMinGreenChange = (id: number, value: string) => {
        updateGroupParams(id, { minGreen: parseInt(value) || 0 });
    };

    const handleYellowChange = (id: number, value: string) => {
        updateGroupParams(id, { durations: { orange: parseInt(value) || 0 } });
    };

    return (<ZoneVerrouSaisie section="configuration">
        <div className="group-table-container">
            {/* En fenêtre détachée, le bandeau porte déjà ce titre. */}
            {!titreEnBandeau && (
                <h3 className="group-table-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    Formulaire
                    {onDetach && (
                        <button
                            className="detach-btn"
                            onClick={onDetach}
                            title={tip("Détacher dans une fenêtre séparée")}
                        >
                            Détacher
                        </button>
                    )}
                </h3>
            )}
            <div style={{ position: 'relative' }}>
            {groups.length > 0 && groups.every(g => !g.type) && (
                <div className="empty-state-overlay">
                    <EmptyState
                        icon="list"
                        title={tip("Formulaire non renseigné")}
                        hint="Saisissez les noms des groupes de feu ainsi que les types (Véhicules, Piéton, Cycliste, etc.) dans la colonne « Type »."
                    />
                </div>
            )}
            <table className="group-table">
                <thead>
                    <tr>
                        <th>GF</th>
                        {showGroupNames && <th>Nom</th>}
                        <th>Type</th>
                        <th>Courant</th>
                        <th title={tip(INFOBULLE_MINI)}>Mini</th>
                        <th title={tip(INFOBULLE_JAUNE_ENTETE)}>Jaune</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map((g) => {

                        return (
                            <tr key={g.id} className={hoveredGroupId === g.id ? 'form-hovered-row' : ''}>
                                <td className="col-id">{g.id}</td>
                                {/* Name Input */}
                                {showGroupNames && (
                                    <td>
                                        <LocalInput
                                            className="input-name-cell"
                                            value={g.name}
                                            onCommit={(val) => updateGroupParams(g.id, { name: val })}
                                            selectOnFocus={/^Groupe \d+$/.test(g.name)}
                                        />
                                    </td>
                                )}
                                {/* Type Selection */}
                                <td>
                                    <select
                                        value={g.type}
                                        onChange={(e) => handleTypeChange(g.id, e.target.value as TypeGroupe)}
                                        className="input-type"
                                    >
                                        <option value=""></option>
                                        <option value="V">V</option>
                                        <option value="B">B</option>
                                        <option value="P">P</option>
                                        <option value="CY">CY</option>
                                        <option value="FL">FL</option>
                                        <option value="PP">PP</option>
                                    </select>
                                </td>
                                {/* Courant */}
                                <td>
                                    <select
                                        className="input-courant"
                                        value={g.courant || ''}
                                        onChange={(e) => updateGroupParams(g.id, { courant: e.target.value })}
                                        title={tip(
                                            g.courant === 'TD' ? 'Flèche tout droit' :
                                            g.courant === 'TàD' ? 'Flèche tourne à droite' :
                                            g.courant === 'TàG' ? 'Flèche tourne à gauche' :
                                            g.courant === 'TD_TàD' ? 'Flèche tout droit - tourne à droite' :
                                            g.courant === 'TD_TàG' ? 'Flèche tout droit - tourne à gauche' :
                                            g.courant === 'TD_G_D' ? 'Flèche tout droit - tourne à gauche et à droite' :
                                            g.courant === 'Piéton' ? 'Flèche 2 sens' :
                                            g.courant === 'Cycle' ? 'Flèche 1 sens, trait fin' :
                                            g.courant === 'PP' ? 'Triangle de priorité piéton' : ''
                                        )}
                                    >
                                        <option value=""></option>
                                        <option value="TD">TD</option>
                                        <option value="TàD">TàD</option>
                                        <option value="TàG">TàG</option>
                                        <option value="TD_TàD">TD_TàD</option>
                                        <option value="TD_TàG">TD_TàG</option>
                                        <option value="TD_G_D">TD_G_D</option>
                                        <option value="Piéton">Piéton</option>
                                        <option value="Cycle">Cycle</option>
                                        <option value="PP">PP</option>
                                    </select>
                                </td>
                                {/* Min Green */}
                                <td>
                                    <NumericInput
                                        className="input-mini"
                                        value={g.minGreen}
                                        onCommit={(val) => handleMinGreenChange(g.id, val)}
                                        selectOnFocus
                                        min={0}
                                        max={cycleLength}
                                        allowEmpty={false}
                                        title={tip(INFOBULLE_MINI)}
                                    />
                                </td>
                                {/* Yellow Duration */}
                                <td>
                                    <NumericInput
                                        className="input-yellow"
                                        value={g.durations.orange}
                                        onCommit={(val) => handleYellowChange(g.id, val)}
                                        selectOnFocus
                                        min={0}
                                        max={cycleLength}
                                        allowEmpty={false}
                                        title={tip(infobulleJaune(g.type))}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
        </div>
    </ZoneVerrouSaisie>);
};

export default GroupTable;
