import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import type { Groupe, Matrice } from '../types/projet';
import {
    calculerSuggestionCycle, degagementMatrice, CYCLE_MAX_CONSEILLE, CYCLE_MIN_CONSEILLE,
    NB_PHASES_MAX, NB_PHASES_MIN, TAUX_VISE_DEFAUT,
} from '../utils/suggestionCycle';
import type { PhasageCycle } from '../utils/suggestionCycle';
import './SuggestionCycleDialog.css';

export interface SuggestionCycleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    planName: string;
    groups: Groupe[];
    conflictMatrix: Matrice;
    cycleLength: number;
    /** Trafic d'un groupe dans le jeu de trafic du plan affiché. */
    getTrafficData: (groupId: number) => { trafficVol?: number | string };
    trafficDatasetName: string;
    phasageCycle: PhasageCycle | null;
    setPhasageCycle: (phasage: PhasageCycle) => void;
    setCycleLength: (cycle: number) => void;
    readOnly?: boolean;
}

/** Saisie en cours : le dégagement reste vide tant que la matrice ne dit rien. */
interface Brouillon {
    determinants: (number | null)[];
    degagements: string[];
    tauxVise: number;
}

const fmt = (v: number, d = 3) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * « Suggestion de durée du cycle… » (menu Diagramme). L'utilisateur choisit le
 * groupe déterminant de chaque phase, dans l'ordre du cycle ; la fenêtre en
 * déduit Y, le temps perdu, les cycles minimal, de Webster et pour un taux de
 * saturation visé, et une répartition des verts par phase.
 */
const SuggestionCycleDialog = ({
    isOpen, onClose, planName, groups, conflictMatrix, cycleLength, getTrafficData,
    trafficDatasetName, phasageCycle, setPhasageCycle, setCycleLength, readOnly = false,
}: SuggestionCycleDialogProps) => {
    const brouillonInitial = (): Brouillon => {
        if (phasageCycle && phasageCycle.determinants.length >= NB_PHASES_MIN) {
            return {
                determinants: [...phasageCycle.determinants],
                degagements: phasageCycle.degagements.map(d => (Number.isFinite(d) ? String(d) : '')),
                tauxVise: phasageCycle.tauxVise ?? TAUX_VISE_DEFAUT,
            };
        }
        return { determinants: [null, null], degagements: ['', ''], tauxVise: TAUX_VISE_DEFAUT };
    };
    const [brouillon, setBrouillon] = useState<Brouillon>(brouillonInitial);
    // Chaque ouverture repart du phasage enregistré pour le plan affiché.
    useEffect(() => { if (isOpen) setBrouillon(brouillonInitial()); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const nbPhases = brouillon.determinants.length;
    const complet = brouillon.determinants.every(d => d !== null);

    // Dégagement proposé par la matrice entre la phase i et la suivante.
    const dégagementProposé = (dets: (number | null)[], i: number) => {
        const de = dets[i];
        const vers = dets[(i + 1) % dets.length];
        if (de === null || vers === null) return null;
        return degagementMatrice(conflictMatrix, de, vers);
    };

    const choisirNbPhases = (n: number) => setBrouillon(b => {
        const determinants = Array.from({ length: n }, (_, i) => b.determinants[i] ?? null);
        const degagements = Array.from({ length: n }, (_, i) => {
            // La dernière phase reboucle sur la première : son dégagement change.
            if (i < n - 1 && i < b.determinants.length - 1) return b.degagements[i] ?? '';
            const p = dégagementProposé(determinants, i);
            return p === null ? '' : String(p);
        });
        return { ...b, determinants, degagements };
    });

    const choisirDeterminant = (i: number, id: number | null) => setBrouillon(b => {
        const determinants = [...b.determinants];
        determinants[i] = id;
        const degagements = [...b.degagements];
        // Les deux dégagements qui touchent cette phase repartent de la matrice.
        for (const k of [(i - 1 + determinants.length) % determinants.length, i]) {
            const p = dégagementProposé(determinants, k);
            degagements[k] = p === null ? '' : String(p);
        }
        return { ...b, determinants, degagements };
    });

    const groupesDonnees = useMemo(() => groups.map(g => ({
        id: g.id,
        nom: g.name || `GF${g.id}`,
        trafic: Number(getTrafficData(g.id)?.trafficVol) || 0,
        coefVoie: Number(g.laneCoef) || 1,
        vertMini: Number(g.minGreen) || 0,
    })), [groups, getTrafficData]);

    const degagementsNum = brouillon.degagements.map(d => (d.trim() === '' ? null : Number(d)));
    const resultat = useMemo(() => complet
        ? calculerSuggestionCycle({
            determinants: brouillon.determinants as number[],
            degagements: degagementsNum,
            tauxVise: brouillon.tauxVise,
        }, groupesDonnees)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [complet, brouillon, groupesDonnees]);

    const sansTrafic = resultat !== null && resultat.Y === 0;
    const calculable = resultat !== null && resultat.degagementsManquants.length === 0 && !sansTrafic;
    const horsBornes = (c: number | null) => c !== null && (c < CYCLE_MIN_CONSEILLE || c > CYCLE_MAX_CONSEILLE);

    const enregistrer = () => {
        if (!complet) return;
        setPhasageCycle({
            determinants: brouillon.determinants as number[],
            degagements: degagementsNum.map(d => (d === null || !Number.isFinite(d) ? 0 : d)),
            tauxVise: brouillon.tauxVise,
        });
    };

    const nomGroupe = (id: number) => groups.find(g => g.id === id)?.name || `GF${id}`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="modal-wide suggestion-cycle"
            title={`Suggestion de durée du cycle${planName ? ` — ${planName}` : ''}`}>
            <p className="sc-intro">
                Choisissez, dans l'ordre du cycle, le <b>groupe déterminant</b> de chaque phase : le courant le plus
                chargé de la phase. Le dégagement vers la phase suivante est proposé par la matrice ; corrigez-le
                si le dégagement le plus contraignant vient d'un autre groupe de la phase.
                Trafic : jeu <b>{trafficDatasetName || '—'}</b>.
            </p>

            <label className="sc-nb">
                Nombre de phases :
                <select value={nbPhases} onChange={e => choisirNbPhases(parseInt(e.target.value, 10))} aria-label="Nombre de phases">
                    {Array.from({ length: NB_PHASES_MAX - NB_PHASES_MIN + 1 }, (_, k) => NB_PHASES_MIN + k).map(n =>
                        <option key={n} value={n}>{n}</option>)}
                </select>
            </label>

            <table className="sc-table">
                <thead>
                    <tr><th>Phase</th><th>Groupe déterminant</th><th>Trafic (uvp/h)</th><th>Coef. voie</th><th>y</th>
                        <th>Vert mini</th><th>Dégagement vers la phase suivante</th></tr>
                </thead>
                <tbody>
                    {brouillon.determinants.map((det, i) => {
                        const p = resultat?.phases[i];
                        const g = det !== null ? groupesDonnees.find(x => x.id === det) : undefined;
                        const manque = brouillon.degagements[i].trim() === '';
                        const suivante = (i + 1) % nbPhases + 1;
                        return (
                            <tr key={i}>
                                <td>{i + 1}</td>
                                <td>
                                    <select value={det ?? ''} aria-label={`Groupe déterminant de la phase ${i + 1}`}
                                        onChange={e => choisirDeterminant(i, e.target.value === '' ? null : parseInt(e.target.value, 10))}>
                                        <option value="">—</option>
                                        {groups.map(gr => <option key={gr.id} value={gr.id}>GF{gr.id} {gr.name}</option>)}
                                    </select>
                                </td>
                                <td>{g ? g.trafic : ''}</td>
                                <td>{g ? g.coefVoie : ''}</td>
                                <td>{p ? fmt(p.y) : ''}</td>
                                <td>{g ? `${g.vertMini} s` : ''}</td>
                                <td className={manque && det !== null ? 'sc-manque' : ''}>
                                    <input type="number" min={0} max={60} value={brouillon.degagements[i]}
                                        aria-label={`Dégagement de la phase ${i + 1} vers la phase ${suivante}`}
                                        onChange={e => setBrouillon(b => {
                                            const degagements = [...b.degagements];
                                            degagements[i] = e.target.value;
                                            return { ...b, degagements };
                                        })} /> s → phase {suivante}
                                    {manque && det !== null && <span className="sc-note"> case vide dans la matrice : à préciser</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <label className="sc-nb">
                Taux de saturation visé :
                <input type="number" min={50} max={99} value={brouillon.tauxVise} aria-label="Taux de saturation visé"
                    onChange={e => setBrouillon(b => ({ ...b, tauxVise: Math.max(50, Math.min(99, parseInt(e.target.value, 10) || TAUX_VISE_DEFAUT)) }))} /> %
            </label>

            {!complet && <p className="sc-attente">Choisissez un groupe déterminant pour chaque phase.</p>}
            {resultat && sansTrafic && <p className="sc-alerte">Aucun trafic pour ces groupes dans le jeu {trafficDatasetName || 'actif'} : renseignez l'onglet Trafic.</p>}
            {resultat && resultat.degagementsManquants.length > 0 && !sansTrafic &&
                <p className="sc-attente">Précisez le dégagement après la phase {resultat.degagementsManquants.map(i => i + 1).join(', ')}.</p>}

            {resultat && calculable && (
                <div className="sc-resultat" aria-label="Résultat">
                    <p>Y = <b>{fmt(resultat.Y)}</b> · temps perdu L = <b>{resultat.L} s</b></p>
                    {resultat.sature && <p className="sc-alerte">Y ≥ 0,9 : le carrefour est saturé ; aucun cycle ne suffira à écouler ce trafic.</p>}
                    {resultat.cycleWebster !== null && (
                        <ul>
                            <li>Cycle minimal (saturation à 100 %) : <b>{resultat.cycleMinimal} s</b></li>
                            <li>Cycle optimal de Webster (1,5 L + 5) / (1 − Y) : <b>{resultat.cycleWebster} s</b>
                                <span className="sc-note"> ({fmt(resultat.websterExact ?? 0, 1)} s)</span>
                                {horsBornes(resultat.cycleWebster) && <span className="sc-alerte"> hors de la plage usuelle {CYCLE_MIN_CONSEILLE}–{CYCLE_MAX_CONSEILLE} s</span>}</li>
                            <li>Cycle pour une saturation de {brouillon.tauxVise} % : <b>{resultat.cycleTauxVise ?? '—'}{resultat.cycleTauxVise !== null ? ' s' : ''}</b></li>
                        </ul>
                    )}
                    {resultat.cycleWebster !== null && (
                        <p>Verts proposés pour {resultat.cycleWebster} s :{' '}
                            {resultat.verts.map((v, i) => `phase ${i + 1} (${nomGroupe(resultat.phases[i].determinant)}) ${v} s`).join(' · ')}
                        </p>
                    )}
                    <p className="sc-note">Cycle actuel du plan : {cycleLength} s.</p>
                </div>
            )}

            <div className="modal-actions">
                <button className="modal-btn modal-btn-secondary" onClick={onClose}>Fermer</button>
                <button className="modal-btn modal-btn-secondary" disabled={!complet || readOnly} onClick={enregistrer}
                    title="Garder ces groupes déterminants avec le plan de feu (ils servent aussi au phasage bulle)">
                    Enregistrer le phasage
                </button>
                <button className="modal-btn modal-btn-primary"
                    disabled={!calculable || resultat?.cycleWebster == null || readOnly || resultat.cycleWebster === cycleLength}
                    onClick={() => { if (resultat?.cycleWebster) { enregistrer(); setCycleLength(resultat.cycleWebster); } }}>
                    Appliquer le cycle{resultat?.cycleWebster ? ` (${resultat.cycleWebster} s)` : ''}
                </button>
            </div>
        </Modal>
    );
};

export default SuggestionCycleDialog;
