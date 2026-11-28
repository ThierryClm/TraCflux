import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Modal from './Modal';
import type { Groupe, Matrice } from '../types/projet';
import {
    calculerSuggestionCycle, debutsDesPhases, nomCourt, degagementMatrice, detecterCheminCritique, placerGroupesAssocies, instantsPhasageBulle, dizaineSuperieure, CYCLE_MAX_CONSEILLE, CYCLE_MIN_CONSEILLE,
    NB_PHASES_MAX, NB_PHASES_MIN, TAUX_VISE_DEFAUT,
} from '../utils/suggestionCycle';
import type { PhasageCycle } from '../utils/suggestionCycle';
import { SATURATION_FLOW } from '../utils/capacityCalc';
import { proposerAdaptatifs, PASSAGES_MAX, TAUX_VISE_ADAPTATIFS } from '../utils/adaptatifsVerticaux';
import type { AdaptatifPropose, ModeAdaptatifs } from '../utils/adaptatifsVerticaux';
import { proposerFermetures, SEUIL_CAPACITE_FERMETURE, PART_TEMPS_DISPONIBLE } from '../utils/fermeturesAnticipees';
import type { FermeturePropose } from '../utils/fermeturesAnticipees';
import { proposerReposBus, indiceCodeTrajet, lireTmab, lireTmabX, variableTmab, DESCRIPTION_REPOS_BUS, FENETRE_REPOS_BUS, TMAB_DEFAUT } from '../utils/reposBus';
import type { ReposPropose } from '../utils/reposBus';
import type { ActionMicro } from '../types/projet';
import './SuggestionCycleDialog.css';

// Libellés des badges de source : ils disent d'où vient la position proposée.
const LIBELLE_SOURCE: Record<'matrice' | 'nom' | 'plan', string> = {
    matrice: 'Matrice',
    nom: 'Même voie',
    plan: 'Flèche opposée',
};

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
    /** Phasage enregistré avec le plan ; null l'efface (chapitre invalidé). */
    setPhasageCycle: (phasage: PhasageCycle | null) => void;
    setCycleLength: (cycle: number) => void;
    /** Phasage bulle du plan, rempli d'après les groupes déterminants (case à cocher). */
    setPhasageBulleCount: (count: number) => void;
    setPhasageBulleTimes: (times: number[]) => void;
    /** Phasage bulle actuel : rétabli quand on invalide le chapitre des phases. */
    phasageBulleCount?: number;
    phasageBulleTimes?: number[];
    /** Conditions du plan : celles de l'assistant déjà inscrites marquent leur chapitre comme validé à l'ouverture. */
    actionData?: ActionMicro[];
    /** Pré-remplissage du diagramme pour les déterminants sans vert (Déb/Fin vides). */
    updateGroupParams: (id: number, params: { offset?: number; durations?: { green?: number }; da?: string }) => void;
    /** Flèches du plan du carrefour : dernière source pour placer les groupes associés. */
    intersectionArrows?: { groupId: number; rotation?: number }[];
    /** Inscrit des conditions dans la table, après avoir vidé les lignes à remplacer ; renvoie le nombre inscrit. */
    ajouterActions?: (lignes: Partial<Omit<ActionMicro, 'id'>>[], remplacer?: (row: ActionMicro) => boolean) => number;
    /** Variables micro du plan : TMABx donne la durée d'attente des repos bus. */
    variablesMicro?: string[];
    /** Écrit une variable micro du plan (index, texte) : ajout de « TMABx = 10 » s'il manque. */
    setVariableMicro?: (index: number, value: string) => void;
    readOnly?: boolean;
    /** L'assistant est-il ouvert sur le plan de feu actif ? Sinon, une validation le réactive d'abord. */
    estPlanActif?: boolean;
    /** Ramène le plan de feu qui a ouvert l'assistant au premier plan. */
    demanderActivation?: () => void;
    /** Rendu dans une fenêtre détachée du navigateur (usePopupWindow), sans cadre de modale. */
    detachee?: boolean;
    /** Case « Assistant conception » de Mise en page → Infobulles. */
    tooltipsEnabled?: boolean;
}

/** Titre de la fenêtre, partagé avec la fenêtre détachée. */
export const titreSuggestionCycle = (planName: string) => `Assistant conception${planName ? ` — ${planName}` : ''}`;

/** Identifiants des chapitres repliables de l'assistant. */
type IdChapitre = 'phases' | 'cycle' | 'associes' | 'adaptatifs' | 'fermetures' | 'repos';

/** Validation d'un chapitre : sa proposition est appliquée au diagramme tant qu'il est validé. */
interface ValidationChapitre {
    valide: boolean;
    /** Raison pour laquelle on ne peut pas (encore) valider ; absente si c'est possible. */
    motif?: string;
    basculer: () => void;
    /** Libellé du bouton quand une mise à jour attend (ex. « Mettre à jour »). */
    libelle?: string;
    /** Fait clignoter le bouton : une action immédiate est attendue. */
    attention?: boolean;
}

/**
 * Chapitre repliable : le titre et le résumé de ses valeurs restent visibles,
 * le contenu ne s'affiche que déplié. Son bouton Valider applique la
 * proposition au diagramme ; un second clic l'invalide et rétablit le plan.
 */
const Chapitre = ({ tip, titre, resume, ouvert, basculer, validation, children }: {
    tip: (text: string | undefined) => string | undefined;
    titre: string; resume?: ReactNode; ouvert: boolean; basculer: () => void; validation?: ValidationChapitre; children: ReactNode;
}) => (
    <section className={`sc-chapitre${ouvert ? ' ouvert' : ''}${validation?.valide ? ' valide' : ''}`} aria-label={titre}>
        <div className="sc-chapitre-ligne">
            <button type="button" className="sc-chapitre-tete" aria-expanded={ouvert} onClick={basculer}
                title={tip(ouvert ? 'Réduire' : 'Déployer')}>
                <span className="sc-chevron" aria-hidden="true">{ouvert ? '▾' : '▸'}</span>
                <span className="sc-chapitre-titre">{titre}</span>
                {resume && <span className="sc-chapitre-resume" title={tip(typeof resume === 'string' ? resume : undefined)}>{resume}</span>}
            </button>
            {validation && (
                <button type="button" className={`sc-valider${validation.valide ? ' actif' : ''}${validation.attention ? ' attention' : ''}`} aria-pressed={validation.valide}
                    disabled={!validation.valide && !!validation.motif} onClick={validation.basculer}
                    title={tip(validation.libelle
                        ? 'Les valeurs proposées ont changé : appliquer la mise à jour au diagramme'
                        : validation.valide
                            ? 'Invalider : le diagramme revient à son état d\'avant la validation'
                            : validation.motif ?? 'Valider : la proposition s\'applique tout de suite au diagramme')}>
                    {validation.libelle ?? (validation.valide ? '✓ Validé' : 'Valider')}
                </button>
            )}
        </div>
        {ouvert && <div className="sc-chapitre-corps">{children}</div>}
    </section>
);

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

const fmt = (v: number, d = 3) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * « Assistant conception… » (menu Diagramme). L'utilisateur choisit le
 * groupe déterminant de chaque phase, dans l'ordre du cycle ; la fenêtre en
 * déduit Y, le temps perdu, les cycles minimal, de Webster et pour un taux de
 * saturation visé, et une répartition des verts par phase.
 */
const SuggestionCycleDialog = ({
    isOpen, onClose, planName, groups, conflictMatrix, cycleLength, getTrafficData,
    trafficDatasetName, phasageCycle, setPhasageCycle, setCycleLength,
    setPhasageBulleCount, setPhasageBulleTimes, updateGroupParams, intersectionArrows = [], ajouterActions, variablesMicro, setVariableMicro, readOnly = false, detachee = false,
    phasageBulleCount, phasageBulleTimes, actionData, tooltipsEnabled = true,
    estPlanActif = true, demanderActivation,
}: SuggestionCycleDialogProps) => {
    const tip = (text: string | undefined) => tooltipsEnabled ? text : undefined;
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

    // Capacité utilisée du déterminant de la phase i au cycle proposé, avec le
    // vert que la répartition lui donne : c'est elle qui dit si le taux visé
    // est tenu. Celle du diagramme actuel ne décrit que l'état de départ.
    const capaciteProposee = (i: number) => {
        const p = resultat?.phases[i];
        const cycle = resultat?.cycleSuggere;
        const vert = resultat?.verts[i];
        if (!p || !p.trafic || !cycle || !vert) return null;
        return (p.trafic * cycle) / (SATURATION_FLOW * (p.coefVoie || 1) * vert) * 100;
    };

    const sansTrafic = resultat !== null && resultat.Y === 0;
    const calculable = resultat !== null && resultat.degagementsManquants.length === 0 && !sansTrafic;
    const horsBornes = (c: number | null) => c !== null && (c < CYCLE_MIN_CONSEILLE || c > CYCLE_MAX_CONSEILLE);

    // Disposition proposée : début de vert de chaque phase dans le cycle proposé.
    const debuts = resultat && calculable ? debutsDesPhases(resultat.verts, resultat.phases.map((_, i) => degagementsNum[i] ?? 0)) : [];

    // Groupes associés : position déduite de la matrice, sinon du nom, sinon du plan.
    const placements = useMemo(() => {
        if (!resultat || !calculable || !complet) return [];
        // Calage sur le cycle qu'appliquera « Appliquer le cycle », et non sur
        // le cycle actuel du plan : les fermetures qui rebouclent en dépendent.
        const cycleRef = resultat.cycleSuggere ?? cycleLength;
        // Référence : la disposition proposée des déterminants (débuts et verts
        // calculés), celle que « Appliquer le cycle » inscrira. Prendre leurs
        // positions actuelles fausserait le placement des groupes associés dès
        // que les verts du diagramme diffèrent de la répartition calculée.
        const dets = (brouillon.determinants as number[]).map((id, i) =>
            debuts[i] === undefined ? null : { id, debut: debuts[i], fin: debuts[i] + resultat.verts[i] });
        if (dets.some(d => d === null)) return [];
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
    type StatutPlacement = 'auto' | 'maj' | 'regle' | 'main';
    const LIBELLE_ETAT: Record<StatutPlacement, string> = {
        auto: 'avec le cycle',
        maj: 'à mettre à jour',
        regle: 'déjà réglé',
        main: 'à la main',
    };
    const statutPlacement = (p: { id: number; aVerifier: boolean; fin: number; debut: number; phases: number[] }): StatutPlacement => {
        const g = groups.find(gr => gr.id === p.id);
        const cycleRef = resultat?.cycleSuggere ?? cycleLength;
        if (g && g.durations?.green > 0 && (Number(g.offset) || 0) + g.durations.green <= cycleRef) {
            // Un groupe déjà placé n'est « réglé » que si sa position correspond
            // encore à la proposition. Après un changement de trafic ou de cycle,
            // les valeurs recalculées diffèrent : il est à mettre à jour.
            const memeOffset = ((Math.round(Number(g.offset) || 0) % cycleRef) + cycleRef) % cycleRef === ((p.debut % cycleRef) + cycleRef) % cycleRef;
            const memeVert = g.durations.green === p.fin - p.debut;
            return memeOffset && memeVert || p.aVerifier ? 'regle' : 'maj';
        }
        return !p.aVerifier && p.phases.length > 0 && p.fin > p.debut ? 'auto' : 'main';
    };
    // Groupe dont le vert est déjà inscrit dans le diagramme : ses valeurs
    // viennent d'une saisie (ou d'un placement déjà validé), pas de la
    // déduction affichée à côté, qui n'est plus qu'une explication.
    const saisi = (id: number) => {
        const g = groups.find(gr => gr.id === id);
        const cycleRef = resultat?.cycleSuggere ?? cycleLength;
        return !!g && (Number(g.durations?.green) || 0) > 0
            && (Number(g.offset) || 0) + g.durations.green <= cycleRef;
    };
    // Groupes « à la main » : cocher leur case les place tout de suite, malgré
    // une déduction incertaine.
    const estCochable = (p: typeof placements[number]) => statutPlacement(p) === 'main' && p.fin > p.debut;
    // Un groupe dont la ligne et la colonne de matrice sont vides n'a aucune
    // sujétion de temps : l'assistant le place avec la phase, et le dit.
    const sansSujetion = (id: number) => {
        const renseignee = (v: unknown) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));
        const ligne = conflictMatrix[id - 1] ?? [];
        const colonne = conflictMatrix.map(r => r?.[id - 1]);
        return ![...ligne, ...colonne].some(renseignee);
    };
    const aPlacer = placements.filter(p => ['auto', 'maj'].includes(statutPlacement(p)));
    const aMettreAJour = placements.filter(p => statutPlacement(p) === 'maj');
    // Adaptatifs verticaux proposés, un par phase, sur la disposition prévue :
    // diagramme actuel, déterminants proposés et groupes placés avec le cycle.
    const [modeAV, setModeAV] = useState<ModeAdaptatifs>('iteratif');
    const [tauxAV, setTauxAV] = useState(TAUX_VISE_ADAPTATIFS);
    // Disposition prévue des groupes : diagramme actuel, déterminants proposés
    // et groupes placés avec le cycle. Base des adaptatifs et des fermetures.
    const disposition = useMemo(() => {
        if (!resultat || !calculable || !complet || !resultat.cycleSuggere) return null;
        const cycleRef = resultat.cycleSuggere;
        const dets = brouillon.determinants as number[];
        return groups.map(g => {
            const base = {
                id: g.id, type: String(g.type ?? ''), vertMini: Number(g.minGreen) || 0, da: String(g.da ?? ''),
                trafic: Number(getTrafficData(g.id)?.trafficVol) || 0, coefVoie: Number(g.laneCoef) || 1,
            };
            const i = dets.indexOf(g.id);
            if (i >= 0 && debuts[i] !== undefined) return { ...base, debut: debuts[i], vert: resultat.verts[i] };
            const debutActuel = Number(g.offset) || 0;
            if (g.durations?.green > 0 && debutActuel + g.durations.green <= cycleRef) {
                return { ...base, debut: debutActuel, vert: g.durations.green };
            }
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
    const avUtiles = propositionAV?.adaptatifs.filter(a => a.duree > 0) ?? [];
    const [avInscrits, setAvInscrits] = useState<string[] | null>(null);
    // Ligne de condition renseignée avec ce que l'assistant sait de la zone ;
    // la condition de contraction reste à adapter à la détection réelle.
    const court = (id: number) => nomCourt(groups.find(g => g.id === id)?.name, id);
    // Point de repos bus : les variables sont indicées d'après le code trajet
    // du groupe (T1 → DA1, TMAB1, AVert1) ; sans chiffre, x reste à remplacer.
    const conditionRepos = (r: ReposPropose) => {
        const groupe = groups.find(g => g.id === r.groupe);
        const indice = indiceCodeTrajet(groupe?.da);
        // La variable générique TMABx, si elle existe encore, sert de valeur de départ.
        const tmab = lireTmab(variablesMicro, indice) ?? lireTmabX(variablesMicro) ?? TMAB_DEFAUT;
        return {
            gf: String(r.groupe),
            action: 'Point de repos',
            deb: String(r.instant),
            fin: '',
            abrv: 'Att bus',
            description: `${DESCRIPTION_REPOS_BUS} maxi ${tmab} secondes`,
            micro: `Attente quittée si TPPh_L${r.groupe} + DA${indice} > ${r.n} + TMAB${indice}`,
        };
    };
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

    // Chapitres repliés à l'ouverture (le titre et le résumé suffisent pour
    // suivre), sauf le tableau des groupes déterminants, point de départ.
    const [ouverts, setOuverts] = useState<Record<IdChapitre, boolean>>({
        phases: true, cycle: false, associes: false, adaptatifs: false, fermetures: false, repos: false,
    });
    const basculer = (id: IdChapitre) => () => setOuverts(o => ({ ...o, [id]: !o[id] }));
    const resumePhases = `${nbPhases} phases : ${brouillon.determinants.map(d => (d === null ? '—' : court(d))).join(', ')} · taux visé ${brouillon.tauxVise} %`;
    const saturationImpose = resultat != null && resultat.cycleSuggere !== null && resultat.websterExact !== null
        && resultat.cycleSuggere > dizaineSuperieure(resultat.websterExact);
    const resumeCycle = resultat && calculable && resultat.cycleSuggere
        ? `cycle proposé ${resultat.cycleSuggere} s (${saturationImpose
            ? `saturation ${brouillon.tauxVise} %`
            : `Webster ${fmt(resultat.websterExact ?? 0, 1)} s`})${resultat.sature ? ' · saturé' : ''}`
        : undefined;
    const compte = (statut: StatutPlacement) => placements.filter(p => statutPlacement(p) === statut).length;
    const resumeAssocies = [
        compte('maj') ? `${compte('maj')} à mettre à jour` : '',
        compte('auto') ? `${compte('auto')} avec le cycle` : '',
        compte('main') ? `${compte('main')} à la main` : '',
        compte('regle') ? `${compte('regle')} déjà réglé${compte('regle') > 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(' · ');
    const resumeAdaptatifs = `${avUtiles.length ? avUtiles.map(a => `AV${a.phase} ${a.deb}–${a.fin} s`).join(', ') : 'aucune zone'} · ${tauxAV} % · ${modeAV === 'iteratif' ? 'itératif' : 'prudent'}`;
    const resumeFermetures = `${faUtiles.length ? faUtiles.map((f, k) => `FA${k + 1} ${court(f.groupe)} ${f.deb}–${f.fin} s → ${f.glissements.map(court).join(', ')}`).join(' ; ') : 'aucune'} · seuil ${seuilFA} %`;
    const resumeRepos = reposBus.length ? reposBus.map(r => `${court(r.groupe)} à ${r.instant} s`).join(', ') : 'aucun groupe avec un code trajet (DA)';

    // ── Validation chapitre par chapitre ────────────────────────────────────
    // Valider un chapitre applique tout de suite sa proposition au diagramme ;
    // l'invalider rétablit ce qu'il y avait avant. Tant qu'il est validé, une
    // proposition qui change (taux, mode, groupes déterminants…) se réapplique.
    // Les chapitres en aval de la durée de cycle sont calculés sur le cycle
    // proposé : ils ne se valident qu'une fois ce cycle en place, et invalider
    // le cycle les invalide d'abord.
    const cycleEnPlace = resultat?.cycleSuggere != null && cycleLength === resultat.cycleSuggere;
    const lignesChapitre = {
        adaptatifs: avUtiles.map(conditionAdaptatif),
        fermetures: faUtiles.map(conditionFermeture),
        repos: reposBus.map(conditionRepos),
    };
    const lignesDe = { adaptatifs: estAdaptatifAssistant, fermetures: estFermetureAssistant, repos: estReposAssistant };
    const signatures: Record<IdChapitre, string> = {
        phases: complet ? JSON.stringify(brouillon) : '',
        cycle: String(resultat?.cycleSuggere ?? ''),
        associes: '',
        adaptatifs: JSON.stringify(lignesChapitre.adaptatifs),
        fermetures: JSON.stringify(lignesChapitre.fermetures),
        repos: JSON.stringify(lignesChapitre.repos),
    };
    const AUCUN: Record<IdChapitre, boolean> = { phases: false, cycle: false, associes: false, adaptatifs: false, fermetures: false, repos: false };
    const [valides, setValides] = useState<Record<IdChapitre, boolean>>(AUCUN);
    // Ce que la validation a remplacé, pour le rétablir ; et la proposition appliquée.
    const avant = useRef<{
        phases?: { phasage: PhasageCycle | null; bulleCount?: number; bulleTimes?: number[] };
        cycle?: number;
        associes?: { id: number; offset: number; vert: number }[];
        repos?: { da: { id: number; da: string }[]; tmab: number | null };
    }>({});
    const appliques = useRef<Partial<Record<IdChapitre, string>>>({});
    const [tablePleine, setTablePleine] = useState(false);
    // À l'ouverture : rien n'est à rétablir ; les conditions de l'assistant
    // déjà dans la table marquent leur chapitre comme validé.
    useEffect(() => {
        if (!isOpen) return;
        avant.current = {};
        appliques.current = {};
        setTablePleine(false);
        const data = actionData ?? [];
        setValides({ ...AUCUN, adaptatifs: data.some(estAdaptatifAssistant), fermetures: data.some(estFermetureAssistant), repos: data.some(estReposAssistant) });
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const inscrire = (id: 'adaptatifs' | 'fermetures' | 'repos') => {
        if (!ajouterActions) return 0;
        const lignes = lignesChapitre[id];
        const nb = ajouterActions(lignes, lignesDe[id]);
        if (nb < lignes.length) setTablePleine(true);
        return nb;
    };
    const appliquerChapitre = (id: IdChapitre) => {
        if (readOnly) return;
        const a = avant.current;
        switch (id) {
            case 'phases':
                if (!complet) return;
                a.phases ??= { phasage: phasageCycle, bulleCount: phasageBulleCount, bulleTimes: phasageBulleTimes };
                enregistrer();
                break;
            case 'cycle': {
                if (!resultat?.cycleSuggere) return;
                a.cycle ??= cycleLength;
                const nouveau = resultat.cycleSuggere;
                if (nouveau !== cycleLength) {
                    // La répartition calculée est inscrite d'un bloc : tous les
                    // déterminants à leur début et vert proposés, puis les
                    // groupes associés qui n'ont pas de vert ou qui débordent le
                    // nouveau cycle. Sans cela, un mélange d'anciens verts et de
                    // débuts recalculés chevaucherait les phases et la matrice.
                    const dets = brouillon.determinants as number[];
                    const corrections: { id: number; offset: number; vert: number }[] = [];
                    dets.forEach((id, i) => {
                        if (debuts[i] === undefined || resultat.verts[i] === undefined) return;
                        corrections.push({ id, offset: debuts[i], vert: resultat.verts[i] });
                    });
                    placements.forEach(p => {
                        if (dets.includes(p.id) || p.aVerifier || p.phases.length === 0 || p.fin <= p.debut) return;
                        const g = groups.find(gr => gr.id === p.id);
                        if (!g) return;
                        const vert = Number(g.durations?.green) || 0;
                        const offset = Number(g.offset) || 0;
                        if (vert > 0 && offset + vert <= nouveau) return;
                        corrections.push({ id: p.id, offset: p.debut, vert: p.fin - p.debut });
                    });
                    if (corrections.length) {
                        a.associes = [...(a.associes ?? []), ...corrections
                            .filter(c => !a.associes?.some(x => x.id === c.id))
                            .map(c => {
                                const g = groups.find(gr => gr.id === c.id);
                                return { id: c.id, offset: Number(g?.offset) || 0, vert: Number(g?.durations?.green) || 0 };
                            })];
                        corrections.forEach(c => updateGroupParams(c.id, { offset: c.offset, durations: { green: c.vert } }));
                    }
                    setCycleLength(nouveau);
                }
                break;
            }
            case 'associes':
                if (!aPlacer.length) return;
                a.associes = [...(a.associes ?? []), ...aPlacer
                    .filter(p => !a.associes?.some(x => x.id === p.id))
                    .map(p => { const g = groups.find(gr => gr.id === p.id); return { id: p.id, offset: Number(g?.offset) || 0, vert: Number(g?.durations?.green) || 0 }; })];
                aPlacer.forEach(p => updateGroupParams(p.id, { offset: p.debut, durations: { green: p.fin - p.debut } }));
                break;
            case 'repos':
                a.repos ??= { da: [], tmab: null };
                inscrire('repos');
                // Le groupe porte déjà son code trajet : on le laisse tel quel.
                // Variable micro TMAB<indice>, ajoutée par code trajet si le plan ne l'a pas.
                if (reposBus.length && setVariableMicro) {
                    const indices = [...new Set(reposBus.map(r => indiceCodeTrajet(groups.find(g => g.id === r.groupe)?.da)))];
                    const libre = (variablesMicro ?? []).findIndex(v => !v.trim());
                    let slot = libre >= 0 ? libre : (variablesMicro ?? []).length;
                    // Une variable générique « TMABx » existante est reprise : elle
                    // prend l'indice du premier code trajet, avec sa valeur.
                    const slotX = (variablesMicro ?? []).findIndex(v => /^\s*TMABx\s*=/i.test(v));
                    let xDisponible = slotX >= 0;
                    indices.forEach(ind => {
                        if (lireTmab(variablesMicro, ind) !== null) return;
                        if (xDisponible) {
                            const valeur = lireTmabX(variablesMicro) ?? TMAB_DEFAUT;
                            setVariableMicro(slotX, `TMAB${ind} = ${valeur}`);
                            if (a.repos && a.repos.tmab === null) a.repos.tmab = slotX;
                            xDisponible = false;
                            return;
                        }
                        setVariableMicro(slot, variableTmab(ind));
                        if (a.repos && a.repos.tmab === null) a.repos.tmab = slot;
                        slot += 1;
                    });
                    // La variable générique n'a plus lieu d'être : les variables
                    // indexées la remplacent, on supprime la ligne TMABx restante.
                    if (slotX >= 0 && xDisponible) setVariableMicro(slotX, '');
                }
                break;
            default:
                inscrire(id);
        }
        appliques.current[id] = signatures[id];
        setValides(v => ({ ...v, [id]: true }));
    };
    const retirerChapitre = (id: IdChapitre) => {
        if (readOnly) return;
        const a = avant.current;
        switch (id) {
            case 'phases':
                if (a.phases) {
                    setPhasageCycle(a.phases.phasage);
                    if (a.phases.bulleCount !== undefined) setPhasageBulleCount(a.phases.bulleCount);
                    if (a.phases.bulleTimes) setPhasageBulleTimes(a.phases.bulleTimes);
                }
                break;
            case 'cycle':
                // Les chapitres calculés sur le cycle proposé partent avec lui.
                (['repos', 'fermetures', 'adaptatifs'] as const).forEach(aval => { if (valides[aval]) retirerChapitre(aval); });
                // Les groupes replacés par la validation du cycle sont restaurés
                // même si le chapitre « associés » n'a pas été validé à part.
                if (a.associes?.length) retirerChapitre('associes');
                if (a.cycle !== undefined) setCycleLength(a.cycle);
                break;
            case 'associes':
                a.associes?.forEach(x => updateGroupParams(x.id, { offset: x.offset, durations: { green: x.vert } }));
                break;
            case 'repos':
                ajouterActions?.([], estReposAssistant);
                a.repos?.da.forEach(x => updateGroupParams(x.id, { da: x.da }));
                if (a.repos?.tmab != null) setVariableMicro?.(a.repos.tmab, '');
                break;
            default:
                ajouterActions?.([], lignesDe[id]);
        }
        delete a[id as keyof typeof a];
        delete appliques.current[id];
        setValides(v => ({ ...v, [id]: false }));
    };
    // Proposition changée d'un chapitre validé : elle se réapplique au diagramme.
    useEffect(() => {
        if (!isOpen || readOnly) return;
        (['phases', 'cycle', 'adaptatifs', 'fermetures', 'repos'] as const).forEach(id => {
            const applique = appliques.current[id];
            if (valides[id] && applique !== undefined && signatures[id] && applique !== signatures[id]) appliquerChapitre(id);
        });
    }, [signatures.phases, signatures.cycle, signatures.adaptatifs, signatures.fermetures, signatures.repos]); // eslint-disable-line react-hooks/exhaustive-deps

    const motifs: Record<IdChapitre, string | undefined> = {
        phases: !complet ? 'Choisissez d\'abord un groupe déterminant pour chaque phase' : undefined,
        cycle: !calculable || !resultat?.cycleSuggere ? 'Aucun cycle calculable pour l\'instant' : undefined,
        associes: !cycleEnPlace ? 'Validez d\'abord la durée de cycle' : !aPlacer.length ? 'Aucun groupe à placer avec le cycle' : undefined,
        adaptatifs: !cycleEnPlace ? 'Validez d\'abord la durée de cycle' : !avUtiles.length ? 'Aucune zone à inscrire' : undefined,
        fermetures: !cycleEnPlace ? 'Validez d\'abord la durée de cycle' : !faUtiles.length ? 'Aucune fermeture à inscrire' : undefined,
        repos: !cycleEnPlace ? 'Validez d\'abord la durée de cycle' : !reposBus.length ? 'Aucun groupe avec un code trajet (DA)' : undefined,
    };
    const validation = (id: IdChapitre): ValidationChapitre | undefined => {
        if (readOnly) return undefined;
        // Groupes associés : des valeurs recalculées attendent d'être appliquées.
        if (id === 'associes' && aMettreAJour.length) {
            return {
                valide: valides.associes,
                basculer: () => executerChapitre('associes'),
                libelle: 'Mettre à jour',
                attention: true,
            };
        }
        return {
            valide: valides[id],
            motif: motifs[id],
            basculer: () => executerChapitre(id),
        };
    };

    // « Appliquer le cycle » : valide d'un coup tous les chapitres qui ont
    // quelque chose à appliquer, dans l'ordre (le cycle avant ce qui en dépend).
    const appliquer = () => {
        if (!resultat?.cycleSuggere) return;
        appliquerChapitre('phases');
        appliquerChapitre('cycle');
        if (aPlacer.length) appliquerChapitre('associes');
        if (ajouterActions && disposition) {
            (['adaptatifs', 'fermetures', 'repos'] as const).forEach(id => { if (lignesChapitre[id].length) appliquerChapitre(id); });
            setAvInscrits([...lignesChapitre.adaptatifs, ...lignesChapitre.fermetures, ...lignesChapitre.repos].map(l => String(l.abrv)));
        }
    };

    // Une validation alors qu'un autre plan est affiché : on ramène d'abord le
    // plan de l'assistant au premier plan, puis on applique au rendu suivant,
    // avec les fonctions à jour (le plan synchronisé).
    type Ordre = { type: 'chapitre'; id: IdChapitre } | { type: 'appliquer' } | { type: 'placer'; id: number };
    const ordreEnAttente = useRef<Ordre | null>(null);
    const actionsCourantes = useRef<(ordre: Ordre) => void>(() => {});
    const placerMain = (id: number) => {
        const p = placements.find(x => x.id === id);
        if (!p || p.fin <= p.debut) return;
        const a = avant.current;
        a.associes = [...(a.associes ?? []), ...(a.associes?.some(x => x.id === id) ? [] : [{
            id, offset: Number(groups.find(g => g.id === id)?.offset) || 0,
            vert: Number(groups.find(g => g.id === id)?.durations?.green) || 0,
        }])];
        updateGroupParams(id, { offset: p.debut, durations: { green: p.fin - p.debut } });
        appliques.current.associes = signatures.associes;
        setValides(v => ({ ...v, associes: true }));
    };
    actionsCourantes.current = ordre => {
        if (ordre.type === 'appliquer') appliquer();
        else if (ordre.type === 'placer') placerMain(ordre.id);
        else if (valides[ordre.id]) retirerChapitre(ordre.id);
        else appliquerChapitre(ordre.id);
    };
    const lancer = (ordre: Ordre) => {
        if (estPlanActif) { actionsCourantes.current(ordre); return; }
        ordreEnAttente.current = ordre;
        demanderActivation?.();
    };
    const executerChapitre = (id: IdChapitre) => lancer({ type: 'chapitre', id });
    const executerGlobal = () => lancer({ type: 'appliquer' });
    useEffect(() => {
        if (!estPlanActif || !ordreEnAttente.current) return;
        const ordre = ordreEnAttente.current;
        ordreEnAttente.current = null;
        // Laisse le plan réactivé se synchroniser (groupes, cycle) avant d'écrire.
        const t = setTimeout(() => actionsCourantes.current(ordre), 0);
        return () => clearTimeout(t);
    }, [estPlanActif]);

    const corps = (
        <>
            <div className="sc-defilement">
            <Chapitre tip={tip} titre="Phases et groupes déterminants" resume={resumePhases} ouvert={ouverts.phases} basculer={basculer('phases')} validation={validation('phases')}>
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
                    title={tip("Refaire la détection des phases et des groupes déterminants sur le diagramme actuel")}
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
                    <tr><th>Phase</th><th>Groupe déterminant</th><th>Trafic (uvp/h)</th><th>Coef. voie</th>
                        <th title={tip("Au cycle proposé et avec le vert proposé ; la valeur du diagramme actuel est rappelée au survol")}>Cap. U prévue</th><th>y</th>
                        <th>Vert mini</th><th>Dégagement vers la phase suivante</th></tr>
                </thead>
                <tbody>
                    {brouillon.determinants.map((det, i) => {
                        const p = resultat?.phases[i];
                        const g = det !== null ? groupesDonnees.find(x => x.id === det) : undefined;
                        const manque = brouillon.degagements[i].trim() === '';
                        const suivante = (i + 1) % nbPhases + 1;
                        const uPrevue = det !== null ? capaciteProposee(i) : null;
                        const uActuelle = det !== null ? chemin?.capaciteUtilisee[det] : undefined;
                        const infobulleCap = uPrevue !== null
                            ? `Cycle proposé de ${resultat?.cycleSuggere} s, vert proposé de ${resultat?.verts[i]} s`
                                + (uActuelle !== undefined ? ` ; diagramme actuel : ${Math.round(uActuelle)} %` : '')
                            : undefined;
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
                                <td title={tip(infobulleCap)}>
                                    {uPrevue !== null
                                        ? <span className={uPrevue > brouillon.tauxVise ? 'sc-depasse' : ''}>{Math.round(uPrevue)} %</span>
                                        : (uActuelle !== undefined ? `${Math.round(uActuelle)} %` : '')}
                                </td>
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
            </Chapitre>

            {!complet && <p className="sc-attente">Choisissez un groupe déterminant pour chaque phase.</p>}
            {resultat && sansTrafic && <p className="sc-alerte">Aucun trafic pour ces groupes dans le jeu {trafficDatasetName || 'actif'} : renseignez l'onglet Trafic.</p>}
            {resultat && resultat.degagementsManquants.length > 0 && !sansTrafic &&
                <p className="sc-attente">Précisez le dégagement après la phase {resultat.degagementsManquants.map(i => i + 1).join(', ')}.</p>}

            {resultat && calculable && (
                <Chapitre tip={tip} titre="Durée de cycle" resume={resumeCycle} ouvert={ouverts.cycle} basculer={basculer('cycle')} validation={validation('cycle')}>
                <div className="sc-resultat" aria-label="Résultat">
                    <p>Y = <b>{fmt(resultat.Y)}</b> · temps perdu L = <b>{resultat.L} s</b></p>
                    {resultat.sature && <p className="sc-alerte">Y ≥ 0,9 : le carrefour est saturé ; aucun cycle ne suffira à écouler ce trafic.</p>}
                    {resultat.cycleWebster !== null && (
                        <ul>
                            <li>Cycle minimal (saturation à 100 %) : <b>{resultat.cycleMinimal} s</b></li>
                            <li>Cycle optimal de Webster (1,5 L + 5) / (1 − Y) : {fmt(resultat.websterExact ?? 0, 1)} s,
                                soit un <b>cycle proposé de {resultat.cycleSuggere} s</b> (arrondi à la dizaine supérieure)
                                {horsBornes(resultat.cycleSuggere) && <span className="sc-alerte"> hors de la plage usuelle {CYCLE_MIN_CONSEILLE}–{CYCLE_MAX_CONSEILLE} s</span>}</li>
                            <li>Cycle pour une saturation de {brouillon.tauxVise} % : <b>{resultat.cycleTauxVise ?? '—'}{resultat.cycleTauxVise !== null ? ' s' : ''}</b></li>
                        </ul>
                    )}
                    {resultat.cycleTauxVise !== null && resultat.websterExact !== null && resultat.cycleTauxVise > resultat.websterExact && (
                        <p className="sc-note">
                            Le cycle de saturation dépasse celui de Webster : c'est lui qui est proposé, pour garder chaque
                            déterminant sous {brouillon.tauxVise} % de capacité utilisée.
                        </p>
                    )}
                    {resultat.cycleWebster !== null && (
                        <p>Verts proposés pour {resultat.cycleSuggere} s :{' '}
                            {resultat.verts.map((v, i) => `phase ${i + 1} (${nomGroupe(resultat.phases[i].determinant)}) ${v} s`).join(' · ')}
                        </p>
                    )}
                    <p className="sc-note">Cycle actuel du plan : {cycleLength} s.</p>
                    {preremplis.length > 0 && <p className="sc-note">Diagramme pré-rempli pour les groupes sans vert : {preremplis.map(id => `GF${id}`).join(', ')}.</p>}
                </div>
                </Chapitre>
            )}

            {placements.length > 0 && (
                <Chapitre tip={tip} titre="Groupes associés" resume={resumeAssocies} ouvert={ouverts.associes} basculer={basculer('associes')} validation={validation('associes')}>
                <div className="sc-associes">
                    {resultat?.cycleSuggere ? <p className="sc-note">Calés sur le cycle proposé de {resultat.cycleSuggere} s.</p> : null}
                    <table className="sc-table">
                        <thead><tr><th>Groupe</th><th>Phase</th><th>Déb – Fin</th><th>Source de la déduction</th><th>Placer</th><th>Placement</th></tr></thead>
                        <tbody>
                            {placements.map(p => (
                                <tr key={p.id}>
                                    <td className="sc-gauche sc-nom" title={tip(nomGroupe(p.id))}>GF{p.id} {nomGroupe(p.id)}</td>
                                    <td>{p.phases.length ? p.phases.map(i => i + 1).join(', ') : '—'}</td>
                                    <td className="sc-insecable">{p.fin > p.debut ? `${p.debut} – ${p.fin} s` : '—'}</td>
                                    <td className="sc-gauche sc-source">
                                        {saisi(p.id) && <span className="sc-badge sc-badge-saisi">Saisi</span>}
                                        {saisi(p.id) && p.source && ' '}
                                        {p.source && <span className={`sc-badge sc-badge-${p.source}${saisi(p.id) ? ' sc-badge-secondaire' : ''}`}>{LIBELLE_SOURCE[p.source]}</span>}
                                        {' '}{p.explication}
                                        {p.aVerifier && <span className="sc-verif">à vérifier</span>}
                                        {sansSujetion(p.id) && (
                                            <div className="sc-sans-sujetion">Aucune sujétion de temps : placé avec la phase.</div>
                                        )}
                                    </td>
                                    <td className="sc-insecable">
                                        {estCochable(p) ? (
                                            <input type="checkbox" checked={false}
                                                aria-label={`Placer ${nomGroupe(p.id)}`}
                                                title={tip(p.aVerifier
                                                    ? 'Déduction à vérifier : cochez pour l’appliquer tout de suite ; elle peut ne pas respecter tous les dégagements.'
                                                    : 'Cocher pour placer ce groupe tout de suite avec le cycle proposé.')}
                                                onChange={e => { if (e.target.checked) lancer({ type: 'placer', id: p.id }); }} />
                                        ) : '—'}
                                    </td>
                                    <td className="sc-insecable">
                                        <span className={`sc-etat sc-etat-${statutPlacement(p)}`}>{LIBELLE_ETAT[statutPlacement(p)]}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="sc-legende">
                        <p>
                            <span className="sc-etat sc-etat-regle">déjà réglé</span> valeurs du diagramme, conformes à la proposition ·
                            <span className="sc-etat sc-etat-maj">à mettre à jour</span> valeurs du diagramme, différentes de la proposition ·
                            <span className="sc-etat sc-etat-auto">avec le cycle</span> inscrit par « Appliquer le cycle » ·
                            <span className="sc-etat sc-etat-main">à la main</span> déduction incertaine, à cocher pour placer
                        </p>
                        <p>
                            <span className="sc-badge sc-badge-saisi">Saisi</span> valeurs entrées dans le diagramme ·
                            <span className="sc-badge sc-badge-matrice">Matrice</span> temps interverts ·
                            <span className="sc-badge sc-badge-nom">Même voie</span> libellé commun ·
                            <span className="sc-badge sc-badge-plan">Flèche opposée</span> sens opposé sur l’image
                        </p>
                    </div>
                    <p className="sc-note">
                        « Appliquer le cycle » règle d'abord la durée du cycle, puis inscrit dans le diagramme les groupes
                        « avec le cycle ». Les groupes déjà réglés ne sont pas modifiés ; ceux
                        « à vérifier » restent à placer à la main.
                    </p>
                </div>
                </Chapitre>
            )}

            {propositionAV && propositionAV.adaptatifs.length > 0 && (
                <Chapitre tip={tip} titre="Adaptatifs verticaux" resume={resumeAdaptatifs} ouvert={ouverts.adaptatifs} basculer={basculer('adaptatifs')} validation={validation('adaptatifs')}>
                <div className="sc-associes sc-adaptatifs">
                    <label className="sc-nb" title={tip("Une phase ne se contracte que lorsque sa demande est servie : le taux visé peut être plus haut que pour le cycle")}>
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
                            <th title={tip(`Capacité utilisée du déterminant au cycle de ${propositionAV.cycleNominal} s`)}>Cap. U nominale</th>
                            <th title={tip("Toutes les zones contractées ensemble")}>Cap. U tout contracté</th>
                            <th title={tip("Cette zone seule contractée, les autres en extension. Taux fourni à titre indicatif, car sur le principe, la demande a été satisfaite.")}>Cap. U zone seule</th>
                            <th>Limité par</th></tr></thead>
                        <tbody>
                            {propositionAV.adaptatifs.map(a => (
                                <tr key={a.phase}>
                                    <td>{a.phase}</td>
                                    <td className="sc-gauche sc-nom" title={tip(nomGroupe(a.determinant))}>GF{a.determinant} {nomGroupe(a.determinant)}</td>
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
                </div>
                </Chapitre>
            )}

            {disposition && (
                <Chapitre tip={tip} titre="Fermetures anticipées avec glissements" resume={resumeFermetures} ouvert={ouverts.fermetures} basculer={basculer('fermetures')} validation={validation('fermetures')}>
                <div className="sc-associes sc-adaptatifs">
                    <label className="sc-nb" title={tip("Groupes voitures dont la capacité utilisée, au cycle proposé, est sous ce seuil")}>
                        Groupes voitures sous
                        <input type="number" min={30} max={99} value={seuilFA} aria-label="Seuil de capacité des fermetures anticipées"
                            onChange={e => setSeuilFA(Math.max(30, Math.min(99, parseInt(e.target.value, 10) || SEUIL_CAPACITE_FERMETURE)))} />
                        % de capacité utilisée
                    </label>
                    {fermetures.length > 0 ? (
                        <table className="sc-table">
                            <thead><tr><th>Groupe</th><th>Cap. U</th><th title={tip("Vert moins V.utile")}>Temps disponible</th>
                                <th title={tip(`Environ ${Math.round(PART_TEMPS_DISPONIBLE * 100)} % du temps disponible, en fin de vert, sans passer sous le vert mini`)}>Fermeture Déb – Fin</th>
                                <th title={tip("Groupes antagonistes qui ouvrent après la fermeture et peuvent ouvrir plus tôt sans conflit intervert (Action GF)")}>Glissements</th>
                                <th>Non retenus</th></tr></thead>
                            <tbody>
                                {fermetures.map(f => (
                                    <tr key={f.groupe} className={f.duree > 0 ? '' : 'sc-sans-objet'}>
                                        <td className="sc-gauche sc-nom" title={tip(nomGroupe(f.groupe))}>GF{f.groupe} {nomGroupe(f.groupe)}</td>
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
                </div>
                </Chapitre>
            )}

            {disposition && (
                <Chapitre tip={tip} titre="Points de repos bus" resume={resumeRepos} ouvert={ouverts.repos} basculer={basculer('repos')} validation={validation('repos')}>
                <div className="sc-associes sc-adaptatifs">
                    {reposBus.length > 0 ? (
                        <table className="sc-table">
                            <thead><tr><th>Groupe bus</th>
                                <th title={tip(`Dans les ${FENETRE_REPOS_BUS} dernières secondes du vert bus, à l'instant où le plus de groupes sont au vert`)}>Repos à</th>
                                <th>Groupes au vert</th>
                                <th title={tip("Temps passé dans la phase bus à l'instant du repos, moins 1")}>N</th>
                                <th>Condition</th></tr></thead>
                            <tbody>
                                {reposBus.map(r => (
                                    <tr key={r.groupe}>
                                        <td className="sc-gauche sc-nom" title={tip(nomGroupe(r.groupe))}>GF{r.groupe} {nomGroupe(r.groupe)}</td>
                                        <td>{r.instant} s</td>
                                        <td>{r.inclus.map(court).join(', ')}</td>
                                        <td>{r.n}</td>
                                        <td className="sc-gauche">{conditionRepos(r).micro}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="sc-attente">Aucun groupe avec un code trajet (DA) dans le plan.</p>}
                    <p className="sc-note">
                        « Appliquer le cycle » inscrit un point de repos par groupe à code trajet (« Att bus », « {DESCRIPTION_REPOS_BUS} maxi 10 secondes »),
                        en conservant son DA. Les variables sont indicées d'après le code trajet : pour T1, la condition utilise DA1 et TMAB1,
                        et « TMAB1 = 10 » est ajoutée au plan si elle manque. Les repos d'un passage précédent sont remplacés ; les autres ne
                        sont pas touchés.
                    </p>
                </div>
                </Chapitre>
            )}

            {avInscrits !== null && (
                        <p className="sc-note">
                            {avInscrits.length
                                ? `Inscrits : ${avInscrits.join(', ')}. Adaptez les conditions à la détection réelle et vérifiez dans l'onglet Simulation.`
                                : 'Aucune condition à inscrire.'}
                        </p>
                    )}
            {tablePleine && <p className="sc-alerte">La table est pleine (30 conditions) : certaines lignes n'ont pas été inscrites.</p>}
            </div>
            <div className="sc-pied">
            <label className="sc-nb" title={tip("Une bulle par phase, au milieu du vert de son groupe déterminant")}>
                <input type="checkbox" checked={remplirBulle} onChange={e => setRemplirBulle(e.target.checked)} />
                Modifier ou pré-remplir le phasage bulle
            </label>

            <div className="modal-actions">
                <button className="modal-btn modal-btn-secondary" onClick={onClose}>Fermer</button>
                <button className="modal-btn modal-btn-secondary" disabled={!complet || readOnly} onClick={() => appliquerChapitre('phases')}
                    title={tip("Garder ces groupes déterminants avec le plan de feu (ils servent aussi au phasage bulle)")}>
                    Enregistrer le phasage
                </button>
                <button className="modal-btn modal-btn-primary"
                    disabled={!calculable || resultat?.cycleSuggere == null || readOnly}
                    title={tip(['Règle la durée du cycle du plan',
                        aPlacer.length ? `place ${aPlacer.length} groupe${aPlacer.length > 1 ? 's' : ''} associé${aPlacer.length > 1 ? 's' : ''}` : '',
                        avUtiles.length || faUtiles.length || reposBus.length
                            ? `inscrit ${[...avUtiles.map(a => `AV${a.phase}`), ...faUtiles.map((_, k) => `FA${k + 1}`), ...reposBus.map(() => 'Att bus')].join(', ')}` : ''].filter(Boolean).join(', puis '))}
                    onClick={executerGlobal}>
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
        <Modal isOpen={isOpen} onClose={onClose} nonModale tooltipsEnabled={tooltipsEnabled} className="suggestion-cycle" overlayClassName="suggestion-cycle-overlay"
            title={titreSuggestionCycle(planName)}>
            {corps}
        </Modal>
    );
};

export default SuggestionCycleDialog;
