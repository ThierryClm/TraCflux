import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { SetStateAction } from 'react';
import {
    DEFAULT_CYCLE,
    MAX_GROUPS,
    createEmptyActionData,
    buildDiagramFromGroups,
    createEmptyPF,
    ensurePFIntegrity,
    cycleDuPlanActif
} from '../utils/pfHelpers';
import { isExampleSession } from '../utils/exampleMode';
import { isReadOnlyStamped } from '../utils/dossierLock';
import { toast } from '../utils/toast';
import { entier } from '../utils/entier';
import type { AlertFunction } from '../components/ConfirmProvider';
import type { LargeursColonnes } from '../components/ActionTable';
import { safeLocalStorage, ensureLocalStorageSpace } from './trafficLight/stockageLocal';
import { DEFAULT_PROJECT_PROPERTIES } from './trafficLight/types';
import { useEtatJeuxTrafic, useNomsJeuxTrafic, useOperationsJeuxTrafic } from './trafficLight/useJeuxTrafic';
import { useReglagesPlanActif } from './trafficLight/useReglagesPlanActif';
import { useGestionPlans } from './trafficLight/useGestionPlans';
import { useScenariosSimulation } from './trafficLight/useScenariosSimulation';
import { useAnnulerRetablir } from './trafficLight/useAnnulerRetablir';
import { calculerConflits } from './trafficLight/calculConflits';
import { mettreProjetEnTete, listerProjetsCache, lireProjetCache, supprimerProjetCache, ecrireProjetCache } from './trafficLight/cacheProjets';
import { intervertMinimal, migrerGroupes, matriceDuCache, plansDuCache, matriceDuFichier, largeursColonnesBornees } from './trafficLight/lectureProjet';
import type {
    EtatHistorique, EtatProjet, JeuxTrafic, ParametresGroupe,
    ProjetEnregistre, ProprietesProjet, UseTrafficLightOptions
} from './trafficLight/types';
export type {
    ChampsProjet, EtatProjet, JeuxTrafic, ParametresGroupe, ProjetEnregistre,
    ProprietesProjet, SauvegardeCache, UseTrafficLightOptions
} from './trafficLight/types';
import type {
    ActionMicro,
    CaseMatrice,
    FlecheCarrefour,
    Groupe,
    JeuTrafic,
    LienExterne,
    Matrice,
    PlanDeFeu,
    Projet,
    TypeGroupe
} from '../types/projet';

/** Champs d'une condition qui désignent un groupe de feu par son numéro. */
const CHAMPS_GF: ('gf' | 'plage1' | 'plage2' | 'actGf1' | 'actGf1Gf2' | 'actGf1Gf3' | 'actGf1Gf4')[] = ['gf', 'plage1', 'plage2', 'actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'];


// L'échec d'autosave n'est signalé qu'une fois : il se rejoue toutes les deux
// secondes d'inactivité, et une alerte répétée serait vite ignorée.
let echecCacheSignale = false;

export { TRAFFIC_DATASETS } from './trafficLight/useJeuxTrafic';

/**
 * @param champsProjetRef  Réf vers { lire, ecrire } : des champs de projet
 *   portés par d'autres modules et qui doivent voyager avec le dossier — les
 *   cases à cocher de l'impression, par exemple. C'est une réf parce que ces
 *   modules sont créés APRÈS celui-ci ; elle n'est lue qu'au moment d'enregistrer.
 */
export const useTrafficLight = ({ askConfirm, showAlert, champsProjetRef }: UseTrafficLightOptions = {}) => {
    // Fallback : si showAlert n'est pas fourni, on retombe sur window.alert
    const alertFn: AlertFunction = showAlert || (({ message }) => { window.alert(message); return Promise.resolve(); });
    const [intersectionName, setIntersectionName] = useState("Nouveau Carrefour");
    const [cycleLength, setCycleLength] = useState<number>(DEFAULT_CYCLE);
    const [dependencyGap, setDependencyGap] = useState(20);
    const [biCarrefourSeparator, setBiCarrefourSeparator] = useState<number | null>(null);
    const [matricesLocked, setMatricesLocked] = useState(false);
    // Dossier en lecture seule (ouvert depuis un export « lecture seule »).
    // Verrou de CONVENTION : bloque la persistance (sauvegarde + autosave) et,
    // via l'UI, les saisies d'entrée. Non inviolable (cf. utils/dossierLock).
    const [dossierReadOnly, setDossierReadOnly] = useState(false);
    const dossierReadOnlyRef = useRef(false);
    dossierReadOnlyRef.current = dossierReadOnly;
    // Lecture seule PAR PF : vrai quand le PF actif porte readOnly (PF importés
    // « _ext » verrouillés). Le .current est mis à jour après la déclaration de
    // pfTabs/activePFId ; la réf existe ici pour être capturée par les mutateurs.
    const activePfReadOnlyRef = useRef(false);
    // Garde d'édition combiné : dossier entier OU PF actif verrouillé.
    const isEditLocked = () => dossierReadOnlyRef.current || activePfReadOnlyRef.current;
    // Largeurs (px) ajustables des colonnes Description et Action_Micro du
    // tableau de micro-régulation. Reglage unique par projet, sauvegarde.
    // Bornes a la restauration : Desc 100-350, Micro 300-700, Abrv 38-75.
    const [actionColWidths, setActionColWidths] = useState<LargeursColonnes>({ description: 160, micro: 420, abrv: 38 });
    const [externalLinks, setExternalLinks] = useState<LienExterne[]>([]);
    // Sélection mémorisée du comparateur de capacité (fenêtre « Comparer la
    // capacité des plans de feu ») : liste d'id de PF cochés (null = tous par
    // défaut) et jeu de trafic choisi ('__per_pf__' = jeu associé à chaque PF).
    const [capacityCompareSelection, setCapacityCompareSelection] = useState<number[] | null>(null);
    const [capacityCompareDataset, setCapacityCompareDataset] = useState('__per_pf__');
    const [projectProperties, setProjectProperties] = useState<ProprietesProjet>(() => {
        try {
            const saved = safeLocalStorage.getItem('trafficProjectProperties');
            if (saved) {
                const parsed = { ...DEFAULT_PROJECT_PROPERTIES, ...JSON.parse(saved) };
                // Nettoyer les anciennes URLs blob (invalides après rechargement)
                if (parsed.logoMoa && !parsed.logoMoa.startsWith('data:')) parsed.logoMoa = '';
                if (parsed.logoMoe && !parsed.logoMoe.startsWith('data:')) parsed.logoMoe = '';
                return parsed;
            }
            return { ...DEFAULT_PROJECT_PROPERTIES };
        } catch { return { ...DEFAULT_PROJECT_PROPERTIES }; }
    });
    const updateProjectProperty = useCallback(<K extends keyof ProprietesProjet>(field: K, value: ProprietesProjet[K]) => {
        if (isEditLocked()) return;
        setProjectProperties(prev => ({ ...prev, [field]: value }));
    }, []);
    // Registres globaux de l'application (partagés entre projets)
    const [appCommunes, setAppCommunes] = useState<string[]>(() => {
        try {
            const saved = safeLocalStorage.getItem('trafficAppCommunes');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [appMoaLogos, setAppMoaLogos] = useState<Record<string, string>>(() => {
        try {
            const saved = safeLocalStorage.getItem('trafficAppMoaLogos');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });
    const [appMoeLogos, setAppMoeLogos] = useState<Record<string, string>>(() => {
        try {
            const saved = safeLocalStorage.getItem('trafficAppMoeLogos');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });
    // Nom du projet (clé de sauvegarde), indépendant du nom du carrefour
    const [projectName, setProjectName] = useState<string | null>(null);
    const currentProjectNameRef = useRef<string | null>(null);
    const [globalTime, setGlobalTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // History for undo/redo functionality
    const [history, setHistory] = useState<EtatHistorique[]>([]);
    const [redoHistory, setRedoHistory] = useState<EtatHistorique[]>([]);
    const isUndoing = useRef(false);
    const isRedoing = useRef(false);
    const isDragging = useRef(false);

    // Groups State
    const createGroup = (id: number): Groupe => ({
        id,
        name: `Groupe ${id}`, // Default name
        type: 'VL', // VL, TC, Cycliste, Piéton
        courant: '', // Identification du mouvement de trafic (TD, TàD, TàG, etc.)
        minGreen: 6,
        durations: { green: 0, orange: 3, red: 0 }, // New groups start with no green duration
        offset: 0, // New groups start at 0
        da: '', // DA field (2 characters)
        phaseFlag: '', // '' | 'a' (aiguillage) | 'e' (escamotage) - grays out conflicts
        comment: '', // Comment field (50 characters max, not printable)
        commentColor: '', // Comment color: 'green', 'red', or '' (default)
        // Traffic Engineering Props
        trafficStream: '', // Courant de circulation (legacy)
        laneCoef: 1, // Coef voie
        trafficVol: 0, // Trafic
        effectiveGreen: 0, // Vert utile
        usedCapacity: 0, // Capacité utilisée
        delay: 0, // Retard
        queueLength: 0, // Ile d'attente
    });

    const [groups, setGroups] = useState<Groupe[]>(() => Array.from({ length: 5 }, (_, i) => createGroup(i + 1)));

    // Matrix: Size depends on number of groups.
    // We store as a URL-like generic object or always resize.
    // Let's keep it as 2D array, resizing when groups change.
    const [conflictMatrix, setConflictMatrix] = useState<Matrice>(() => Array.from({ length: 5 }, () => Array(5).fill('')));

    const setGroupCountInternal = (count: number | string) => {
        const newCount = Math.min(MAX_GROUPS, Math.max(1, entier(count) || 1));

        setGroups(prev => {
            const oldCount = prev.length;

            // Update action data when increasing group count
            if (newCount > oldCount) {
                setActionData(currentData => {
                    return currentData.map(row => {
                        const updatedRow = { ...row };
                        // Update plage1, plage2 if they equal old count
                        if (entier(row.plage1) === oldCount) {
                            updatedRow.plage1 = newCount.toString();
                        }
                        if (entier(row.plage2) === oldCount) {
                            updatedRow.plage2 = newCount.toString();
                        }
                        // Update actGf1, actGf1Gf2, actGf1Gf3, actGf1Gf4 if they equal old count
                        if (entier(row.actGf1?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1 = newCount.toString();
                        }
                        if (entier(row.actGf1Gf2?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1Gf2 = newCount.toString();
                        }
                        if (entier(row.actGf1Gf3?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1Gf3 = newCount.toString();
                        }
                        if (entier(row.actGf1Gf4?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1Gf4 = newCount.toString();
                        }
                        return updatedRow;
                    });
                });

                // Add groups
                const added = Array.from({ length: newCount - oldCount }, (_, i) => createGroup(oldCount + i + 1));
                return [...prev, ...added];
            } else if (newCount < prev.length) {
                // Remove groups
                return prev.slice(0, newCount);
            }
            return prev;
        });

        setConflictMatrix(prev => {
            const currentSize = prev.length;
            if (newCount === currentSize) return prev;

            // Resize matrix
            const newMatrix = Array.from({ length: newCount }, (_, r) => {
                const row: CaseMatrice[] = new Array(newCount).fill('');
                // Copy existing values
                for (let c = 0; c < newCount; c++) {
                    if (r < currentSize && c < currentSize) {
                        row[c] = prev[r][c];
                    }
                }
                return row;
            });
            return newMatrix;
        });
    };

    // Swap group data and matrix, but keep GF IDs in place (G1 stays G1, G2 stays G2)
    const moveGroup = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === groups.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // GF numbers are 1-based (index + 1)
        const gfA = index + 1;
        const gfB = targetIndex + 1;

        // 1. Swap group DATA (but keep IDs in place)
        setGroups(currentGroups => {
            const newGroups = [...currentGroups];
            const groupA = newGroups[index];
            const groupB = newGroups[targetIndex];

            // Swap all properties except ID
            newGroups[index] = {
                ...groupB,
                id: groupA.id  // Keep original ID
            };
            newGroups[targetIndex] = {
                ...groupA,
                id: groupB.id  // Keep original ID
            };

            return newGroups;
        });

        // 2. Swap matrix rows and columns
        setConflictMatrix(currentMatrix => {
            if (!currentMatrix || currentMatrix.length === 0) return currentMatrix;

            const newMatrix = currentMatrix.map(row => [...row]);

            // Swap Rows
            const tempRow = newMatrix[index];
            newMatrix[index] = newMatrix[targetIndex];
            newMatrix[targetIndex] = tempRow;

            // Swap Cols
            for (let r = 0; r < newMatrix.length; r++) {
                const row = newMatrix[r];
                const tempVal = row[index];
                row[index] = row[targetIndex];
                row[targetIndex] = tempVal;
            }
            return newMatrix;
        });

        // 3. Swap GF references in ActionTable
        // Permute les références aux deux groupes dans une condition.
        const permuterGf = (row: ActionMicro): ActionMicro => {
            const newRow = { ...row };
            CHAMPS_GF.forEach(field => {
                const val = entier(newRow[field]);
                if (val === gfA) {
                    newRow[field] = gfB.toString();
                } else if (val === gfB) {
                    newRow[field] = gfA.toString();
                }
            });
            return newRow;
        };

        setActionData(currentData => currentData.map(permuterGf));

        // 4. Swap diagram data in ALL PF tabs (not just the active one)
        setPfTabs(currentTabs => {
            return currentTabs.map(pf => {
                const newPf = { ...pf };

                // Swap diagram data if it exists
                if (newPf.diagram && newPf.diagram.length > 0) {
                    const newDiagram = [...newPf.diagram];
                    const entryA = newDiagram.find(d => d.groupId === gfA);
                    const entryB = newDiagram.find(d => d.groupId === gfB);

                    if (entryA && entryB) {
                        // Swap all properties except groupId
                        const tempOffset = entryA.offset;
                        const tempGreenDuration = entryA.greenDuration;
                        const tempDa = entryA.da;
                        const tempComment = entryA.comment;
                        const tempCommentColor = entryA.commentColor;

                        entryA.offset = entryB.offset;
                        entryA.greenDuration = entryB.greenDuration;
                        entryA.da = entryB.da;
                        entryA.comment = entryB.comment;
                        entryA.commentColor = entryB.commentColor;

                        entryB.offset = tempOffset;
                        entryB.greenDuration = tempGreenDuration;
                        entryB.da = tempDa;
                        entryB.comment = tempComment;
                        entryB.commentColor = tempCommentColor;
                    }
                    newPf.diagram = newDiagram;
                }

                // Swap conflict matrix in PF if it exists
                if (newPf.conflictMatrix && newPf.conflictMatrix.length > 0) {
                    const newMatrix = newPf.conflictMatrix.map(row => [...row]);

                    // Swap Rows
                    const tempRow = newMatrix[index];
                    newMatrix[index] = newMatrix[targetIndex];
                    newMatrix[targetIndex] = tempRow;

                    // Swap Cols
                    for (let r = 0; r < newMatrix.length; r++) {
                        const row = newMatrix[r];
                        const tempVal = row[index];
                        row[index] = row[targetIndex];
                        row[targetIndex] = tempVal;
                    }
                    newPf.conflictMatrix = newMatrix;
                }

                // Swap GF references in action data if it exists
                if (newPf.data && newPf.data.length > 0) {
                    newPf.data = newPf.data.map(permuterGf);
                }

                return newPf;
            });
        });
    };

    // Move a group to a new position (after another group)
    // sourceId: the ID of the group to move
    // afterId: the ID of the group after which to insert (0 = insert at beginning)
    const moveGroupToPosition = (sourceId: number, afterId: number) => {
        const sourceIndex = groups.findIndex(g => g.id === sourceId);
        if (sourceIndex === -1) return;

        // Calculate target index
        let targetIndex;
        if (afterId === 0) {
            targetIndex = 0; // Insert at beginning
        } else {
            const afterIndex = groups.findIndex(g => g.id === afterId);
            if (afterIndex === -1) return;
            targetIndex = afterIndex + 1;
        }

        // Adjust target if source is before target
        if (sourceIndex < targetIndex) {
            targetIndex--;
        }

        if (sourceIndex === targetIndex) return; // No change needed

        // Create mapping from old positions to new positions
        const oldToNew: Record<number, number> = {};
        const newToOld: Record<number, number> = {};

        // Build the new order of groups
        const newGroups = [...groups];
        const [movedGroup] = newGroups.splice(sourceIndex, 1);
        newGroups.splice(targetIndex, 0, movedGroup);

        // Create position mappings (1-based GF numbers)
        for (let i = 0; i < groups.length; i++) {
            const oldGf = i + 1;
            const group = groups[i];
            const newIndex = newGroups.findIndex(g => g.id === group.id);
            const newGf = newIndex + 1;
            oldToNew[oldGf] = newGf;
            newToOld[newGf] = oldGf;
        }

        // 1. Reorder groups and reassign IDs to be sequential
        setGroups(() => {
            return newGroups.map((g, idx) => ({
                ...g,
                id: idx + 1
            }));
        });

        // 2. Reorder matrix rows and columns
        setConflictMatrix(currentMatrix => {
            if (!currentMatrix || currentMatrix.length === 0) return currentMatrix;

            const size = currentMatrix.length;
            const newMatrix: Matrice = Array(size).fill(null).map(() => Array(size).fill(0));

            // Copy values to new positions
            for (let oldRow = 0; oldRow < size; oldRow++) {
                for (let oldCol = 0; oldCol < size; oldCol++) {
                    const newRow = oldToNew[oldRow + 1] - 1;
                    const newCol = oldToNew[oldCol + 1] - 1;
                    if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                        newMatrix[newRow][newCol] = currentMatrix[oldRow][oldCol];
                    }
                }
            }

            return newMatrix;
        });

        // 3. Update GF references in ActionTable
        const size = groups.length;

        // Renumérote les références aux groupes dans une condition.
        const renumeroterGf = (row: ActionMicro): ActionMicro => {
            const newRow = { ...row };
            CHAMPS_GF.forEach(field => {
                const val = entier(newRow[field]);
                if (!isNaN(val) && val > 0 && val <= size) {
                    newRow[field] = oldToNew[val].toString();
                }
            });
            return newRow;
        };

        // Remap active PF tab data first
        setActionData(currentData => currentData.map(renumeroterGf));

        // 4. Update ALL PF tabs with reordered data
        setPfTabs(currentTabs => {
            return currentTabs.map(pf => {
                const newPf = { ...pf };

                // Reorder diagram data if it exists
                if (newPf.diagram && newPf.diagram.length > 0) {
                    newPf.diagram = newPf.diagram.map(entry => ({
                        ...entry,
                        groupId: oldToNew[entry.groupId] || entry.groupId
                    }));
                }

                // Reorder conflict matrix in PF if it exists
                if (newPf.conflictMatrix && newPf.conflictMatrix.length > 0) {
                    const pfSize = newPf.conflictMatrix.length;
                    const newMatrix: Matrice = Array(pfSize).fill(null).map(() => Array(pfSize).fill(''));
                    const source = newPf.conflictMatrix;

                    for (let oldRow = 0; oldRow < pfSize; oldRow++) {
                        for (let oldCol = 0; oldCol < pfSize; oldCol++) {
                            const newRow = oldToNew[oldRow + 1] - 1;
                            const newCol = oldToNew[oldCol + 1] - 1;
                            if (newRow >= 0 && newRow < pfSize && newCol >= 0 && newCol < pfSize) {
                                newMatrix[newRow][newCol] = source[oldRow][oldCol];
                            }
                        }
                    }
                    newPf.conflictMatrix = newMatrix;
                }

                // Update GF references in action data for non-active tabs
                // (active tab already handled by setActionData above)
                if (pf.id !== activePFId && newPf.data && newPf.data.length > 0) {
                    newPf.data = newPf.data.map(renumeroterGf);
                }

                return newPf;
            });
        });

        // 5. Reorder traffic datasets (keyed by groupId)
        setTrafficDatasets(currentDatasets => {
            const newDatasets: JeuxTrafic = {};
            Object.keys(currentDatasets).forEach(datasetKey => {
                const dataset = currentDatasets[datasetKey];
                const newDataset: JeuTrafic = {};
                Object.keys(dataset).forEach(oldGroupId => {
                    const oldId = entier(oldGroupId);
                    const newId = oldToNew[oldId];
                    if (newId) {
                        newDataset[newId] = dataset[oldGroupId];
                    }
                });
                newDatasets[datasetKey] = newDataset;
            });
            return newDatasets;
        });
    };

    const getGroupState = useCallback((group: Groupe, time: number) => {
        const { durations, offset } = group;
        const totalDuration = cycleLength;
        const cycleTime = (time + offset) % totalDuration;

        if (cycleTime < durations.green) {
            return { currentPhase: 'green' };
        } else if (cycleTime < durations.green + durations.orange) {
            return { currentPhase: 'orange' };
        } else {
            return { currentPhase: 'red' };
        }
    }, [cycleLength]);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | undefined;
        if (isPlaying) {
            const step = 50;
            intervalId = setInterval(() => {
                setGlobalTime(prev => prev + (step / 1000));
            }, step);
        }
        return () => clearInterval(intervalId);
    }, [isPlaying]);

    const reset = () => {
        setIsPlaying(false);
        setGlobalTime(0);
    };

    // Save/Load Logic - saveProject is defined later after all state declarations

    // Centralized ref for PF sync reset — filled in later when individual refs are created,
    // but callable from loadProject / loadFullState immediately.
    const pfSyncRefsResetRef = useRef<((newActivePFId: number) => void) | null>(null);
    const resetPfSyncRefs = (newActivePFId: number) => {
        if (pfSyncRefsResetRef.current) pfSyncRefsResetRef.current(newActivePFId);
    };

    // Flag to prevent auto-save during project loading
    const isLoadingProjectRef = useRef(false);

    const loadProject = (name: string): ProjetEnregistre | false => {
        // Set flag to prevent auto-save during loading
        isLoadingProjectRef.current = true;
        // Chargement depuis le cache = copie de travail de l'utilisateur : éditable.
        setDossierReadOnly(false);

        try {
            const raw = localStorage.getItem(`traffic_project_${name}`);
            if (!raw) {
                isLoadingProjectRef.current = false;
                return false;
            }
            const data: ProjetEnregistre = JSON.parse(raw);

            // Mémoriser le nom du projet (clé de sauvegarde)
            currentProjectNameRef.current = name;
            setProjectName(name);
            // Restaurer le nom du carrefour depuis les données (indépendant du nom du projet)
            if (data.intersectionName) setIntersectionName(data.intersectionName);

            // Migrate and validate groups structure for old projects
            if (data.groups) {
                const migratedGroups = migrerGroupes(data.groups);
                setGroups(migratedGroups);
            }

            // Le cycle du PLAN ACTIF fait foi, pas celui du projet : cf.
            // cycleDuPlanActif. Prendre celui du projet faisait écraser le
            // cycle du plan par la recopie qui suit le chargement.
            setCycleLength(cycleDuPlanActif(data, DEFAULT_CYCLE));

            // Ensure conflict matrix matches group count
            const matriceLue = matriceDuCache(data);
            if (matriceLue) setConflictMatrix(matriceLue);
            // Load action table data (pfTabs)
            const plansLus = plansDuCache(data);
            if (plansLus) {
                setPfTabs(plansLus.pfTabs);
                if (plansLus.activePFId) setActivePFIdRaw(plansLus.activePFId);
            }

            // Load intersection image and arrows
            if (data.intersectionImage !== undefined) {
                setIntersectionImage(data.intersectionImage);
            }
            if (data.intersectionArrows) {
                setIntersectionArrows(data.intersectionArrows);
            }
            if (data.imageBrightness !== undefined) {
                setImageBrightness(data.imageBrightness);
            } else {
                setImageBrightness(100);
            }
            if (data.imageContrast !== undefined) {
                setImageContrast(data.imageContrast);
            } else {
                setImageContrast(100);
            }

            // Load traffic datasets
            if (data.trafficDatasets) {
                setTrafficDatasets(data.trafficDatasets);
            }
            if (data.activeTrafficDataset) {
                setActiveTrafficDataset(data.activeTrafficDataset);
            }
            setCustomTrafficDatasetNames(data.customTrafficDatasetNames || []);
            setPfTrafficDatasetMap(data.pfTrafficDatasetMap || {});

            // Load dependency gap (default to 20 if not present)
            setDependencyGap(data.dependencyGap !== undefined ? data.dependencyGap : 20);
            setBiCarrefourSeparator(data.biCarrefourSeparator !== undefined ? data.biCarrefourSeparator : null);
            setProjectProperties(data.projectProperties ? { ...DEFAULT_PROJECT_PROPERTIES, ...data.projectProperties } : { ...DEFAULT_PROJECT_PROPERTIES });

            // Champs alignés sur loadFullState : sans ça, un projet rechargé
            // depuis la liste (cache) perdait liens externes, sélection du
            // comparateur, verrou des matrices et largeurs de colonnes.
            setCapacityCompareSelection(Array.isArray(data.capacityCompareSelection) ? data.capacityCompareSelection : null);
            setCapacityCompareDataset(data.capacityCompareDataset || '__per_pf__');
            setMatricesLocked(data.matricesLocked === true);
            setActionColWidths(largeursColonnesBornees(data.actionColWidths));
            setExternalLinks(data.externalLinks && Array.isArray(data.externalLinks) ? data.externalLinks : []);

            // Rendre à leurs modules les champs qui ne vivent pas ici — les
            // cases d'impression du dossier, par exemple. getFullState les
            // écrit dans le cache comme dans le fichier, mais seul le lecteur
            // « fichier » (loadFullState) les restituait : relus depuis la
            // liste des projets, ils revenaient vides.
            champsProjetRef?.current?.ecrire?.(data);

            // Le verrou de chargement se lève en différé — le temps que React
            // pose l'état — mais les repères de synchronisation, eux, doivent
            // être remis À L'INSTANT.
            //
            // Sans cela, la recopie « groupes → PF actif » voyait l'ouverture
            // d'un projet comme un changement d'onglet : elle croyait devoir
            // sauver les modifications en cours dans le PF qu'elle croyait
            // quitter — celui qui était actif AVANT l'ouverture — et y écrivait
            // le diagramme et la durée de cycle du projet qu'on venait
            // d'ouvrir. Le plan de feu portant cet identifiant se retrouvait
            // avec le cycle d'un autre, sans le moindre avertissement.
            // C'est la même remise à zéro que fait loadFullState, à la même
            // place : pendant l'installation des données, pas trois secondes
            // après.
            const loadedActivePFId = data.activePFId || 1;
            resetPfSyncRefs(loadedActivePFId);

            // Reset simulation state when loading a project
            setSimulationEnabled(false);

            // Move project to top of the order list
            updateProjectOrder(name);

            // Le verrou de chargement se lève en différé, le temps que React
            // pose l'état. Il ne touche PLUS aux repères de synchronisation :
            // ceux-là sont remis à jour au-dessus, à l'instant du chargement.
            //
            // Les remettre ici aussi était un piège à retardement. Trois
            // secondes après l'ouverture, ce rappel réinstallait comme « plan
            // courant » celui qui était actif AU CHARGEMENT. Si l'utilisateur
            // avait changé d'onglet entre-temps — ce qui prend moins de trois
            // secondes — la recopie « diagramme → plan actif » croyait ensuite
            // être encore sur l'ancien plan : la première durée de cycle saisie
            // partait dans CE plan-là, tandis que celui qu'on avait sous les
            // yeux gardait la sienne. Le plan édité semblait refuser la valeur,
            // un autre la recevait en silence, et la réouverture révélait les
            // deux dégâts d'un coup.
            setTimeout(() => {
                isLoadingProjectRef.current = false;
            }, 3000);

            return data;
        } catch (e) {
            console.error("Load failed", e);
            isLoadingProjectRef.current = false;
            return false;
        }
    };

    // Cache des projets (trafficLight/cacheProjets). Fonctions d'appel
    // recréées à chaque rendu, comme avant le découpage : la liste des projets
    // se rafraîchit au même rythme dans les fenêtres qui en dépendent.
    const updateProjectOrder = (name: string) => mettreProjetEnTete(name);
    const getAllSaves = () => listerProjetsCache();
    // Get project data without applying to state (for green wave)
    const getProjectData = (name: string) => lireProjetCache(name);

    // Load full state (for duplication)
    const loadFullState = (state: EtatProjet) => {
        try {
            champsProjetRef?.current?.ecrire?.(state);
            // Dossier « lecture seule » : détecté depuis le marqueur du fichier.
            setDossierReadOnly(isReadOnlyStamped(state));
            // Mettre à jour le nom du projet (clé de sauvegarde / nom du fichier)
            // Utiliser state.projectName si fourni, sinon null
            const loadedProjectName = state.projectName || null;
            currentProjectNameRef.current = loadedProjectName;
            setProjectName(loadedProjectName);
            // Restaurer le nom du carrefour (indépendant du nom du projet)
            setIntersectionName(state.intersectionName || "Nouveau Carrefour");

            // Toujours mettre à jour les groupes (avec valeur par défaut si absent)
            if (state.groups && Array.isArray(state.groups) && state.groups.length > 0) {
                setGroups(state.groups);
            } else {
                // Réinitialiser avec 5 groupes par défaut
                setGroups(Array.from({ length: 5 }, (_, i) => createGroup(i + 1)));
            }

            // Toujours mettre à jour la durée du cycle — celle du plan actif,
            // qui fait foi (cf. cycleDuPlanActif).
            setCycleLength(cycleDuPlanActif(state, DEFAULT_CYCLE));

            // Mettre à jour la matrice de conflits
            setConflictMatrix(matriceDuFichier(state));

            // Handle new pfTabs format or old actionData format
            // All branches produce PFs with guaranteed complete structure
            if (state.pfTabs && Array.isArray(state.pfTabs) && state.pfTabs.length > 0) {
                setPfTabs(ensurePFIntegrity(state.pfTabs, state.groups, state.conflictMatrix, state.cycleLength));
                setActivePFIdRaw(state.activePFId || 1);
            } else if (state.actionData && Array.isArray(state.actionData)) {
                setPfTabs([createEmptyPF({
                    id: 1,
                    name: 'PF1',
                    data: state.actionData,
                    sourceGroups: state.groups,
                    conflictMatrix: state.conflictMatrix
                })]);
                setActivePFIdRaw(1);
            } else {
                setPfTabs([createEmptyPF({
                    id: 1,
                    name: 'PF1',
                    sourceGroups: state.groups,
                    conflictMatrix: state.conflictMatrix
                })]);
                setActivePFIdRaw(1);
            }

            // Load traffic datasets if provided
            if (state.trafficDatasets) {
                setTrafficDatasets(state.trafficDatasets);
            } else {
                // Réinitialiser les datasets de trafic
                setTrafficDatasets({});
            }
            // Load active traffic dataset
            if (state.activeTrafficDataset) {
                setActiveTrafficDataset(state.activeTrafficDataset);
            }
            setCustomTrafficDatasetNames(state.customTrafficDatasetNames || []);
            setPfTrafficDatasetMap(state.pfTrafficDatasetMap || {});

            // Sélection du comparateur de capacité (null/absent = tous par défaut)
            setCapacityCompareSelection(Array.isArray(state.capacityCompareSelection) ? state.capacityCompareSelection : null);
            setCapacityCompareDataset(state.capacityCompareDataset || '__per_pf__');

            // Load intersection image and arrows
            if (state.intersectionImage !== undefined) {
                setIntersectionImage(state.intersectionImage);
            } else {
                setIntersectionImage(null);
            }
            if (state.intersectionArrows !== undefined) {
                setIntersectionArrows(state.intersectionArrows);
            } else {
                setIntersectionArrows([]);
            }
            if (state.imageBrightness !== undefined) {
                setImageBrightness(state.imageBrightness);
            } else {
                setImageBrightness(100);
            }
            if (state.imageContrast !== undefined) {
                setImageContrast(state.imageContrast);
            } else {
                setImageContrast(100);
            }

            setProjectProperties(state.projectProperties ? { ...DEFAULT_PROJECT_PROPERTIES, ...state.projectProperties } : { ...DEFAULT_PROJECT_PROPERTIES });

            // Reset simulation state when loading full state
            setSimulationEnabled(false);

            // Reset dependency gap if provided
            if (state.dependencyGap !== undefined) {
                setDependencyGap(state.dependencyGap);
            }

            // Load bi-carrefour separator (always reset to null if not present)
            setBiCarrefourSeparator(state.biCarrefourSeparator !== undefined ? state.biCarrefourSeparator : null);

            // Load matrices locked state (reset to false if not present)
            setMatricesLocked(state.matricesLocked === true);

            // Largeurs colonnes micro-régulation : valeurs bornées, defaut
            // si absent/invalide.
            setActionColWidths(largeursColonnesBornees(state.actionColWidths));

            // Reset PF sync refs so forward/reverse sync start fresh
            resetPfSyncRefs(state.activePFId || 1);

            // Load external links
            if (state.externalLinks && Array.isArray(state.externalLinks)) {
                setExternalLinks(state.externalLinks);
            } else {
                setExternalLinks([]);
            }

            return true;
        } catch (e) {
            console.error("Load full state failed", e);
            return false;
        }
    };

    // Reset to a new empty project (8 groups, 75s cycle)
    const resetToNewProject = () => {
        setDossierReadOnly(false);
        // Reset project name and intersection name
        currentProjectNameRef.current = null;
        setProjectName(null);
        setIntersectionName("Nouveau Carrefour");

        // Reset to 8 groups with default cycle (type vide pour inviter à la saisie)
        const newGroups: Groupe[] = Array.from({ length: 8 }, (_, i) => ({ ...createGroup(i + 1), type: '' as TypeGroupe }));
        setGroups(newGroups);
        setCycleLength(DEFAULT_CYCLE);

        // Reset conflict matrix (8x8)
        setConflictMatrix(Array.from({ length: 8 }, () => Array(8).fill('')));

        // Reset to single empty PF tab (all fields guaranteed)
        setPfTabs([createEmptyPF({ id: 1, name: 'PF1', sourceGroups: newGroups, groupCount: 8 })]);
        setActivePFIdRaw(1);
        resetPfSyncRefs(1);

        // Reset traffic datasets
        setTrafficDatasets({});
        setActiveTrafficDataset('HPM');
        setCustomTrafficDatasetNames([]);
        setPfTrafficDatasetMap({});

        // Reset intersection image and arrows
        setIntersectionImage(null);
        setIntersectionArrows([]);

        // Reset dependency gap
        setDependencyGap(20);

        // Reset bi-carrefour
        setBiCarrefourSeparator(null);

        // Reset largeurs colonnes micro-régulation aux valeurs par défaut
        setActionColWidths({ description: 160, micro: 420, abrv: 38 });

        // Reset external links
        setExternalLinks([]);

        // Reset sélection du comparateur de capacité (tous cochés par défaut)
        setCapacityCompareSelection(null);
        setCapacityCompareDataset('__per_pf__');

        // Reset project properties
        setProjectProperties({ ...DEFAULT_PROJECT_PROPERTIES, dateCreation: new Date().toISOString().split('T')[0] });

        // Reset simulation state
        setSimulationEnabled(false);

        // Clear history
        setHistory([]);
        setRedoHistory([]);

        return true;
    };

    // Get full state (for saving/duplication)
    const getFullState = () => ({
        projectName,
        intersectionName,
        groups,
        cycleLength,
        conflictMatrix,
        pfTabs,
        activePFId,
        intersectionImage,
        intersectionArrows,
        imageBrightness,
        imageContrast,
        trafficDatasets,
        activeTrafficDataset,
        customTrafficDatasetNames,
        pfTrafficDatasetMap,
        dependencyGap,
        biCarrefourSeparator,
        matricesLocked,
        actionColWidths,
        externalLinks,
        capacityCompareSelection,
        capacityCompareDataset,
        projectProperties,
        // Champs de projet portés par d'autres modules (cf. champsProjetRef).
        ...champsProjetRef?.current?.lire?.()
        // L'onglet Simulation ouvert ou non ne s'enregistre pas : c'est un état
        // de session. Le SCÉNARIO, lui — son nom et les actions cochées — voyage
        // avec son plan de feu, dans pfTabs.
    });

    // Réf toujours à jour vers le sérialiseur canonique. Source UNIQUE pour
    // l'autosave et la sauvegarde explicite : évite les fermetures périmées
    // (certains champs manquaient aux deps) et les divergences de payload qui
    // faisaient perdre customTrafficDatasetNames / pfTrafficDatasetMap /
    // externalLinks lors d'un aller-retour par le cache localStorage.
    const getFullStateRef = useRef(getFullState);
    getFullStateRef.current = getFullState;

    const deleteSave = (name: string) => supprimerProjetCache(name);

    // Multiple PF (Plans de Feux) support
    const [pfTabs, setPfTabs] = useState<PlanDeFeu[]>(() => [{ id: 1, name: 'PF1', data: createEmptyActionData(), diagram: [], remarques: '' }]);

    const [activePFId, setActivePFIdRaw] = useState(1);

    // Lecture seule du PF actif (PF importé « _ext » verrouillé). Met à jour la
    // réf capturée par les mutateurs + expose la valeur à l'UI (cadenas, bandeau).
    const activePfReadOnly = pfTabs.find(p => p.id === activePFId)?.readOnly === true;
    activePfReadOnlyRef.current = activePfReadOnly;

    // Simulation mode state (not persisted - resets on page load)
    const [simulationEnabled, setSimulationEnabled] = useState(false);

    // Intersection image state (persisted with project)
    const [intersectionImage, setIntersectionImage] = useState<string | null>(null);
    const [intersectionArrows, setIntersectionArrows] = useState<FlecheCarrefour[]>([]);
    const [imageBrightness, setImageBrightness] = useState(100);
    const [imageContrast, setImageContrast] = useState(100);

    const {
        activeTrafficDataset, setActiveTrafficDataset,
        customTrafficDatasetNames, setCustomTrafficDatasetNames,
        pfTrafficDatasetMap, setPfTrafficDatasetMap, pfTrafficDatasetMapRef,
        trafficDatasets, setTrafficDatasets
    } = useEtatJeuxTrafic();

    // Wrapper qui restaure le dataset trafic mémorisé pour le PF cible
    const setActivePFId = useCallback((pfId: number) => {
        setActivePFIdRaw(pfId);
        const savedDataset = pfTrafficDatasetMapRef.current[pfId];
        if (savedDataset) {
            setActiveTrafficDataset(savedDataset);
        }
    }, [pfTrafficDatasetMapRef, setActiveTrafficDataset]);

    // Applique le résultat de mergePfFromProject : ajoute les PF importés + les
    // jeux de trafic rapatriés, SANS toucher aux groupes ni au PF actif courant.
    const applyMergedPf = useCallback((mergedState: Partial<Projet> | null | undefined) => {
        if (!mergedState || !Array.isArray(mergedState.pfTabs)) return;
        setPfTabs(mergedState.pfTabs);
        if (mergedState.trafficDatasets) setTrafficDatasets(mergedState.trafficDatasets);
        if (Array.isArray(mergedState.customTrafficDatasetNames)) setCustomTrafficDatasetNames(mergedState.customTrafficDatasetNames);
        if (mergedState.pfTrafficDatasetMap) setPfTrafficDatasetMap(mergedState.pfTrafficDatasetMap);
    }, [setTrafficDatasets, setCustomTrafficDatasetNames, setPfTrafficDatasetMap]);

    // Get current actionData based on active PF
    const actionData = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF ? activePF.data : createEmptyActionData();
    }, [pfTabs, activePFId]);

    // Champs personnalisés des conditions et phasage bulle du plan actif.
    const {
        microCustomFields, updateMicroCustomField,
        phasageBulleCount, setPhasageBulleCount, phasageBulleTimes, setPhasageBulleTimes,
        phasageBubbleScale, setPhasageBubbleScale, phasageEllipseScale, setPhasageEllipseScale,
        phasageBubbleRatio, setPhasageBubbleRatio
    } = useReglagesPlanActif({ pfTabs, setPfTabs, activePFId });

    // Le nom visible d'un PF peut différer de la clé de son jeu de trafic.
    // Le mapping PF → jeu est la source de vérité ; les jeux historiques qui
    // contiennent encore des données restent également accessibles.
    const { trafficDatasetNames, trafficDatasetSourceNames } = useNomsJeuxTrafic({
        pfTabs, pfTrafficDatasetMap, customTrafficDatasetNames, trafficDatasets, activeTrafficDataset, groups
    });

    // Computed Conflicts
    const conflicts = useMemo(
        () => calculerConflits(groups, conflictMatrix, cycleLength, actionData),
        [groups, conflictMatrix, cycleLength, actionData]);

    // Update action data for active PF
    const setActionData = useCallback((newData: SetStateAction<ActionMicro[]>) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? { ...pf, data: typeof newData === 'function' ? newData(pf.data) : newData }
                : pf
        ));
    }, [activePFId]);

    // Reorder actions (for sorting)
    const reorderActions = useCallback((sortedData: ActionMicro[]) => {
        // Reassign IDs to maintain order
        const reorderedData = sortedData.map((row, index) => ({
            ...row,
            id: index + 1
        }));
        setActionData(reorderedData);
    }, [setActionData]);

    // Onglets des plans de feux.
    const { duplicatePF, deletePF, renamePF, setPFColor, updatePFRemarques, reorderPF } = useGestionPlans({
        pfTabs, setPfTabs, activePFId, setActivePFId, actionData, conflictMatrix, cycleLength, dossierReadOnlyRef
    });

    // Scénarios de simulation, rangés dans le plan de feu actif.
    const {
        simulationSelectedActions, simulationName, simulationScenarios,
        choisirScenarioSimulation, creerScenarioSimulation, enregistrerScenarioSimulation,
        supprimerScenarioSimulation, toggleSimulationAction
    } = useScenariosSimulation({ pfTabs, setPfTabs, activePFId, isEditLocked });

    // Save project - defined after all state declarations to capture current values
    const saveProject = useCallback(async (name: string) => {
        if (!name) return false;
        // Projet exemple : non persistable (filet de sécurité — l'entrée
        // de menu Sauvegarder est déjà grisée).
        if (isExampleSession()) return false;
        // Dossier en lecture seule : non persistable (intégrité du dossier transmis).
        if (dossierReadOnlyRef.current) return false;

        // Validate data before saving to prevent empty saves
        if (!groups || groups.length === 0) {
            console.error("Save aborted: groups is empty or undefined");
            alertFn({ title: 'Sauvegarde impossible', message: 'Impossible de sauvegarder : les groupes sont vides.' });
            return false;
        }
        if (!pfTabs || pfTabs.length === 0) {
            console.error("Save aborted: pfTabs is empty or undefined");
            alertFn({ title: 'Sauvegarde impossible', message: 'Impossible de sauvegarder : les plans de feux sont vides.' });
            return false;
        }
        if (!conflictMatrix || conflictMatrix.length === 0) {
            console.error("Save aborted: conflictMatrix is empty or undefined");
            alertFn({ title: 'Sauvegarde impossible', message: 'Impossible de sauvegarder : la matrice de conflits est vide.' });
            return false;
        }

        currentProjectNameRef.current = name;
        setProjectName(name);
        // Payload canonique (getFullState) + métadonnées de sauvegarde. Une
        // seule source de vérité, partagée avec l'autosave et l'export fichier :
        // aucun champ ne peut être oublié ici sans l'être partout.
        const nowIso = new Date().toISOString();
        const projectData = {
            ...getFullStateRef.current(),
            projectName: name,
            projectProperties: { ...projectProperties, dateModification: nowIso },
            savedAt: nowIso
            // Note: simulation state is NOT saved with project (per user request)
        };
        // Mettre à jour la date de modification dans l'état
        setProjectProperties(prev => ({ ...prev, dateModification: new Date().toISOString() }));

        // Mettre à jour les registres globaux (communes, MOA→logo)
        const commune = projectProperties.commune?.trim();
        if (commune) {
            setAppCommunes(prev => {
                const updated = prev.includes(commune) ? prev : [...prev, commune].sort((a, b) => a.localeCompare(b, 'fr'));
                safeLocalStorage.setItem('trafficAppCommunes', JSON.stringify(updated));
                return updated;
            });
        }
        const moaName = projectProperties.moa?.trim();
        const moaLogo = projectProperties.logoMoa;
        if (moaName && moaLogo) {
            setAppMoaLogos(prev => {
                const updated = { ...prev, [moaName]: moaLogo };
                safeLocalStorage.setItem('trafficAppMoaLogos', JSON.stringify(updated));
                return updated;
            });
        }
        const moeName = projectProperties.moe?.trim();
        const moeLogo = projectProperties.logoMoe;
        if (moeName && moeLogo) {
            setAppMoeLogos(prev => {
                const updated = { ...prev, [moeName]: moeLogo };
                safeLocalStorage.setItem('trafficAppMoeLogos', JSON.stringify(updated));
                return updated;
            });
        }

        // Check if resulting JSON is valid and not too small (likely corrupted)
        const jsonData = JSON.stringify(projectData);
        if (jsonData.length < 100) {
            console.error("Save aborted: data appears corrupted (too small)", jsonData.length);
            alertFn({ title: 'Sauvegarde impossible', message: 'Impossible de sauvegarder : les données semblent corrompues.' });
            return false;
        }

        return ecrireProjetCache(name, jsonData, { askConfirm, alertFn });
    }, [intersectionName, groups, cycleLength, conflictMatrix, pfTabs, activePFId, intersectionImage, intersectionArrows, imageBrightness, imageContrast, trafficDatasets, activeTrafficDataset, dependencyGap, biCarrefourSeparator, externalLinks, projectProperties, askConfirm]);

    // Verrou de synchronisation pendant l'installation des données.
    //
    // Tant qu'il est posé, les modifications ne sont PAS recopiées vers l'onglet
    // actif : une durée de cycle changée dans cet intervalle, suivie d'un
    // changement d'onglet, était perdue sans avertissement — et en premier lieu
    // sur le plan de feu affiché à l'ouverture.
    //
    // Il se levait au bout de deux secondes fixes, indépendamment de ce que
    // faisait l'application. Il se lève désormais dès que le rendu suivant a eu
    // lieu — l'état est alors posé — le délai ne servant plus que de filet si un
    // chargement de projet était encore en cours à ce moment-là.
    const isInitialLoadRef = useRef(true);
    // Le PF actif, lisible depuis une fermeture qui date du montage. L'effet
    // ci-dessous n'a pas de dépendances : il ne voyait donc que la valeur de
    // départ — PF1 — et remettait le repère de synchronisation sur ce PF-là,
    // alors qu'un projet chargé entre-temps en avait désigné un autre. Le PF1
    // héritait alors du diagramme et du cycle du plan réellement actif.
    const activePFIdRef = useRef(activePFId);
    activePFIdRef.current = activePFId;
    useEffect(() => {
        const lever = () => {
            if (!isInitialLoadRef.current) return;
            isInitialLoadRef.current = false;
            resetPfSyncRefs(activePFIdRef.current);
        };
        // Un tour de boucle suffit dans le cas courant ; le délai couvre le cas
        // où un projet est encore en cours de chargement.
        const rapide = setTimeout(() => { if (!isLoadingProjectRef.current) lever(); }, 0);
        const filet = setTimeout(lever, 2000);
        return () => { clearTimeout(rapide); clearTimeout(filet); };
    }, []);

    // Synchronize current conflict matrix with active PF tab
    // Use a ref to prevent infinite loops
    const lastSyncedMatrixRef = useRef<string | null>(null);
    const prevActivePFIdForMatrixSyncRef = useRef(activePFId);
    useEffect(() => {
        // Skip during initial load
        if (isInitialLoadRef.current) return;

        const matrixKey = JSON.stringify(conflictMatrix);

        // When PF just changed: don't save to the new PF — let the reverse sync
        // load the new PF's matrix first. Save pending edits to the OLD PF only
        // if we've been actively syncing (lastSyncedMatrixRef !== null), to avoid
        // corrupting old PFs on first run after project load.
        if (prevActivePFIdForMatrixSyncRef.current !== activePFId) {
            const oldPFId = prevActivePFIdForMatrixSyncRef.current;
            prevActivePFIdForMatrixSyncRef.current = activePFId;

            // Save current matrix to the OLD PF before switching
            setPfTabs(prevTabs => {
                const tabIndex = prevTabs.findIndex(pf => pf.id === oldPFId);
                if (tabIndex === -1) return prevTabs;
                const currentPfMatrix = prevTabs[tabIndex].conflictMatrix;
                if (JSON.stringify(currentPfMatrix) === matrixKey) return prevTabs;
                const newTabs = [...prevTabs];
                newTabs[tabIndex] = {
                    ...newTabs[tabIndex],
                    conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix))
                };
                return newTabs;
            });
            // Reset sync ref so that the next render (after reverse sync loads
            // the new PF's matrix) will pick it up correctly
            lastSyncedMatrixRef.current = null;
            return;
        }

        // Normal case: save matrix to active PF when it changes
        if (lastSyncedMatrixRef.current === matrixKey) {
            return; // Already synced this matrix
        }
        lastSyncedMatrixRef.current = matrixKey;

        setPfTabs(prevTabs => {
            const tabIndex = prevTabs.findIndex(pf => pf.id === activePFId);
            if (tabIndex === -1) return prevTabs;

            // Check if matrix actually changed
            const currentPfMatrix = prevTabs[tabIndex].conflictMatrix;
            if (JSON.stringify(currentPfMatrix) === matrixKey) {
                return prevTabs; // No change needed
            }

            // Update the PF with the new matrix
            const newTabs = [...prevTabs];
            newTabs[tabIndex] = {
                ...newTabs[tabIndex],
                conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix))
            };
            return newTabs;
        });
    }, [conflictMatrix, activePFId]);

    // Synchronize current groups (diagram data) with active PF tab
    const lastSyncedGroupsRef = useRef<string | null>(null);
    const prevActivePFIdForGroupsSyncRef = useRef(activePFId);
    useEffect(() => {
        // Skip during initial load
        if (isInitialLoadRef.current) return;

        // Build diagram data from groups (uses shared helper for consistency)
        const diagramData = buildDiagramFromGroups(groups);
        const groupsKey = JSON.stringify(diagramData);
        // Include cycleLength in sync key so that cycle-only changes are saved
        const syncKey = groupsKey + '|' + cycleLength;

        // Helper: write diagram + cycleLength to a specific PF, skipping if unchanged
        const writeDiagramToPF = (pfId: number) => {
            setPfTabs(prevTabs => {
                const tabIndex = prevTabs.findIndex(pf => pf.id === pfId);
                if (tabIndex === -1) return prevTabs;
                const currentPfDiagram = prevTabs[tabIndex].diagram;
                if (JSON.stringify(currentPfDiagram) === groupsKey && prevTabs[tabIndex].cycleLength === cycleLength) return prevTabs;
                const newTabs = [...prevTabs];
                newTabs[tabIndex] = {
                    ...newTabs[tabIndex],
                    diagram: diagramData,
                    cycleLength: cycleLength
                };
                return newTabs;
            });
        };

        // When PF just changed: save pending edits to the OLD PF, then let reverse sync load the new one
        if (prevActivePFIdForGroupsSyncRef.current !== activePFId) {
            const oldPFId = prevActivePFIdForGroupsSyncRef.current;
            prevActivePFIdForGroupsSyncRef.current = activePFId;
            writeDiagramToPF(oldPFId);
            lastSyncedGroupsRef.current = null;
            return;
        }

        if (lastSyncedGroupsRef.current === syncKey) {
            return; // Already synced
        }
        lastSyncedGroupsRef.current = syncKey;

        writeDiagramToPF(activePFId);
    }, [groups, cycleLength, activePFId]);

    // Apply diagram data from active PF tab to groups when changing tabs
    // Use a ref to track the last applied PF to avoid unnecessary re-renders
    const lastAppliedPFRef = useRef<string | null>(null);

    // Wire up the centralized reset function now that all sync refs exist
    pfSyncRefsResetRef.current = (newActivePFId: number) => {
        prevActivePFIdForGroupsSyncRef.current = newActivePFId;
        prevActivePFIdForMatrixSyncRef.current = newActivePFId;
        lastSyncedGroupsRef.current = null;
        lastSyncedMatrixRef.current = null;
        lastAppliedPFRef.current = null;
    };

    useEffect(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);

        // Only apply if PF changed and has diagram data
        if (activePF && activePF.diagram && activePF.diagram.length > 0) {
            // Check if we already applied this PF's diagram
            const pfKey = `${activePF.id}-${JSON.stringify(activePF.diagram)}`;
            if (lastAppliedPFRef.current === pfKey) {
                return; // Already applied, skip
            }
            lastAppliedPFRef.current = pfKey;

            // Synchronize lastSyncedGroupsRef so the forward sync knows
            // it can save to the old PF when we switch away later
            const diagramData = activePF.diagram.map(d => ({
                groupId: d.groupId,
                offset: d.offset,
                greenDuration: d.greenDuration,
                da: d.da || '',
                comment: d.comment || '',
                commentColor: d.commentColor || '',
                phaseFlag: d.phaseFlag || ''
            }));
            const groupsKey = JSON.stringify(diagramData);
            const cl = activePF.cycleLength || cycleLength;
            lastSyncedGroupsRef.current = groupsKey + '|' + cl;

            // Update groups with diagram data from active PF
            setGroups(prevGroups => {
                const newGroups = prevGroups.map(group => {
                    const diagramEntry = activePF.diagram.find(d => d.groupId === group.id);
                    if (diagramEntry) {
                        // Safely get values with fallbacks to prevent undefined
                        const newOffset = diagramEntry.offset !== undefined && !isNaN(diagramEntry.offset)
                            ? diagramEntry.offset
                            : group.offset;
                        const newGreenDuration = diagramEntry.greenDuration !== undefined && !isNaN(diagramEntry.greenDuration)
                            ? diagramEntry.greenDuration
                            : group.durations.green;
                        return {
                            ...group,
                            offset: newOffset,
                            da: diagramEntry.da !== undefined ? diagramEntry.da : group.da,
                            comment: diagramEntry.comment !== undefined ? diagramEntry.comment : group.comment,
                            commentColor: diagramEntry.commentColor !== undefined ? diagramEntry.commentColor : group.commentColor,
                            phaseFlag: diagramEntry.phaseFlag !== undefined ? diagramEntry.phaseFlag : (group.phaseFlag || ''),
                            durations: {
                                ...group.durations,
                                green: newGreenDuration
                            }
                        };
                    }
                    return group;
                });
                return newGroups;
            });
            // Also update cycle length if the PF has a specific one
            if (activePF.cycleLength) {
                setCycleLength(activePF.cycleLength);
            }
            // Also update conflict matrix if the PF has a specific one
            // Resize matrix to match current group count to prevent errors
            const matricePlan = activePF.conflictMatrix;
            if (matricePlan && matricePlan.length > 0) {
                setConflictMatrix(prevMatrix => {
                    const currentSize = prevMatrix.length;
                    const pfMatrixSize = matricePlan.length;

                    // Create a new matrix with the current size, filled with empty values
                    const resizedMatrix = Array.from({ length: currentSize }, (_, r) => {
                        const row: CaseMatrice[] = new Array(currentSize).fill('');
                        for (let c = 0; c < currentSize; c++) {
                            // Copy values from PF matrix if they exist
                            if (r < pfMatrixSize && c < pfMatrixSize && matricePlan[r]) {
                                let val = matricePlan[r][c];
                                // Minimum is 0 for Piéton/Cycliste from-group, 3 for others
                                const fromGroup = groups[r];
                                const minVal = intervertMinimal(fromGroup);
                                // Clean the value: keep values in [minVal, 20] range
                                if (val !== '' && val !== undefined) {
                                    const numericVal = typeof val === 'number' ? val : entier(val);
                                    if (isNaN(numericVal) || numericVal < minVal || numericVal > 20) val = '';
                                }
                                row[c] = val !== undefined ? val : '';
                            }
                        }
                        return row;
                    });
                    return resizedMatrix;
                });
            }
        }
    }, [activePFId, pfTabs]);

    // Save project properties to localStorage
    useEffect(() => {
        safeLocalStorage.setItem('trafficProjectProperties', JSON.stringify(projectProperties));
    }, [projectProperties]);

    // Auto-save current project to cache (debounced)
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        // Skip during initial load or project loading
        if (isInitialLoadRef.current || isLoadingProjectRef.current) return;

        // Skip if no project name
        if (!currentProjectNameRef.current) return;

        // Dossier en lecture seule : ne jamais mettre en cache (le dossier
        // transmis ne doit pas devenir une copie de travail éditable).
        if (dossierReadOnlyRef.current) return;

        // Debounce: save after 2 seconds of inactivity
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(() => {
            // Le projet a pu être fermé pendant l'attente : rien à mettre en cache.
            const nomProjet = currentProjectNameRef.current;
            if (!nomProjet) return;
            try {
                // Même payload canonique que la sauvegarde explicite et l'export
                // fichier (getFullState) : garantit qu'un aller-retour par le
                // cache ne perd aucun champ.
                const projectData = {
                    ...getFullStateRef.current(),
                    savedAt: new Date().toISOString()
                };
                const jsonData = JSON.stringify(projectData);

                // Faire de la place AVANT d'écrire : la sauvegarde explicite le
                // faisait déjà, l'autosave écrivait à l'aveugle.
                ensureLocalStorageSpace();

                // Save project
                const ecrit = safeLocalStorage.setItem(`traffic_project_${nomProjet}`, jsonData);

                // Un échec de cache passait jusqu'ici par un simple console.warn :
                // l'utilisateur croyait son travail à l'abri alors que rien
                // n'était écrit. C'est ainsi que des flèches de carrefour ont été
                // perdues. On le dit, une fois, et on rappelle où est le recours.
                if (!ecrit) {
                    if (!echecCacheSignale) {
                        echecCacheSignale = true;
                        toast.error("Cache navigateur saturé : la sauvegarde automatique n'a pas pu s'effectuer. Enregistrez votre projet dans un fichier .json pour ne rien perdre.");
                    }
                    return;
                }
                echecCacheSignale = false;

                // Update order and clean up old projects
                updateProjectOrder(nomProjet);
            } catch (e) {
                console.warn('Auto-save failed:', e);
            }
        }, 2000);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [groups, cycleLength, conflictMatrix, pfTabs, activePFId, intersectionImage, intersectionArrows, imageBrightness, imageContrast, trafficDatasets, activeTrafficDataset, dependencyGap, biCarrefourSeparator, intersectionName, projectProperties, capacityCompareSelection, capacityCompareDataset, customTrafficDatasetNames, pfTrafficDatasetMap, externalLinks, matricesLocked, actionColWidths]);

    const {
        updateTrafficData, getTrafficData, copyTrafficDataset, addCustomTrafficDataset,
        infoSuppressionJeuTrafic, supprimerJeuTrafic
    } = useOperationsJeuxTrafic({
        trafficDatasets, setTrafficDatasets,
        activeTrafficDataset, setActiveTrafficDataset,
        customTrafficDatasetNames, setCustomTrafficDatasetNames,
        pfTrafficDatasetMap, setPfTrafficDatasetMap,
        setCapacityCompareDataset, trafficDatasetNames,
        pfTabs, groups, activePFId, isEditLocked
    });
    // Note: Simulation state is NOT saved to localStorage (per user request)

    // Annuler / Rétablir.
    const { saveToHistory, startDrag, endDrag, undo, redo } = useAnnulerRetablir({
        groups, setGroups, conflictMatrix, setConflictMatrix, pfTabs, setPfTabs,
        activePFId, setActivePFIdRaw, cycleLength, setCycleLength, intersectionName, setIntersectionName,
        history, setHistory, redoHistory, setRedoHistory, isUndoing, isRedoing, isDragging, resetPfSyncRefs
    });

    // Wrapped update functions that save to history (skip if dragging)
    const updateActionRowWithHistory = useCallback((rowId: number, field: keyof ActionMicro, value: string) => {
        if (isEditLocked()) return;
        if (!isDragging.current) {
            saveToHistory();
        }
        setActionData(prev => prev.map(row =>
            row.id === rowId ? { ...row, [field]: value } : row
        ));
    }, [saveToHistory]);

    // Wrapped setCycleLength that saves to history
    const setCycleLengthWithHistory = useCallback((newCycle: number) => {
        if (isEditLocked()) return;
        if (newCycle === cycleLength) return; // No change
        saveToHistory();
        setCycleLength(newCycle);
    }, [saveToHistory, cycleLength]);

    // Wrapped setGroupCount that saves to history
    const setGroupCountWithHistory = useCallback((count: number | string) => {
        if (isEditLocked()) return;
        const newCount = Math.max(1, entier(count) || 1);
        if (newCount === groups.length) return; // No change
        saveToHistory();
        setGroupCountInternal(count);
    }, [saveToHistory, groups.length]);

    const updateGroupParamsWithHistory = useCallback((id: number, params: ParametresGroupe) => {
        if (!isDragging.current) {
            saveToHistory();
        }

        // If offset or duration is changing, calculate delta to update linked bande passante actions
        // Skip this during dragging - TimelineDiagram handles it directly with stored initial values to avoid drift
        if (!isDragging.current) {
            const currentGroup = groups.find(g => g.id === id);
            if (currentGroup) {
                // Calculate old and new end of green
                const oldOffset = currentGroup.offset;
                const oldGreen = currentGroup.durations.green;
                const oldEnd = (oldOffset + oldGreen) % cycleLength;

                const newOffset = params.offset !== undefined ? params.offset : oldOffset;
                const newGreen = params.durations?.green !== undefined ? params.durations.green : oldGreen;
                const newEnd = (newOffset + newGreen) % cycleLength;

                const deltaOffset = newOffset - oldOffset;
                const deltaEnd = ((newEnd - oldEnd) % cycleLength + cycleLength) % cycleLength;
                // Normalize deltaEnd to handle wrap-around correctly
                const normalizedDeltaEnd = deltaEnd > cycleLength / 2 ? deltaEnd - cycleLength : deltaEnd;

                setActionData(currentData => {
                    return currentData.map(row => {
                        const rowGf = entier(row.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                        if (rowGf !== id) return row;

                        // "Début de bande passante" is linked to START of green (offset)
                        if (row.action === 'Début de bande passante' && row.deb !== '' && deltaOffset !== 0) {
                            const newDeb = ((entier(row.deb) + deltaOffset) % cycleLength + cycleLength) % cycleLength;
                            if (row.fin !== '') {
                                const newFin = ((entier(row.fin) + deltaOffset) % cycleLength + cycleLength) % cycleLength;
                                return { ...row, deb: newDeb.toString(), fin: newFin.toString() };
                            }
                            return { ...row, deb: newDeb.toString() };
                        }

                        // "Fin de bande passante" is linked to END of green (offset + green duration)
                        if (row.action === 'Fin de bande passante' && row.deb !== '' && normalizedDeltaEnd !== 0) {
                            const newDeb = ((entier(row.deb) + normalizedDeltaEnd) % cycleLength + cycleLength) % cycleLength;
                            if (row.fin !== '') {
                                const newFin = ((entier(row.fin) + normalizedDeltaEnd) % cycleLength + cycleLength) % cycleLength;
                                return { ...row, deb: newDeb.toString(), fin: newFin.toString() };
                            }
                            return { ...row, deb: newDeb.toString() };
                        }

                        return row;
                    });
                });
            }
        }

        setGroups(prev => prev.map(g => {
            if (g.id !== id) return g;

            let newG: Groupe = { ...g, ...params, durations: g.durations };

            if (params.durations || params.offset !== undefined) {
                const mergedDurations = { ...g.durations, ...params.durations };
                const currentGreen = mergedDurations.green;
                const currentOrange = mergedDurations.orange;
                const newRed = Math.max(0, cycleLength - currentGreen - currentOrange);

                newG.durations = {
                    green: currentGreen,
                    orange: currentOrange,
                    red: newRed
                };
            }
            return newG;
        }));
    }, [saveToHistory, cycleLength, groups, setActionData]);

    const setMatrixValueWithHistory = useCallback((fromId: number, toId: number, value: CaseMatrice) => {
        if (!isDragging.current) {
            saveToHistory();
        }
        setConflictMatrix(prev => {
            const next = prev.map(row => [...row]);
            if (next[fromId - 1]) {
                // Empty value is allowed
                if (value === '') {
                    next[fromId - 1][toId - 1] = '';
                } else {
                    const parsedValue = entier(value);
                    // Minimum is 0 for Piéton/Cycliste from-group, 3 for others
                    const fromGroup = groups[fromId - 1];
                    const minValue = intervertMinimal(fromGroup);
                    if (!isNaN(parsedValue) && parsedValue >= minValue && parsedValue <= 20) {
                        next[fromId - 1][toId - 1] = parsedValue;
                    } else if (!isNaN(parsedValue) && parsedValue < minValue) {
                        // If value is less than minimum, set to empty
                        next[fromId - 1][toId - 1] = '';
                    } else if (!isNaN(parsedValue) && parsedValue > 20) {
                        // If value is greater than 20, cap at 20
                        next[fromId - 1][toId - 1] = 20;
                    }
                }
            }
            return next;
        });
    }, [saveToHistory, groups]);

    // Copie la matrice d'interverts d'un AUTRE plan de feux dans le PF actif.
    // Bloquée en lecture seule ; ne copie que si la matrice source a la même
    // taille que les groupes courants (mêmes groupes -> copie sûre). Le sync
    // matrice propage ensuite la valeur au PF actif. Renvoie true si copiée.
    const copyMatrixFromPF = useCallback((sourcePFId: number) => {
        if (isEditLocked()) return false;
        const src = pfTabs.find(p => p.id === sourcePFId);
        if (!src || !Array.isArray(src.conflictMatrix) || src.conflictMatrix.length === 0) return false;
        if (src.conflictMatrix.length !== groups.length) return false;
        saveToHistory();
        setConflictMatrix(src.conflictMatrix.map(row => [...row]));
        return true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pfTabs, groups, saveToHistory]);

    // Slide all groups by a given offset
    const slideAllGroups = useCallback((delta: number, fromGroupId: number | null = null, toGroupId: number | null = null) => {
        saveToHistory();
        setGroups(currentGroups => {
            const fromIdx = fromGroupId != null ? currentGroups.findIndex(g => g.id === fromGroupId) : 0;
            const toIdx = toGroupId != null ? currentGroups.findIndex(g => g.id === toGroupId) : currentGroups.length - 1;

            return currentGroups.map((g, idx) => {
                if (idx >= fromIdx && idx <= toIdx) {
                    return {
                        ...g,
                        offset: ((g.offset + delta) % cycleLength + cycleLength) % cycleLength
                    };
                }
                return g;
            });
        });
        // Also slide action data Déb/Fin for groups in range
        setActionData(currentData => {
            const fromIdx = fromGroupId != null ? groups.findIndex(g => g.id === fromGroupId) : 0;
            const toIdx = toGroupId != null ? groups.findIndex(g => g.id === toGroupId) : groups.length - 1;

            return currentData.map(row => {
                const gf = entier(row.gf);
                if (isNaN(gf) || gf < fromIdx + 1 || gf > toIdx + 1) return row;

                const newRow = { ...row };
                if (newRow.deb !== '' && newRow.deb !== undefined) {
                    const newDeb = ((entier(newRow.deb) + delta) % cycleLength + cycleLength) % cycleLength;
                    newRow.deb = newDeb.toString();
                }
                if (newRow.fin !== '' && newRow.fin !== undefined) {
                    const newFin = ((entier(newRow.fin) + delta) % cycleLength + cycleLength) % cycleLength;
                    newRow.fin = newFin.toString();
                }
                return newRow;
            });
        });
    }, [saveToHistory, cycleLength, groups]);

    // Insert time at a given position for a given duration
    const insertTime = useCallback((startSecond: number, duration: number) => {
        saveToHistory();
        // Increase cycle length first
        setCycleLength(prev => prev + duration);
        // Shift group offsets and green ends (extend green if it spans the insertion point)
        setGroups(currentGroups => {
            return currentGroups.map(g => {
                const offset = g.offset;
                const greenEnd = offset + (g.durations?.green || 0);
                const shiftOffset = offset > startSecond;
                const shiftEnd = greenEnd > startSecond;
                if (shiftOffset && shiftEnd) {
                    // Both start and end are after insertion: shift offset, green stays same
                    return { ...g, offset: offset + duration };
                } else if (!shiftOffset && shiftEnd) {
                    // Start before, end after: extend green duration
                    return {
                        ...g,
                        durations: { ...g.durations, green: g.durations.green + duration }
                    };
                }
                return g;
            });
        });
        // Shift action data (conditions de micro-régulation) Déb/Fin
        setActionData(currentData => {
            return currentData.map(row => {
                const newRow = { ...row };
                if (newRow.deb !== '' && newRow.deb !== undefined) {
                    const deb = entier(newRow.deb);
                    if (!isNaN(deb) && deb > startSecond) {
                        newRow.deb = (deb + duration).toString();
                    }
                }
                if (newRow.fin !== '' && newRow.fin !== undefined) {
                    const fin = entier(newRow.fin);
                    if (!isNaN(fin) && fin > startSecond) {
                        newRow.fin = (fin + duration).toString();
                    }
                }
                return newRow;
            });
        });
    }, [saveToHistory]);

    // Reduce time at a given position for a given duration
    // Décale toutes les valeurs (groupes et actions) > startSecond de -duration
    const reduceTime = useCallback((startSecond: number, duration: number) => {
        saveToHistory();
        // Réduire le cycle en premier
        setCycleLength(prev => Math.max(1, prev - duration));
        // Décaler les offsets et/ou durées des groupes
        setGroups(currentGroups => {
            return currentGroups.map(g => {
                const offset = g.offset;
                const greenEnd = offset + (g.durations?.green || 0);
                const shiftOffset = offset > startSecond;
                const shiftEnd = greenEnd > startSecond;

                if (shiftOffset && shiftEnd) {
                    // Début et fin après le point de réduction : décaler l'offset
                    return { ...g, offset: Math.max(0, offset - duration) };
                } else if (!shiftOffset && shiftEnd) {
                    // Début avant, fin après : réduire la durée de vert
                    return {
                        ...g,
                        durations: { ...g.durations, green: Math.max(0, g.durations.green - duration) }
                    };
                }
                return g;
            });
        });
        // Décaler les Déb/Fin des conditions de micro-régulation
        setActionData(currentData => {
            return currentData.map(row => {
                const newRow = { ...row };
                if (newRow.deb !== '' && newRow.deb !== undefined) {
                    const deb = entier(newRow.deb);
                    if (!isNaN(deb) && deb > startSecond) {
                        newRow.deb = Math.max(0, deb - duration).toString();
                    }
                }
                if (newRow.fin !== '' && newRow.fin !== undefined) {
                    const fin = entier(newRow.fin);
                    if (!isNaN(fin) && fin > startSecond) {
                        newRow.fin = Math.max(0, fin - duration).toString();
                    }
                }
                return newRow;
            });
        });
    }, [saveToHistory]);

    return {
        intersectionName,
        setIntersectionName,
        groups,
        setGroupCount: setGroupCountWithHistory,
        cycleLength,
        setCycleLength: setCycleLengthWithHistory,
        dependencyGap,
        setDependencyGap,
        biCarrefourSeparator,
        setBiCarrefourSeparator,
        matricesLocked,
        setMatricesLocked,
        dossierReadOnly,
        setDossierReadOnly,
        activePfReadOnly,
        applyMergedPf,
        copyMatrixFromPF,
        actionColWidths,
        setActionColWidths,
        externalLinks,
        setExternalLinks,
        capacityCompareSelection,
        setCapacityCompareSelection,
        capacityCompareDataset,
        setCapacityCompareDataset,
        conflictMatrix,
        setMatrixValue: setMatrixValueWithHistory,
        conflicts,
        globalTime,
        isPlaying,
        setIsPlaying,
        reset,
        updateGroupParams: updateGroupParamsWithHistory,
        getGroupState,
        moveGroup,
        moveGroupToPosition,
        // Save/Load
        saveProject,
        loadProject,
        getAllSaves,
        getProjectData,
        deleteSave,
        getFullState,
        loadFullState,
        resetToNewProject,
        // Action Table
        actionData,
        updateActionRow: updateActionRowWithHistory,
        reorderActions,
        microCustomFields,
        updateMicroCustomField,
        // Phasage bulle (per PF)
        phasageBulleCount,
        phasageBulleTimes,
        setPhasageBulleCount,
        setPhasageBulleTimes,
        phasageBubbleScale,
        phasageEllipseScale,
        setPhasageBubbleScale,
        setPhasageEllipseScale,
        phasageBubbleRatio,
        setPhasageBubbleRatio,
        // PF (Plans de Feux) management
        pfTabs,
        activePFId,
        setActivePFId,
        duplicatePF,
        deletePF,
        renamePF,
        setPFColor,
        updatePFRemarques,
        reorderPF,
        currentRemarques: pfTabs.find(pf => pf.id === activePFId)?.remarques || '',
        // Undo/Redo
        undo,
        redo,
        canUndo: history.length > 0,
        canRedo: redoHistory.length > 0,
        // Drag helpers (for saving history only once per drag)
        startDrag,
        endDrag,
        // Diagram operations
        slideAllGroups,
        insertTime,
        reduceTime,
        // Simulation mode
        simulationEnabled,
        setSimulationEnabled,
        simulationSelectedActions,
        simulationName,
        simulationScenarios,
        choisirScenarioSimulation,
        creerScenarioSimulation,
        enregistrerScenarioSimulation,
        supprimerScenarioSimulation,
        toggleSimulationAction,
        // Intersection image
        intersectionImage,
        setIntersectionImage,
        intersectionArrows,
        setIntersectionArrows,
        imageBrightness,
        setImageBrightness,
        imageContrast,
        setImageContrast,
        // Traffic datasets
        trafficDatasets,
        activeTrafficDataset,
        setActiveTrafficDataset,
        updateTrafficData,
        getTrafficData,
        trafficDatasetNames,
        trafficDatasetSourceNames,
        copyTrafficDataset,
        infoSuppressionJeuTrafic,
        supprimerJeuTrafic,
        addCustomTrafficDataset,
        pfTrafficDatasetMap,
        // Project properties
        projectProperties,
        updateProjectProperty,
        // Project name (save key, displayed in header)
        projectName,
        setProjectName,
        // App-wide registries
        appCommunes,
        appMoaLogos,
        appMoeLogos
    };
};
