import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { toast } from '../utils/toast';
import TableauComparaisonCapacite from './TableauComparaisonCapacite';
import {
    PAR_PLAN, cleScenarioComparaison, colonnesComparaison, cellulesComparaison, groupesComparables,
    jeuRenseigne, planComparable
} from '../utils/comparaisonCapacite';
import { scenariosDuPlan } from '../simulation/scenarios';
import type { ActionMicro, Groupe, JeuTrafic, Matrice, PlanDeFeu } from '../types/projet';
import './CapacityComparison.css';

/**
 * Tableau comparatif de la capacité utilisée entre plans de feu et scénarios.
 *
 * - Une liste déroulante propose les plans de feu à cocher et, en retrait sous
 *   chacun, ses scénarios enregistrés. Un plan dont le jeu de trafic est vide
 *   est grisé, ses scénarios aussi.
 * - Le jeu de trafic : « Jeu associé à chaque PF », ou un jeu unique appliqué
 *   à tous, pour isoler l'effet du plan à trafic égal (tous les plans sont
 *   alors comparables).
 * - Groupes VL en lignes ; par colonne : Trafic, V.Utile (facultatif), Cap.U.
 *
 * Un plan s'évalue à ses valeurs nominales (vert et cycle propres, sans
 * micro-régulation) ; un scénario, sur le diagramme simulé de ses actions.
 */
const PER_PF = PAR_PLAN;

interface ContentSize {
    width: number;
    height: number;
}

interface CapacityComparisonProps {
    pfTabs?: PlanDeFeu[];
    groups?: Groupe[];
    trafficDatasets?: Record<string, JeuTrafic>;
    pfTrafficDatasetMap?: Record<string, string>;
    activeTrafficDataset?: string;
    trafficDatasetNames?: string[];
    selectedPfIds?: number[] | null;
    setSelectedPfIds?: (ids: number[]) => void;
    selectedScenarios?: string[];
    setSelectedScenarios?: (cles: string[]) => void;
    afficherVUtile?: boolean;
    setAfficherVUtile?: (afficher: boolean) => void;
    datasetChoice?: string;
    setDatasetChoice?: (choice: string) => void;
    activePFId?: number;
    cycleLength?: number;
    actionData?: ActionMicro[];
    conflictMatrix?: Matrice;
    onContentSize?: ((size: ContentSize) => void) | null;
}

const CapacityComparison = ({
    pfTabs = [],
    groups = [],
    trafficDatasets = {},
    pfTrafficDatasetMap = {},
    activeTrafficDataset = '',
    trafficDatasetNames = [],
    // Sélection contrôlée et persistée dans le projet (via App/useTrafficLight).
    // selectedPfIds null/absent = tous les PF cochés par défaut.
    selectedPfIds = null,
    setSelectedPfIds = () => {},
    selectedScenarios = [],
    setSelectedScenarios = () => {},
    afficherVUtile = true,
    setAfficherVUtile = () => {},
    datasetChoice = PER_PF,
    setDatasetChoice = () => {},
    activePFId = 0,
    cycleLength = 0,
    actionData = [],
    conflictMatrix = [],
    /* Appelée après chaque mise en page avec la taille NATURELLE du contenu.
       La fenêtre détachée s'y ajuste : elle était figée à 920 × 620 quel que
       soit le nombre de plans comparés, laissant la moitié de sa hauteur vide
       sous un tableau de six lignes. La mesure est faite ici parce qu'elle est
       le seul endroit qui connaisse la taille réelle — l'estimer depuis
       l'appelant demandait de recopier les règles de sélection des groupes, et
       la faire mesurer par la fenêtre elle-même dépendait de l'instant où elle
       regardait : selon que le contenu était rendu ou non, elle tombait juste
       ou pas du tout. */
    onContentSize = null
}: CapacityComparisonProps) => {
    const [exporting, setExporting] = useState(false);
    const tableRef = useRef<HTMLTableElement>(null);
    const racineRef = useRef<HTMLDivElement>(null);

    // Taille naturelle du contenu : du haut du premier bloc au bas du dernier,
    // rembourrage compris. On ne peut pas prendre la hauteur du conteneur, qui
    // vaut celle de la fenêtre ; ni la somme des enfants, qui oublierait les
    // marges entre eux.
    useLayoutEffect(() => {
        if (!onContentSize) return;
        const racine = racineRef.current;
        if (!racine || racine.children.length === 0) return;
        const style = window.getComputedStyle(racine);
        const premier = racine.children[0].getBoundingClientRect();
        const dernier = racine.children[racine.children.length - 1].getBoundingClientRect();
        const hauteur = (dernier.bottom - premier.top)
            + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
        // La largeur ne se lit pas non plus sur le conteneur : il occupe la
        // fenêtre, et rendrait toujours la largeur courante. C'est le plus
        // large de ses blocs qui commande — le tableau, le plus souvent.
        const largeur = Math.max(...Array.from(racine.children, el => el.scrollWidth))
            + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
        if (hauteur > 0) onContentSize({
            width: Math.ceil(largeur),
            height: Math.ceil(hauteur)
        });
    });

    const allPfIds = useMemo(() => pfTabs.map(pf => pf.id), [pfTabs]);
    // Repli « tous cochés » quand aucune sélection n'est enregistrée.
    const effectiveSelectedIds = Array.isArray(selectedPfIds) ? selectedPfIds : allPfIds;
    const effectiveDatasetChoice = datasetChoice || PER_PF;
    const trafic = useMemo(() => ({ trafficDatasets, pfTrafficDatasetMap, activeTrafficDataset, trafficDatasetNames }),
        [trafficDatasets, pfTrafficDatasetMap, activeTrafficDataset, trafficDatasetNames]);

    const vlGroups = useMemo(() => groupesComparables(groups), [groups]);

    const togglePf = (id: number) => {
        const base = Array.isArray(selectedPfIds) ? selectedPfIds : allPfIds;
        setSelectedPfIds(base.includes(id) ? base.filter(x => x !== id) : [...base, id]);
    };
    const toggleScenario = (cle: string) =>
        setSelectedScenarios(selectedScenarios.includes(cle) ? selectedScenarios.filter(x => x !== cle) : [...selectedScenarios, cle]);

    const colonnes = useMemo(() => colonnesComparaison(
        pfTabs,
        { pfIds: selectedPfIds, scenarios: selectedScenarios, choixJeu: effectiveDatasetChoice },
        trafic,
        { activePFId, groups, cycleLength, actionData },
        conflictMatrix
    ), [pfTabs, selectedPfIds, selectedScenarios, effectiveDatasetChoice, trafic, activePFId, groups, cycleLength, actionData, conflictMatrix]);
    const cellules = useMemo(() => cellulesComparaison(colonnes, vlGroups, trafic), [colonnes, vlGroups, trafic]);

    // Liste déroulante des plans et scénarios : se ferme au clic en dehors
    // (dans le document qui l'affiche, fenêtre détachée comprise).
    const [listeOuverte, setListeOuverte] = useState(false);
    const listeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!listeOuverte) return;
        const doc = listeRef.current?.ownerDocument ?? document;
        const fermer = (e: MouseEvent) => {
            if (listeRef.current && !listeRef.current.contains(e.target as Node)) setListeOuverte(false);
        };
        doc.addEventListener('mousedown', fermer);
        return () => doc.removeEventListener('mousedown', fermer);
    }, [listeOuverte]);
    const nbCoches = colonnes.length;

    const handleExport = async () => {
        if (!tableRef.current) return;
        setExporting(true);
        try {
            const { exportElementAsPNG } = await import('../utils/exportHelpers');
            // Fond pris sur le document propriétaire du tableau (fenêtre détachée
            // le cas échéant), pas forcément le document principal.
            const ownerBody = tableRef.current.ownerDocument?.body || document.body;
            const bg = getComputedStyle(ownerBody).backgroundColor || '#1e1e1e';
            const res = await exportElementAsPNG(tableRef.current, 'comparaison_capacite', {
                backgroundColor: bg,
                // Neutralise le sticky des en-têtes dans le clone de capture.
                // `relative` (et non `static`) pour conserver le bloc englobant
                // des libellés en diagonale positionnés en absolu dans le coin.
                onclone: (doc: Document) => {
                    doc.querySelectorAll<HTMLElement>('.cc-table th, .cc-col-group').forEach(el => {
                        el.style.position = 'relative';
                        el.style.top = 'auto';
                        el.style.left = 'auto';
                    });
                }
            });
            toast.success(res.clipboardSuccess
                ? 'Tableau exporté (PNG téléchargé + copié dans le presse-papiers)'
                : 'Tableau exporté (PNG téléchargé)');
        } catch (e) {
            toast.error('Échec de l\'export : ' + e.message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="capacity-comparison" ref={racineRef}>
            {/* Sélection des PF */}
            <div className="cc-controls">
                <div className="cc-pf-select" ref={listeRef}>
                    <span className="cc-controls-label">Plans de feu et scénarios à comparer :</span>
                    <button type="button" className="cc-pf-liste-bouton" aria-expanded={listeOuverte}
                        onClick={() => setListeOuverte(o => !o)}>
                        {nbCoches} colonne{nbCoches > 1 ? 's' : ''} comparée{nbCoches > 1 ? 's' : ''} ▾
                    </button>
                    {listeOuverte && (
                        <div className="cc-pf-liste" role="group" aria-label="Plans de feu et scénarios à comparer">
                            {pfTabs.map(pf => {
                                const comparable = planComparable(pf, effectiveDatasetChoice, trafic);
                                const titre = comparable ? undefined : 'Aucune donnée de trafic pour ce plan de feu';
                                return (
                                    <div key={pf.id} className={`cc-pf-groupe${comparable ? '' : ' cc-indisponible'}`} title={titre}>
                                        <label className="cc-pf-checkbox">
                                            <input type="checkbox" disabled={!comparable}
                                                checked={comparable && effectiveSelectedIds.includes(pf.id)}
                                                onChange={() => togglePf(pf.id)} />
                                            <span>{pf.name}</span>
                                        </label>
                                        {scenariosDuPlan(pf).map(sc => {
                                            const cle = cleScenarioComparaison(pf.id, sc.nom);
                                            return (
                                                <label key={cle} className="cc-pf-checkbox cc-scenario-checkbox">
                                                    <input type="checkbox" disabled={!comparable}
                                                        checked={comparable && selectedScenarios.includes(cle)}
                                                        onChange={() => toggleScenario(cle)} />
                                                    <span>{sc.nom}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="cc-dataset-select">
                    <span className="cc-controls-label">Jeu de données trafic :</span>
                    <select value={effectiveDatasetChoice} onChange={(e) => setDatasetChoice(e.target.value)}>
                        <option value={PER_PF}>Jeu associé à chaque PF</option>
                        {trafficDatasetNames.map(name => {
                            const has = jeuRenseigne(name, trafic);
                            return (
                                <option key={name} value={name} disabled={!has}>
                                    {name}{has ? '' : ' (aucune donnée)'}
                                </option>
                            );
                        })}
                    </select>
                </div>
                <label className="cc-pf-checkbox cc-option-vutile">
                    <input type="checkbox" checked={afficherVUtile} onChange={(e) => setAfficherVUtile(e.target.checked)} />
                    <span>Afficher le V.Utile</span>
                </label>
                <div className="cc-export">
                    <button
                        className="cc-export-btn"
                        onClick={handleExport}
                        disabled={exporting || colonnes.length === 0 || vlGroups.length === 0}
                        title="Exporter le tableau en image PNG (téléchargée et copiée dans le presse-papiers) pour l'intégrer dans un document"
                    >
                        {exporting ? 'Export…' : 'Exporter (PNG)'}
                    </button>
                </div>
            </div>

            {colonnes.length === 0 ? (
                <p className="cc-empty">Cochez au moins un plan de feu ou un scénario disposant de données de trafic.</p>
            ) : vlGroups.length === 0 ? (
                <p className="cc-empty">Aucun groupe VL à comparer dans ce projet.</p>
            ) : (
                /* data-fit-scroll : repère lu par usePopupWindow, qui
                   agrandit la fenêtre du débordement réellement mesuré. */
                <div className="cc-table-scroll" data-fit-scroll>
                    <TableauComparaisonCapacite colonnes={colonnes} cellules={cellules} groupes={vlGroups}
                        afficherVUtile={afficherVUtile} tableRef={tableRef} />
                </div>
            )}

            <div className="cc-note">
                <p className="cc-note-portee">
                    Plans de feu : valeurs nominales — vert et cycle propres —, hors actions de
                    micro-régulation. Scénarios : diagramme simulé de leurs actions.
                </p>
                <p className="cc-note-couleurs">
                    Code couleur : <span className="capacity-green">&lt; 76 %</span> ·
                    <span className="capacity-orange"> ≤ 85 %</span> ·
                    <span className="capacity-red"> ≤ 100 %</span> ·
                    <span className="capacity-black"> &gt; 100 %</span>
                </p>
            </div>
        </div>
    );
};

export default CapacityComparison;
