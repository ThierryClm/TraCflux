import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import type { Groupe, Matrice } from '../types/projet';
import {
    calculerSuggestionCycle, debutsDesPhases, nomCourt, degagementMatrice, detecterCheminCritique, placerGroupesAssocies, instantsPhasageBulle, CYCLE_MAX_CONSEILLE, CYCLE_MIN_CONSEILLE,
    NB_PHASES_MAX, NB_PHASES_MIN, TAUX_VISE_DEFAUT,
} from '../utils/suggestionCycle';
import type { PhasageCycle } from '../utils/suggestionCycle';
import { proposerAdaptatifs, PASSAGES_MAX, TAUX_VISE_ADAPTATIFS } from '../utils/adaptatifsVerticaux';
import type { AdaptatifPropose, ModeAdaptatifs } from '../utils/adaptatifsVerticaux';
import { proposerFermetures, SEUIL_CAPACITE_FERMETURE, PART_TEMPS_DISPONIBLE } from '../utils/fermeturesAnticipees';
import type { FermeturePropose } from '../utils/fermeturesAnticipees';
import { proposerReposBus, lireTmabX, DESCRIPTION_REPOS_BUS, FENETRE_REPOS_BUS, TMAB_DEFAUT, VARIABLE_TMABX } from '../utils/reposBus';
import type { ReposPropose } from '../utils/reposBus';
import type { ActionMicro } from '../types/projet';
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
    updateGroupParams: (id: number, params: { offset?: number; durations?: { green?: number }; da?: string }) => void;
    /** Flèches du plan du carrefour : dernière source pour placer les groupes associés. */
    intersectionArrows?: { groupId: number; rotation?: number }[];
    /** Inscrit des conditions dans la table, après avoir vidé les lignes à remplacer ; renvoie le nombre inscrit. */
    ajouterActions?: (lignes: Partial<Omit<ActionMicro, 'id'>>[], remplacer?: (row: ActionMicro) => boolean) => number;
    /** Variables micro du plan : TMABX donne la durée d'attente des repos bus. */
    variablesMicro?: string[];
    /** Écrit une variable micro du plan (index, texte) : ajout de « TMABX = 10 » s'il manque. */
    setVariableMicro?: (index: number, value: string) => void;
    readOnly?: boolean;
    /** Rendu dans une fenêtre détachée du navigateur (usePopupWindow), sans cadre de modale. */
    detachee?: boolean;
}

/** Titre de la fenêtre, partagé avec la fenêtre détachée. */
export const titreSuggestionCycle = (planName: string) => `Suggérer une durée de cycle${planName ? ` — ${planName}` : ''}`;

/** Saisie en cours : le dégagement reste vide tant que la matrice ne dit rien. */
interface Brouillon {
    determinants: (number | null)[];
    degagements: string[];
    tauxVise: number;
}

/** Adaptatif vertical inscrit par l'assistant (abréviation AV1, AV2…) : remplacé au passage suivant. */
const estAdaptatifAssistant = (row: ActionMicro) => row.action === 'Adaptatif vertical' && /^AV\d+$/.test(String(row.abrv ?? '').trim());
/** Fermeture anticipée inscrite par l'assistant (FA1, FA2…) : remplacée elle aussi. */
const estFermetureAssistant = (row: ActionMicro) => row.action === 'Fermeture anticipée' && /^FA\d+$/.test(String(row.abrv ?? '').trim());
/** Point de repos bus inscrit par l'assistant (description « attente bus théorique… »). */
const estReposAssistant = (row: ActionMicro) => row.action === 'Point de repos'
    && String(row.description ?? '').trim().toLowerCase().startsWith(DESCRIPTION_REPOS_BUS);
const estLigneAssistant = (row: ActionMicro) => estAdaptatifAssistant(row) || estFermetureAssistant(row) || estReposAssistant(row);

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
    setPhasageBulleCount, setPhasageBulleTimes, updateGroupParams, intersectionArrows = [], ajouterActions, variablesMicro, setVariableMicro, readOnly = false, detachee = false,
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
        // Calage sur le cycle qu'appliquera « Appliquer le cycle », et non sur
        // le cycle actuel du plan : les fermetures qui rebouclent en dépendent.
        const cycleRef = resultat.cycleSuggere ?? cycleLength;
        return placerGroupesAssocies(groups.map(g => ({
            id: g.id, nom: g.name || `GF${g.id}`, offset: Number(g.offset) || 0, vert: Number(g.durations?.green) || 0,
            vertMini: Number(g.minGreen) || 0, trafic: Number(getTrafficData(g.id)?.trafficVol) || 0,
            rotation: intersectionArrows.find(a => a.groupId === g.id)?.rotation,
        })), dets as { id: number; debut: number; fin: number }[], conflictMatrix, cycleRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resultat, calculable, complet, brouillon, groups, getTrafficData, intersectionArrows, conflictMatrix, cycleLength]);
    // Groupes associés placés par « Appliquer le cycle » : ceux qui n'ont pas
    // encore de vert et dont la déduction est sûre. Les groupes déjà réglés ne
    // sont jamais touchés ; ceux « à vérifier » restent à placer à la main.
    const statutPlacement = (p: { id: number; aVerifier: boolean; fin: number; debut: number; phases: number[] }) => {
        const g = groups.find(gr => gr.id === p.id);
        if (g && g.durations?.green > 0) return 'regle' as const;
        return !p.aVerifier && p.phases.length > 0 && p.fin > p.debut ? 'auto' as const : 'main' as const;
    };
    const aPlacer = placements.filter(p => statutPlacement(p) === 'auto');
    const appliquer = () => {
        if (!resultat?.cycleSuggere) return;
        if (resultat.cycleSuggere !== cycleLength) setCycleLength(resultat.cycleSuggere);
        enregistrer();
        aPlacer.forEach(p => updateGroupParams(p.id, { offset: p.debut, durations: { green: p.fin - p.debut } }));
        // Enfin les adaptatifs verticaux proposés, qui remplacent ceux d'un
        // passage précédent (AV1, AV2… inscrits par l'assistant).
        if (ajouterActions && disposition) {
            const lignes = [...avUtiles.map(conditionAdaptatif), ...faUtiles.map(conditionFermeture), ...reposBus.map(conditionRepos)];
            const nb = ajouterActions(lignes, estLigneAssistant);
            // DA du groupe bus : « TX », X tenant la place du code trajet.
            reposBus.forEach(r => updateGroupParams(r.groupe, { da: 'TX' }));
            // Variable micro TMABX, ajoutée dans la première case libre si le plan ne l'a pas.
            if (reposBus.length && tmabX === null && setVariableMicro) {
                const libre = (variablesMicro ?? []).findIndex(v => !v.trim());
                setVariableMicro(libre >= 0 ? libre : (variablesMicro ?? []).length, VARIABLE_TMABX);
            }
            setAvInscrits(lignes.slice(0, nb).map(l => String(l.abrv)));
        }
    };

    // Adaptatifs verticaux proposés, un par phase, sur la disposition prévue :
    // diagramme actuel, déterminants proposés et groupes placés avec le cycle.
    const [modeAV, setModeAV] = useState<ModeAdaptatifs>('iteratif');
    const [tauxAV, setTauxAV] = useState(TAUX_VISE_ADAPTATIFS);
    // Disposition prévue des groupes : diagramme actuel, déterminants proposés
    // et groupes placés avec le cycle. Base des adaptatifs et des fermetures.
    const disposition = useMemo(() => {
        if (!resultat || !calculable || !complet || !resultat.cycleSuggere) return null;
        const dets = brouillon.determinants as number[];
        return groups.map(g => {
            const base = {
                id: g.id, type: String(g.type ?? ''), vertMini: Number(g.minGreen) || 0,
                trafic: Number(getTrafficData(g.id)?.trafficVol) || 0, coefVoie: Number(g.laneCoef) || 1,
            };
            if (g.durations?.green > 0) return { ...base, debut: Number(g.offset) || 0, vert: g.durations.green };
            const i = dets.indexOf(g.id);
            if (i >= 0 && debuts[i] !== undefined) return { ...base, debut: debuts[i], vert: resultat.verts[i] };
            const p = aPlacer.find(x => x.id === g.id);
            return p ? { ...base, debut: p.debut, vert: p.fin - p.debut } : { ...base, debut: 0, vert: 0 };
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resultat, calculable, complet, brouillon, groups, getTrafficData, placements]);
    const propositionAV = useMemo(() => (disposition && resultat?.cycleSuggere
        ? proposerAdaptatifs(brouillon.determinants as number[], disposition, resultat.cycleSuggere, tauxAV, modeAV)
        : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disposition, modeAV, tauxAV]);
    const [seuilFA, setSeuilFA] = useState(SEUIL_CAPACITE_FERMETURE);
    const fermetures = useMemo(() => (disposition && resultat?.cycleSuggere
        ? proposerFermetures(disposition, conflictMatrix, resultat.cycleSuggere, seuilFA)
        : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disposition, conflictMatrix, seuilFA]);
    const faUtiles = fermetures.filter(f => f.duree > 0);
    const reposBus = useMemo(() => (disposition && resultat?.cycleSuggere ? proposerReposBus(disposition, resultat.cycleSuggere) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disposition]);
    const tmabX = lireTmabX(variablesMicro);
    const tmab = tmabX ?? TMAB_DEFAUT;
    const avUtiles = propositionAV?.adaptatifs.filter(a => a.duree > 0) ?? [];
    const [avInscrits, setAvInscrits] = useState<string[] | null>(null);
    // Ligne de condition renseignée avec ce que l'assistant sait de la zone ;
    // la condition de contraction reste à adapter à la détection réelle.
    const court = (id: number) => nomCourt(groups.find(g => g.id === id)?.name, id);
    // Point de repos bus : X tient la place du code trajet, à remplacer.
    const conditionRepos = (r: ReposPropose) => ({
        gf: String(r.groupe),
        action: 'Point de repos',
        deb: String(r.instant),
        fin: '',
        abrv: 'Att bus',
        description: `${DESCRIPTION_REPOS_BUS} maxi ${tmab} secondes`,
        micro: `Attente quittée si TPPh_L${r.groupe} + DAX > ${r.n} + TMABX`,
    });
    // Fermeture anticipée : FA1, FA2… dans l'ordre du tableau, glissements en Action GF.
    const conditionFermeture = (f: FermeturePropose, k: number) => ({
        gf: String(f.groupe),
        action: 'Fermeture anticipée',
        deb: String(f.deb),
        fin: String(f.fin),
        abrv: `FA${k + 1}`,
        description: 'Fermeture théorique',
        micro: `Fermeture si absence de demande sur ${court(f.groupe)}`,
        actGf1: f.glissements[0] !== undefined ? String(f.glissements[0]) : '',
        actGf1Gf2: f.glissements[1] !== undefined ? String(f.glissements[1]) : '',
        actGf1Gf3: f.glissements[2] !== undefined ? String(f.glissements[2]) : '',
        actGf1Gf4: f.glissements[3] !== undefined ? String(f.glissements[3]) : '',
    });
    const conditionAdaptatif = (a: AdaptatifPropose) => ({
        gf: String(a.determinant),
        action: 'Adaptatif vertical',
        deb: String(a.deb),
        fin: String(a.fin),
        abrv: `AV${a.phase}`,
        description: 'Contraction théorique',
        micro: `Contraction si absence de demande sur ${court(a.determinant)}`,
    });
    const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)} %`);

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

    const corps = (
        <>
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
                    <h4>Groupes associés{resultat?.cycleSuggere ? ` — calés sur le cycle proposé de ${resultat.cycleSuggere} s` : ''}</h4>
                    <table className="sc-table">
                        <thead><tr><th>Groupe</th><th>Phase</th><th>Déb – Fin</th><th>Source de la déduction</th><th>Placement</th></tr></thead>
                        <tbody>
                            {placements.map(p => (
                                <tr key={p.id} className={p.aVerifier ? 'sc-a-verifier' : ''}>
                                    <td className="sc-gauche sc-nom" title={nomGroupe(p.id)}>GF{p.id} {nomGroupe(p.id)}</td>
                                    <td>{p.phases.length ? p.phases.map(i => i + 1).join(', ') : '—'}</td>
                                    <td className="sc-insecable">{p.fin > p.debut ? `${p.debut} – ${p.fin} s` : '—'}</td>
                                    <td className="sc-gauche sc-source">
                                        {p.source && <span className={`sc-badge sc-badge-${p.source}`}>{p.source === 'matrice' ? 'Matrice' : p.source === 'nom' ? 'Nom' : 'Plan'}</span>}
                                        {' '}{p.explication}{p.aVerifier ? ' — à vérifier' : ''}
                                    </td>
                                    <td className="sc-insecable">{{ auto: 'avec le cycle', regle: 'déjà réglé', main: 'à la main' }[statutPlacement(p)]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="sc-note">
                        « Appliquer le cycle » règle d'abord la durée du cycle, puis inscrit dans le diagramme les groupes
                        « avec le cycle » (Ctrl+Z pour annuler). Les groupes déjà réglés ne sont pas modifiés ; ceux
                        « à vérifier » restent à placer à la main.
                    </p>
                </div>
            )}

            {propositionAV && propositionAV.adaptatifs.length > 0 && (
                <div className="sc-associes sc-adaptatifs" aria-label="Adaptatifs verticaux">
                    <h4>Adaptatifs verticaux (proposition)</h4>
                    <label className="sc-nb" title="Une phase ne se contracte que lorsque sa demande est servie : le taux visé peut être plus haut que pour le cycle">
                        Taux de saturation visé pour les zones :
                        <input type="number" min={50} max={99} value={tauxAV} aria-label="Taux visé des adaptatifs"
                            onChange={e => setTauxAV(Math.max(50, Math.min(99, parseInt(e.target.value, 10) || TAUX_VISE_ADAPTATIFS)))} /> %
                    </label>
                    <label className="sc-nb">
                        Calcul :
                        <select value={modeAV} aria-label="Mode de calcul des adaptatifs" onChange={e => setModeAV(e.target.value as ModeAdaptatifs)}>
                            <option value="iteratif">Itératif ({PASSAGES_MAX} passages au plus)</option>
                            <option value="prudent">Prudent (chaque zone seule)</option>
                        </select>
                    </label>
                    <table className="sc-table">
                        <thead><tr><th>Phase</th><th>Déterminant</th><th>Zone Déb – Fin</th><th>Durée</th>
                            <th title={`Capacité utilisée du déterminant au cycle de ${propositionAV.cycleNominal} s`}>Cap. U nominale</th>
                            <th title="Toutes les zones contractées ensemble">Cap. U tout contracté</th>
                            <th title="Cette zone seule contractée, les autres en extension. Taux fourni à titre indicatif, car sur le principe, la demande a été satisfaite.">Cap. U zone seule</th>
                            <th>Limité par</th></tr></thead>
                        <tbody>
                            {propositionAV.adaptatifs.map(a => (
                                <tr key={a.phase}>
                                    <td>{a.phase}</td>
                                    <td className="sc-gauche sc-nom" title={nomGroupe(a.determinant)}>GF{a.determinant} {nomGroupe(a.determinant)}</td>
                                    <td className="sc-insecable">{a.duree > 0 ? `${a.deb} – ${a.fin} s` : '—'}</td>
                                    <td>{a.duree > 0 ? `${a.duree} s` : '—'}</td>
                                    <td>{pct(a.capNominale)}</td>
                                    <td>{a.duree > 0 ? pct(a.capContractee) : '—'}</td>
                                    <td className={a.capSeule !== null && a.capSeule > tauxAV ? 'sc-depasse' : ''}>{a.duree > 0 ? pct(a.capSeule) : '—'}</td>
                                    <td className="sc-gauche">{a.limite
                                        ? (a.limite.raison === 'mini' ? `vert mini de ${court(a.limite.id)}`
                                            : a.limite.raison === 'degagement' ? `début ou fin de vert de ${court(a.limite.id)}`
                                            : `Cap. U de ${court(a.limite.id)} à ${tauxAV} %`)
                                        : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="sc-note">
                        Cycle de {propositionAV.cycleNominal} s, {propositionAV.cycleContracte} s avec toutes les zones contractées
                        {modeAV === 'iteratif'
                            ? <> ({propositionAV.passages} passage{propositionAV.passages > 1 ? 's' : ''} sur {PASSAGES_MAX} au plus).
                                Le taux visé n'est tenu que si toutes les zones se contractent ensemble : voir « zone seule ».</>
                            : <>. Chaque zone est calculée seule : le taux visé tient quelle que soit la combinaison de zones contractées.</>}
                    </p>
                    <p className="sc-note">
                        Chaque zone finit avec le premier groupe de sa phase qui ferme, pour respecter les temps interverts.
                        « Appliquer le cycle » inscrit les zones dans les conditions de micro-régulation (AV1, AV2…, selon la phase),
                        en remplaçant celles d'un passage précédent.
                    </p>

                    <h4>Fermetures anticipées avec glissements (proposition)</h4>
                    <label className="sc-nb" title="Groupes voitures dont la capacité utilisée, au cycle proposé, est sous ce seuil">
                        Groupes voitures sous
                        <input type="number" min={30} max={99} value={seuilFA} aria-label="Seuil de capacité des fermetures anticipées"
                            onChange={e => setSeuilFA(Math.max(30, Math.min(99, parseInt(e.target.value, 10) || SEUIL_CAPACITE_FERMETURE)))} />
                        % de capacité utilisée
                    </label>
                    {fermetures.length > 0 ? (
                        <table className="sc-table">
                            <thead><tr><th>Groupe</th><th>Cap. U</th><th title="Vert moins V.utile">Temps disponible</th>
                                <th title={`Environ ${Math.round(PART_TEMPS_DISPONIBLE * 100)} % du temps disponible, en fin de vert, sans passer sous le vert mini`}>Fermeture Déb – Fin</th>
                                <th title="Groupes antagonistes qui ouvrent après la fermeture et peuvent ouvrir plus tôt sans conflit intervert (Action GF)">Glissements</th>
                                <th>Non retenus</th></tr></thead>
                            <tbody>
                                {fermetures.map(f => (
                                    <tr key={f.groupe} className={f.duree > 0 ? '' : 'sc-sans-objet'}>
                                        <td className="sc-gauche sc-nom" title={nomGroupe(f.groupe)}>GF{f.groupe} {nomGroupe(f.groupe)}</td>
                                        <td>{pct(f.capacite)}</td>
                                        <td>{fmt(f.disponible, 1)} s</td>
                                        <td className="sc-insecable">{f.duree > 0 ? `${f.deb} – ${f.fin} s (${f.duree} s)` : '—'}</td>
                                        <td>{f.glissements.length ? f.glissements.map(court).join(', ') : 'aucun : rien à proposer'}</td>
                                        <td className="sc-gauche">{f.retenus.length ? f.retenus.map(r => `${court(r.id)} (tenu par ${court(r.par)})`).join(', ') : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="sc-attente">Aucun groupe voitures sous {seuilFA} % de capacité utilisée.</p>}
                    <p className="sc-note">
                        « Appliquer le cycle » inscrit aussi ces fermetures (FA1, FA2…, description « Fermeture théorique »), les
                        glissements en Action GF, en remplaçant celles d'un passage précédent. Une fermeture qui tombe dans une zone
                        d'adaptatif vertical ne joue que lorsque celui-ci n'est pas contracté.
                    </p>

                    <h4>Points de repos bus (proposition)</h4>
                    {reposBus.length > 0 ? (
                        <table className="sc-table">
                            <thead><tr><th>Groupe bus</th>
                                <th title={`Dans les ${FENETRE_REPOS_BUS} dernières secondes du vert bus, à l'instant où le plus de groupes sont au vert`}>Repos à</th>
                                <th>Groupes au vert</th>
                                <th title="Temps passé dans la phase bus à l'instant du repos, moins 1">N</th>
                                <th>Condition</th></tr></thead>
                            <tbody>
                                {reposBus.map(r => (
                                    <tr key={r.groupe}>
                                        <td className="sc-gauche sc-nom" title={nomGroupe(r.groupe)}>GF{r.groupe} {nomGroupe(r.groupe)}</td>
                                        <td>{r.instant} s</td>
                                        <td>{r.inclus.map(court).join(', ')}</td>
                                        <td>{r.n}</td>
                                        <td className="sc-gauche">{conditionRepos(r).micro}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="sc-attente">Aucun groupe bus (type B ou TC) dans le plan.</p>}
                    <p className="sc-note">
                        « Appliquer le cycle » inscrit un point de repos par groupe bus (« Att bus », « {DESCRIPTION_REPOS_BUS} maxi {tmab} secondes »),
                        écrit « TX » dans la colonne DA du groupe bus{tmabX === null ? <> et ajoute la variable micro « {VARIABLE_TMABX} »</> : ''}. L'indice X tient la place du
                        code trajet : remplacez-le dans DAX, TMABX et TX. Les repos d'un passage précédent sont remplacés ; les autres ne
                        sont pas touchés.
                    </p>
                    {avInscrits !== null && (
                        <p className="sc-note">
                            {avInscrits.length
                                ? `Inscrits : ${avInscrits.join(', ')} (Ctrl+Z pour annuler). Adaptez les conditions à la détection réelle et vérifiez dans l'onglet Simulation.`
                                : 'Aucune condition à inscrire.'}
                            {avInscrits.length < avUtiles.length + faUtiles.length + reposBus.length ? ' La table est pleine (30 conditions) : certaines lignes n\'ont pas été inscrites.' : ''}
                        </p>
                    )}
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
                    title={['Règle la durée du cycle du plan',
                        aPlacer.length ? `place ${aPlacer.length} groupe${aPlacer.length > 1 ? 's' : ''} associé${aPlacer.length > 1 ? 's' : ''}` : '',
                        avUtiles.length || faUtiles.length || reposBus.length
                            ? `inscrit ${[...avUtiles.map(a => `AV${a.phase}`), ...faUtiles.map((_, k) => `FA${k + 1}`), ...reposBus.map(() => 'Att bus')].join(', ')}` : ''].filter(Boolean).join(', puis ')}
                    onClick={appliquer}>
                    Appliquer le cycle{calculable && resultat?.cycleSuggere ? ` (${resultat.cycleSuggere} s)` : ''}
                </button>
            </div>
            </div>
        </>
    );

    // Fenêtre détachée (déplaçable sur un autre écran) : le contenu seul, la
    // fenêtre du navigateur porte le titre. Sinon, fenêtre non modale de la page.
    if (detachee) {
        return isOpen ? (
            <div className="modal-content suggestion-cycle sc-detachee">
                <div className="modal-body">{corps}</div>
            </div>
        ) : null;
    }
    return (
        <Modal isOpen={isOpen} onClose={onClose} nonModale className="suggestion-cycle" overlayClassName="suggestion-cycle-overlay"
            title={titreSuggestionCycle(planName)}>
            {corps}
        </Modal>
    );
};

export default SuggestionCycleDialog;
