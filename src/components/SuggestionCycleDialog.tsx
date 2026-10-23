import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import type { Groupe, Matrice } from '../types/projet';
import {
    calculerSuggestionCycle, debutsDesPhases, degagementMatrice, detecterCheminCritique, placerGroupesAssocies, instantsPhasageBulle, CYCLE_MAX_CONSEILLE, CYCLE_MIN_CONSEILLE,
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
    /** Phasage bulle du plan, rempli d'après les groupes déterminants (case à cocher). */
    setPhasageBulleCount: (count: number) => void;
    setPhasageBulleTimes: (times: number[]) => void;
    /** Pré-remplissage du diagramme pour les déterminants sans vert (Déb/Fin vides). */
    updateGroupParams: (id: number, params: { offset?: number; durations?: { green?: number } }) => void;
    /** Flèches du plan du carrefour : dernière source pour placer les groupes associés. */
    intersectionArrows?: { groupId: number; rotation?: number }[];
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
 * « Suggérer une durée de cycle… » (menu Diagramme). L'utilisateur choisit le
 * groupe déterminant de chaque phase, dans l'ordre du cycle ; la fenêtre en
 * déduit Y, le temps perdu, les cycles minimal, de Webster et pour un taux de
 * saturation visé, et une répartition des verts par phase.
 */
const SuggestionCycleDialog = ({
    isOpen, onClose, planName, groups, conflictMatrix, cycleLength, getTrafficData,
    trafficDatasetName, phasageCycle, setPhasageCycle, setCycleLength,
    setPhasageBulleCount, setPhasageBulleTimes, updateGroupParams, intersectionArrows = [], readOnly = false,
}: SuggestionCycleDialogProps) => {
    const [remplirBulle, setRemplirBulle] = useState(true);
    // Chemin critique lu sur le diagramme, quand il est renseigné : phases,
    // groupe à la plus forte capacité utilisée, dégagements effectifs.
    const chemin = useMemo(() => detecterCheminCritique(groups.map(g => ({
        id: g.id, offset: Number(g.offset) || 0, vert: Number(g.durations?.green) || 0,
        jaune: Number(g.durations?.orange) || 0, vertMini: Number(g.minGreen) || 0,
        trafic: Number(getTrafficData(g.id)?.trafficVol) || 0, coefVoie: Number(g.laneCoef) || 1,
    })), conflictMatrix, cycleLength), [groups, getTrafficData, conflictMatrix, cycleLength]);
    const [origine, setOrigine] = useState<'enregistre' | 'diagramme' | 'vide'>('vide');
    const depuisDiagramme = (): Brouillon | null => chemin && {
        determinants: [...chemin.determinants].slice(0, NB_PHASES_MAX),
        degagements: chemin.degagements.slice(0, NB_PHASES_MAX).map(d => (d === null ? '' : String(d))),
        tauxVise: phasageCycle?.tauxVise ?? TAUX_VISE_DEFAUT,
    };
    const brouillonInitial = (): Brouillon => {
        if (phasageCycle && phasageCycle.determinants.length >= NB_PHASES_MIN) {
            setOrigine('enregistre');
            return {
                determinants: [...phasageCycle.determinants],
                degagements: phasageCycle.degagements.map(d => (Number.isFinite(d) ? String(d) : '')),
                tauxVise: phasageCycle.tauxVise ?? TAUX_VISE_DEFAUT,
            };
        }
        const lu = depuisDiagramme();
        if (lu) { setOrigine('diagramme'); return lu; }
        setOrigine('vide');
        return { determinants: [null, null], degagements: ['', ''], tauxVise: TAUX_VISE_DEFAUT };
    };
    const [brouillon, setBrouillon] = useState<Brouillon>({ determinants: [null, null], degagements: ['', ''], tauxVise: TAUX_VISE_DEFAUT });
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

    // Disposition proposée : début de vert de chaque phase dans le cycle proposé.
    const debuts = resultat && calculable ? debutsDesPhases(resultat.verts, resultat.phases.map((_, i) => degagementsNum[i] ?? 0)) : [];

    // Groupes associés : position déduite de la matrice, sinon du nom, sinon du plan.
    const placements = useMemo(() => {
        if (!resultat || !calculable || !complet) return [];
        const dets = (brouillon.determinants as number[]).map((id, i) => {
            const g = groups.find(gr => gr.id === id);
            if (g && g.durations?.green > 0) return { id, debut: Number(g.offset) || 0, fin: (Number(g.offset) || 0) + g.durations.green };
            return debuts[i] === undefined ? null : { id, debut: debuts[i], fin: debuts[i] + resultat.verts[i] };
        });
        if (dets.some(d => d === null)) return [];
        const cycleRef = groups.some(g => (brouillon.determinants as number[]).includes(g.id) && g.durations?.green > 0)
            ? cycleLength : (resultat.cycleSuggere ?? cycleLength);
        return placerGroupesAssocies(groups.map(g => ({
            id: g.id, nom: g.name || `GF${g.id}`, offset: Number(g.offset) || 0, vert: Number(g.durations?.green) || 0,
            vertMini: Number(g.minGreen) || 0, trafic: Number(getTrafficData(g.id)?.trafficVol) || 0,
            rotation: intersectionArrows.find(a => a.groupId === g.id)?.rotation,
        })), dets as { id: number; debut: number; fin: number }[], conflictMatrix, cycleRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resultat, calculable, complet, brouillon, groups, getTrafficData, intersectionArrows, conflictMatrix, cycleLength]);
    const cocheParDefaut = (p: { id: number; aVerifier: boolean; fin: number; debut: number; phases: number[] }) => {
        const g = groups.find(gr => gr.id === p.id);
        return !p.aVerifier && p.phases.length > 0 && p.fin > p.debut && !(g && g.durations?.green > 0);
    };
    const [coches, setCoches] = useState<Record<number, boolean>>({});
    const estCoche = (p: Parameters<typeof cocheParDefaut>[0]) => coches[p.id] ?? cocheParDefaut(p);
    const placerCoches = () => {
        placements.filter(estCoche).forEach(p => updateGroupParams(p.id, { offset: p.debut, durations: { green: p.fin - p.debut } }));
        setCoches({});
    };

    // Déterminants sans vert dans le diagramme (Déb/Fin vides) : pré-remplis au
    // fil de la saisie, à la position proposée, dès que la phase tient dans le
    // cycle du plan. Les groupes déjà réglés ne sont jamais touchés.
    const aPreremplir = !readOnly && resultat && calculable
        ? resultat.phases
            .map((p, i) => ({ id: p.determinant, offset: debuts[i], vert: resultat.verts[i] }))
            .filter(x => {
                const g = groups.find(gr => gr.id === x.id);
                return g && !(g.durations?.green > 0) && x.offset + x.vert <= cycleLength;
            })
        : [];
    const clePreremplissage = aPreremplir.map(x => `${x.id}:${x.offset}:${x.vert}`).join('|');
    const [preremplis, setPreremplis] = useState<number[]>([]);
    useEffect(() => {
        if (!isOpen || !aPreremplir.length) return;
        aPreremplir.forEach(x => updateGroupParams(x.id, { offset: x.offset, durations: { green: x.vert } }));
        setPreremplis(p => [...new Set([...p, ...aPreremplir.map(x => x.id)])]);
    }, [isOpen, clePreremplissage]); // eslint-disable-line react-hooks/exhaustive-deps

    // Phasage bulle : milieu du vert de chaque déterminant, lu dans le diagramme
    // s'il est réglé, sinon pris dans la disposition proposée.
    const remplirPhasageBulle = () => {
        if (!resultat || !complet) return;
        const dets = brouillon.determinants as number[];
        const lus = instantsPhasageBulle(dets, groups, cycleLength);
        const instants = dets.map((id, i) => {
            const g = groups.find(gr => gr.id === id);
            if (g && g.durations?.green > 0) return lus[i];
            return debuts[i] !== undefined ? Math.floor(debuts[i] + (resultat.verts[i] || 0) / 2) : 0;
        });
        setPhasageBulleCount(dets.length);
        setPhasageBulleTimes([...instants, 0, 0, 0, 0, 0, 0].slice(0, 6));
    };

    const enregistrer = () => {
        if (!complet) return;
        if (remplirBulle) remplirPhasageBulle();
        setPhasageCycle({
            determinants: brouillon.determinants as number[],
            degagements: degagementsNum.map(d => (d === null || !Number.isFinite(d) ? 0 : d)),
            tauxVise: brouillon.tauxVise,
        });
    };

    const nomGroupe = (id: number) => groups.find(g => g.id === id)?.name || `GF${id}`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} nonModale className="suggestion-cycle" overlayClassName="suggestion-cycle-overlay"
            title={`Suggérer une durée de cycle${planName ? ` — ${planName}` : ''}`}>
            <div className="sc-defilement">
            <p className="sc-intro">
                Choisissez, dans l'ordre du cycle, le <b>groupe déterminant</b> de chaque phase : le courant le plus
                chargé de la phase. Le dégagement vers la phase suivante est proposé par la matrice ; corrigez-le
                si le dégagement le plus contraignant vient d'un autre groupe de la phase.
                Trafic : jeu <b>{trafficDatasetName || '—'}</b>.
            </p>
            {origine === 'diagramme' && (
                <p className="sc-proposition">
                    Proposition lue sur le diagramme : dans chaque phase, le groupe à la plus forte capacité utilisée
                    (pour une phase de piétons, la traversée la plus défavorable). C'est une règle générale, pas une
                    certitude : vérifiez et corrigez si besoin.
                </p>
            )}
            {chemin && (
                <button type="button" className="modal-btn modal-btn-secondary sc-relire"
                    title="Refaire la détection des phases et des groupes déterminants sur le diagramme actuel"
                    onClick={() => { const lu = depuisDiagramme(); if (lu) { setBrouillon(lu); setOrigine('diagramme'); } }}>
                    Relire le diagramme
                </button>
            )}

            <label className="sc-nb">
                Nombre de phases :
                <select value={nbPhases} onChange={e => choisirNbPhases(parseInt(e.target.value, 10))} aria-label="Nombre de phases">
                    {Array.from({ length: NB_PHASES_MAX - NB_PHASES_MIN + 1 }, (_, k) => NB_PHASES_MIN + k).map(n =>
                        <option key={n} value={n}>{n}</option>)}
                </select>
            </label>

            <table className="sc-table">
                <thead>
                    <tr><th>Phase</th><th>Groupe déterminant</th><th>Trafic (uvp/h)</th><th>Coef. voie</th><th>Cap. U</th><th>y</th>
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
                                <td>{det !== null && chemin?.capaciteUtilisee[det] !== undefined ? `${Math.round(chemin.capaciteUtilisee[det])} %` : ''}</td>
                                <td>{p ? fmt(p.y) : ''}</td>
                                <td>{g ? `${g.vertMini} s` : ''}</td>
                                <td className={manque && det !== null ? 'sc-manque' : ''}>
                                    <input type="number" min={0} max={60} value={brouillon.degagements[i]}
                                        aria-label={`Dégagement de la phase ${i + 1} vers la phase ${suivante}`}
                                        onChange={e => setBrouillon(b => {
                                            const degagements = [...b.degagements];
                                            degagements[i] = e.target.value;
                                            return { ...b, degagements };
                                        })} /> s → ph. {suivante}
                                    {manque && det !== null && <span className="sc-note"> à préciser</span>}
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
                            <li>Cycle optimal de Webster (1,5 L + 5) / (1 − Y) : {fmt(resultat.websterExact ?? 0, 1)} s,
                                soit un <b>cycle proposé de {resultat.cycleSuggere} s</b> (dizaine supérieure)
                                {horsBornes(resultat.cycleSuggere) && <span className="sc-alerte"> hors de la plage usuelle {CYCLE_MIN_CONSEILLE}–{CYCLE_MAX_CONSEILLE} s</span>}</li>
                            <li>Cycle pour une saturation de {brouillon.tauxVise} % : <b>{resultat.cycleTauxVise ?? '—'}{resultat.cycleTauxVise !== null ? ' s' : ''}</b></li>
                        </ul>
                    )}
                    {resultat.cycleWebster !== null && (
                        <p>Verts proposés pour {resultat.cycleSuggere} s :{' '}
                            {resultat.verts.map((v, i) => `phase ${i + 1} (${nomGroupe(resultat.phases[i].determinant)}) ${v} s`).join(' · ')}
                        </p>
                    )}
                    <p className="sc-note">Cycle actuel du plan : {cycleLength} s.</p>
                    {preremplis.length > 0 && <p className="sc-note">Diagramme pré-rempli pour les groupes sans vert : {preremplis.map(id => `GF${id}`).join(', ')} (Ctrl+Z pour annuler).</p>}
                </div>
            )}

            {placements.length > 0 && (
                <div className="sc-associes" aria-label="Groupes associés">
                    <h4>Groupes associés</h4>
                    <table className="sc-table">
                        <thead><tr><th></th><th>Groupe</th><th>Phase</th><th>Déb – Fin</th><th>Source de la déduction</th></tr></thead>
                        <tbody>
                            {placements.map(p => (
                                <tr key={p.id} className={p.aVerifier ? 'sc-a-verifier' : ''}>
                                    <td><input type="checkbox" aria-label={`Placer ${nomGroupe(p.id)}`} checked={estCoche(p)}
                                        disabled={readOnly || !(p.fin > p.debut)}
                                        onChange={e => setCoches(c => ({ ...c, [p.id]: e.target.checked }))} /></td>
                                    <td className="sc-gauche sc-nom" title={nomGroupe(p.id)}>GF{p.id} {nomGroupe(p.id)}</td>
                                    <td>{p.phases.length ? p.phases.map(i => i + 1).join(', ') : '—'}</td>
                                    <td className="sc-insecable">{p.fin > p.debut ? `${p.debut} – ${p.fin} s` : '—'}</td>
                                    <td className="sc-gauche sc-source">
                                        {p.source && <span className={`sc-badge sc-badge-${p.source}`}>{p.source === 'matrice' ? 'Matrice' : p.source === 'nom' ? 'Nom' : 'Plan'}</span>}
                                        {' '}{p.explication}{p.aVerifier ? ' — à vérifier' : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button type="button" className="modal-btn modal-btn-secondary" disabled={readOnly || !placements.some(estCoche)} onClick={placerCoches}
                        title="Inscrit les groupes cochés dans le diagramme (Ctrl+Z pour annuler)">
                        Placer les groupes cochés
                    </button>
                </div>
            )}
            </div>
            <div className="sc-pied">
            <label className="sc-nb" title="Une bulle par phase, au milieu du vert de son groupe déterminant">
                <input type="checkbox" checked={remplirBulle} onChange={e => setRemplirBulle(e.target.checked)} />
                Modifier ou pré-remplir le phasage bulle
            </label>

            <div className="modal-actions">
                <button className="modal-btn modal-btn-secondary" onClick={onClose}>Fermer</button>
                <button className="modal-btn modal-btn-secondary" disabled={!complet || readOnly} onClick={enregistrer}
                    title="Garder ces groupes déterminants avec le plan de feu (ils servent aussi au phasage bulle)">
                    Enregistrer le phasage
                </button>
                <button className="modal-btn modal-btn-primary"
                    disabled={!calculable || resultat?.cycleSuggere == null || readOnly}
                    onClick={() => { if (resultat?.cycleSuggere) { if (resultat.cycleSuggere !== cycleLength) setCycleLength(resultat.cycleSuggere); enregistrer(); } }}>
                    Appliquer le cycle{calculable && resultat?.cycleSuggere ? ` (${resultat.cycleSuggere} s)` : ''}
                </button>
            </div>
            </div>
        </Modal>
    );
};

export default SuggestionCycleDialog;
