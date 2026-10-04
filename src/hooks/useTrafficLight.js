import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    DEFAULT_CYCLE,
    MAX_PF,
    MAX_GROUPS,
    createEmptyActionRow,
    createEmptyActionData,
    buildDiagramFromGroups,
    buildEmptyMatrix,
    createEmptyPF,
    ensurePFIntegrity,
    cycleDuPlanActif
} from '../utils/pfHelpers';
import { ACTIONS_HORS_SIMULATION, actionsSimulables } from '../utils/simulationCalculator';
import { isExampleSession } from '../utils/exampleMode';
import { isReadOnlyStamped } from '../utils/dossierLock';
import { toast } from '../utils/toast';
import { buildTrafficDatasetNames, trafficDatasetHasData } from '../utils/trafficHelpers';
const MAX_HISTORY_SIZE = 50;

// Safe localStorage helper to prevent QuotaExceededError crashes
const safeLocalStorage = {
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn(`localStorage quota exceeded for key: ${key}`);
                // Don't crash the app, just skip the save
                return false;
            }
            throw e;
        }
    },
    getItem: (key) => localStorage.getItem(key),
    removeItem: (key) => localStorage.removeItem(key)
};

// Clés d'une ancienne mécanique de cache, remplacée par la sérialisation
// unifiée dans traffic_project_<nom> : elles étaient encore ÉCRITES mais plus
// jamais relues. Coût réel, bénéfice nul — et 'trafficIntersectionImage'
// stockait une seconde copie de l'image du carrefour en data URL, souvent le
// plus gros objet du cache. Cette occupation morte poussait le quota à
// saturation : l'autosave échouait alors en silence, ou le garde-fou évinçait
// des projets pour faire de la place. D'où des pertes de travail — les flèches
// du carrefour en particulier, posées après le chargement de l'image, donc au
// moment où le cache est déjà plein.
// L'échec d'autosave n'est signalé qu'une fois : il se rejoue toutes les deux
// secondes d'inactivité, et une alerte répétée serait vite ignorée.
let echecCacheSignale = false;

const CLES_CACHE_MORTES = [
    'trafficGroups', 'trafficMatrix', 'trafficName', 'trafficCycle',
    'trafficDependencyGap', 'trafficPfTabs', 'trafficActivePF',
    'trafficIntersectionImage', 'trafficIntersectionArrows', 'trafficDatasets'
];

// Supprime ces clés du navigateur. Renvoie l'espace libéré en octets UTF-16.
const purgerClesMortes = () => {
    let libere = 0;
    for (const cle of CLES_CACHE_MORTES) {
        const valeur = localStorage.getItem(cle);
        if (valeur === null) continue;
        libere += (cle.length + valeur.length) * 2;
        localStorage.removeItem(cle);
    }
    if (libere > 0) {
        console.log(`Nettoyage : ${CLES_CACHE_MORTES.length} clés de cache obsolètes purgées (${(libere / 1024).toFixed(0)} KB)`);
    }
    return libere;
};

// Calculate total localStorage usage in bytes
const getLocalStorageUsage = () => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        // Each character is 2 bytes in JavaScript (UTF-16)
        total += (key.length + value.length) * 2;
    }
    return total;
};

// Free up approximately 1MB of space by removing oldest projects
const freeUpLocalStorage = (targetBytes = 1000000) => {
    let freedBytes = 0;
    const orderRaw = localStorage.getItem('traffic_project_order');
    if (!orderRaw) return freedBytes;

    try {
        const order = JSON.parse(orderRaw);
        const projectsToRemove = [];

        // Start from the end (oldest projects)
        for (let i = order.length - 1; i >= 0 && freedBytes < targetBytes; i--) {
            const projectName = order[i];
            const projectKey = `traffic_project_${projectName}`;
            const backupKey = `traffic_project_${projectName}_backup`;

            const projectData = localStorage.getItem(projectKey);
            const backupData = localStorage.getItem(backupKey);

            if (projectData) {
                freedBytes += (projectKey.length + projectData.length) * 2;
                projectsToRemove.push(projectName);
            }
            if (backupData) {
                freedBytes += (backupKey.length + backupData.length) * 2;
            }
        }

        // Remove the projects
        for (const projectName of projectsToRemove) {
            localStorage.removeItem(`traffic_project_${projectName}`);
            localStorage.removeItem(`traffic_project_${projectName}_backup`);
            console.log(`Espace libéré: projet "${projectName}" supprimé`);
        }

        // Update the order
        if (projectsToRemove.length > 0) {
            const newOrder = order.filter(n => !projectsToRemove.includes(n));
            localStorage.setItem('traffic_project_order', JSON.stringify(newOrder));
        }

        return freedBytes;
    } catch (e) {
        console.error('Error freeing localStorage:', e);
        return 0;
    }
};

// Supprime les clés `_backup` orphelines (dont le projet principal n'existe
// plus). Historiquement, l'éviction par plafond comptable retirait le projet
// principal sans toucher au backup, qui s'accumulait silencieusement dans le
// quota. Comme aucun chemin de code ne LIT ces backups (jamais restaurés),
// on peut les supprimer sans risque. Renvoie l'espace libéré en octets UTF-16.
const removeOrphanBackups = () => {
    let freed = 0;
    const orphanKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('traffic_project_') || !key.endsWith('_backup')) continue;
        const mainKey = key.slice(0, -'_backup'.length);
        if (localStorage.getItem(mainKey) === null) {
            const value = localStorage.getItem(key) || '';
            freed += (key.length + value.length) * 2;
            orphanKeys.push(key);
        }
    }
    orphanKeys.forEach(k => localStorage.removeItem(k));
    if (orphanKeys.length > 0) {
        console.log(`Nettoyage : ${orphanKeys.length} _backup orphelin(s) supprimé(s) (${(freed / 1024).toFixed(0)} KB)`);
    }
    return freed;
};

// Vérifie et libère de l'espace si localStorage approche du quota.
// Stratégie en 2 temps : (1) supprimer les _backup orphelins (gratuit, sans
// toucher aux projets actifs) ; (2) si encore au-dessus du seuil, évincer les
// projets les plus anciens. Le seuil est aligné sur ~80 % du quota navigateur
// typique en UTF-16 (~10 Mo), au lieu des 4,5 Mo historiques qui étaient
// déclenchés bien trop tôt par l'accumulation de backups.
const ensureLocalStorageSpace = () => {
    // (0) Gratuit et sans perte : les clés d'une mécanique abandonnée.
    purgerClesMortes();

    let usage = getLocalStorageUsage();
    const threshold = 8 * 1024 * 1024; // 8 MB UTF-16

    if (usage <= threshold) return true;

    // (1) Récupération gratuite : backups orphelins
    const orphanFreed = removeOrphanBackups();
    usage -= orphanFreed;
    if (usage <= threshold) return true;

    // (2) Encore au-dessus : on évince les projets les plus anciens
    console.log(`localStorage encore au-dessus du seuil (${(usage / 1024 / 1024).toFixed(2)} MB), libération de 1 MB par éviction...`);
    const freed = freeUpLocalStorage(1000000);
    console.log(`Éviction : ${(freed / 1024).toFixed(0)} KB libérés`);
    return freed > 0;
};

// Traffic dataset types
export const TRAFFIC_DATASETS = ['HPM', 'HPS', 'HC', 'Estimation', 'Projection'];

const DEFAULT_PROJECT_PROPERTIES = {
    commune: '', idCommune: '', idCarrefour: '', controleur: '', programme: '',
    horsAgglomeration: false,
    moa: '', moe: '', bureauEtudes: '', auteur: '',
    logoMoa: '', logoMoe: '',
    dateCreation: '', dateModification: '', numeroDossier: '', phaseEtude: '', commentaires: ''
};

// Create empty traffic data for a group (only trafficVol varies by dataset)
const createEmptyTrafficData = () => ({
    trafficVol: 0
});

/**
 * @param champsProjetRef  Réf vers { lire, ecrire } : des champs de projet
 *   portés par d'autres modules et qui doivent voyager avec le dossier — les
 *   cases à cocher de l'impression, par exemple. C'est une réf parce que ces
 *   modules sont créés APRÈS celui-ci ; elle n'est lue qu'au moment d'enregistrer.
 */
export const useTrafficLight = ({ askConfirm, showAlert, champsProjetRef } = {}) => {
    // Fallback : si showAlert n'est pas fourni, on retombe sur window.alert
    const alertFn = showAlert || (({ message }) => { window.alert(message); return Promise.resolve(); });
    const [intersectionName, setIntersectionName] = useState("Nouveau Carrefour");
    const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE);
    const [dependencyGap, setDependencyGap] = useState(20);
    const [biCarrefourSeparator, setBiCarrefourSeparator] = useState(null);
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
    const [actionColWidths, setActionColWidths] = useState({ description: 160, micro: 420, abrv: 38 });
    const [externalLinks, setExternalLinks] = useState([]);
    // Sélection mémorisée du comparateur de capacité (fenêtre « Comparer la
    // capacité des plans de feu ») : liste d'id de PF cochés (null = tous par
    // défaut) et jeu de trafic choisi ('__per_pf__' = jeu associé à chaque PF).
    const [capacityCompareSelection, setCapacityCompareSelection] = useState(null);
    const [capacityCompareDataset, setCapacityCompareDataset] = useState('__per_pf__');
    const [projectProperties, setProjectProperties] = useState(() => {
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
    const updateProjectProperty = useCallback((field, value) => {
        if (isEditLocked()) return;
        setProjectProperties(prev => ({ ...prev, [field]: value }));
    }, []);
    // Registres globaux de l'application (partagés entre projets)
    const [appCommunes, setAppCommunes] = useState(() => {
        try {
            const saved = safeLocalStorage.getItem('trafficAppCommunes');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [appMoaLogos, setAppMoaLogos] = useState(() => {
        try {
            const saved = safeLocalStorage.getItem('trafficAppMoaLogos');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });
    const [appMoeLogos, setAppMoeLogos] = useState(() => {
        try {
            const saved = safeLocalStorage.getItem('trafficAppMoeLogos');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });
    // Nom du projet (clé de sauvegarde), indépendant du nom du carrefour
    const [projectName, setProjectName] = useState(null);
    const currentProjectNameRef = useRef(null);
    const [globalTime, setGlobalTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // History for undo/redo functionality
    const [history, setHistory] = useState([]);
    const [redoHistory, setRedoHistory] = useState([]);
    const isUndoing = useRef(false);
    const isRedoing = useRef(false);
    const isDragging = useRef(false);

    // Groups State
    const createGroup = (id) => ({
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

    const [groups, setGroups] = useState(() => Array.from({ length: 5 }, (_, i) => createGroup(i + 1)));

    // Matrix: Size depends on number of groups.
    // We store as a URL-like generic object or always resize.
    // Let's keep it as 2D array, resizing when groups change.
    const [conflictMatrix, setConflictMatrix] = useState(() => Array.from({ length: 5 }, () => Array(5).fill('')));

    const setGroupCountInternal = (count) => {
        const newCount = Math.min(MAX_GROUPS, Math.max(1, parseInt(count) || 1));

        setGroups(prev => {
            const oldCount = prev.length;

            // Update action data when increasing group count
            if (newCount > oldCount) {
                setActionData(currentData => {
                    return currentData.map(row => {
                        const updatedRow = { ...row };
                        // Update plage1, plage2 if they equal old count
                        if (parseInt(row.plage1) === oldCount) {
                            updatedRow.plage1 = newCount.toString();
                        }
                        if (parseInt(row.plage2) === oldCount) {
                            updatedRow.plage2 = newCount.toString();
                        }
                        // Update actGf1, actGf1Gf2, actGf1Gf3, actGf1Gf4 if they equal old count
                        if (parseInt(row.actGf1?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1 = newCount.toString();
                        }
                        if (parseInt(row.actGf1Gf2?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1Gf2 = newCount.toString();
                        }
                        if (parseInt(row.actGf1Gf3?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1Gf3 = newCount.toString();
                        }
                        if (parseInt(row.actGf1Gf4?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
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
                const row = new Array(newCount).fill('');
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
    const moveGroup = (index, direction) => {
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
        const gfFields = ['gf', 'plage1', 'plage2', 'actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'];

        setActionData(currentData => {
            return currentData.map(row => {
                const newRow = { ...row };
                gfFields.forEach(field => {
                    const val = parseInt(newRow[field]);
                    if (val === gfA) {
                        newRow[field] = gfB.toString();
                    } else if (val === gfB) {
                        newRow[field] = gfA.toString();
                    }
                });
                return newRow;
            });
        });

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
                    newPf.data = newPf.data.map(row => {
                        const newRow = { ...row };
                        gfFields.forEach(field => {
                            const val = parseInt(newRow[field]);
                            if (val === gfA) {
                                newRow[field] = gfB.toString();
                            } else if (val === gfB) {
                                newRow[field] = gfA.toString();
                            }
                        });
                        return newRow;
                    });
                }

                return newPf;
            });
        });
    };

    // Move a group to a new position (after another group)
    // sourceId: the ID of the group to move
    // afterId: the ID of the group after which to insert (0 = insert at beginning)
    const moveGroupToPosition = (sourceId, afterId) => {
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
        const oldToNew = {};
        const newToOld = {};

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
            const newMatrix = Array(size).fill(null).map(() => Array(size).fill(0));

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
        const gfFields = ['gf', 'plage1', 'plage2', 'actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'];
        const size = groups.length;

        // Remap active PF tab data first
        setActionData(currentData => {
            return currentData.map(row => {
                const newRow = { ...row };
                gfFields.forEach(field => {
                    const val = parseInt(newRow[field]);
                    if (!isNaN(val) && val > 0 && val <= size) {
                        newRow[field] = oldToNew[val].toString();
                    }
                });
                return newRow;
            });
        });

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
                    const newMatrix = Array(pfSize).fill(null).map(() => Array(pfSize).fill(''));

                    for (let oldRow = 0; oldRow < pfSize; oldRow++) {
                        for (let oldCol = 0; oldCol < pfSize; oldCol++) {
                            const newRow = oldToNew[oldRow + 1] - 1;
                            const newCol = oldToNew[oldCol + 1] - 1;
                            if (newRow >= 0 && newRow < pfSize && newCol >= 0 && newCol < pfSize) {
                                newMatrix[newRow][newCol] = newPf.conflictMatrix[oldRow][oldCol];
                            }
                        }
                    }
                    newPf.conflictMatrix = newMatrix;
                }

                // Update GF references in action data for non-active tabs
                // (active tab already handled by setActionData above)
                if (pf.id !== activePFId && newPf.data && newPf.data.length > 0) {
                    newPf.data = newPf.data.map(row => {
                        const newRow = { ...row };
                        gfFields.forEach(field => {
                            const val = parseInt(newRow[field]);
                            if (!isNaN(val) && val > 0 && val <= size) {
                                newRow[field] = oldToNew[val].toString();
                            }
                        });
                        return newRow;
                    });
                }

                return newPf;
            });
        });

        // 5. Reorder traffic datasets (keyed by groupId)
        setTrafficDatasets(currentDatasets => {
            const newDatasets = {};
            Object.keys(currentDatasets).forEach(datasetKey => {
                const dataset = currentDatasets[datasetKey];
                const newDataset = {};
                Object.keys(dataset).forEach(oldGroupId => {
                    const oldId = parseInt(oldGroupId);
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

    // Helper: Check if two time ranges overlap in cyclic time
    const rangesOverlap = (start1, end1, start2, end2, cycle) => {
        // Normalize to cycle
        start1 = ((start1 % cycle) + cycle) % cycle;
        end1 = ((end1 % cycle) + cycle) % cycle;
        start2 = ((start2 % cycle) + cycle) % cycle;
        end2 = ((end2 % cycle) + cycle) % cycle;

        // Handle wrap-around cases
        const range1Wraps = end1 <= start1;
        const range2Wraps = end2 <= start2;

        if (!range1Wraps && !range2Wraps) {
            // Neither wraps: simple overlap check
            return start1 < end2 && start2 < end1;
        } else if (range1Wraps && !range2Wraps) {
            // Range 1 wraps: [start1, cycle) and [0, end1)
            return (start2 < end1) || (start2 >= start1);
        } else if (!range1Wraps && range2Wraps) {
            // Range 2 wraps
            return (start1 < end2) || (start1 >= start2);
        } else {
            // Both wrap: they definitely overlap
            return true;
        }
    };

    const updateGroupParams = (id, params) => {
        if (isEditLocked()) return;
        setGroups(prev => prev.map(g => {
            if (g.id !== id) return g;

            // Handle nested durations update specifically if needed, or spread top level
            // params can contain { type, minGreen, durations: { ... }, offset }

            let newG = { ...g, ...params };

            // If durations or cycle changed, recalc Red
            if (params.durations || params.offset !== undefined) {
                // Merge durations carefully
                const mergedDurations = { ...g.durations, ...(params.durations || {}) };

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
    };

    const setMatrixValue = (fromId, toId, value) => {
        if (isEditLocked()) return;
        setConflictMatrix(prev => {
            const next = prev.map(row => [...row]);
            // Guard against out of bounds if resizing happened async
            if (next[fromId - 1]) {
                // Keep empty string if value is empty, otherwise parse as integer
                const parsedValue = value === '' ? '' : parseInt(value);
                next[fromId - 1][toId - 1] = isNaN(parsedValue) ? '' : parsedValue;
            }
            return next;
        });
    };

    const getGroupState = useCallback((group, time) => {
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
        let intervalId;
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
    const pfSyncRefsResetRef = useRef(null);
    const resetPfSyncRefs = (newActivePFId) => {
        if (pfSyncRefsResetRef.current) pfSyncRefsResetRef.current(newActivePFId);
    };

    // Flag to prevent auto-save during project loading
    const isLoadingProjectRef = useRef(false);

    const loadProject = (name) => {
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
            const data = JSON.parse(raw);

            // Mémoriser le nom du projet (clé de sauvegarde)
            currentProjectNameRef.current = name;
            setProjectName(name);
            // Restaurer le nom du carrefour depuis les données (indépendant du nom du projet)
            if (data.intersectionName) setIntersectionName(data.intersectionName);

            // Migrate and validate groups structure for old projects
            if (data.groups) {
                const migratedGroups = data.groups.map((g, index) => {
                    // Ensure all required fields exist with proper defaults
                    const id = g.id !== undefined ? g.id : index + 1;

                    // Handle old duration formats
                    let durations = g.durations;
                    if (!durations || typeof durations !== 'object') {
                        // Old format might have green/orange/red directly on group
                        durations = {
                            green: g.green !== undefined ? g.green : (g.greenDuration !== undefined ? g.greenDuration : 10),
                            orange: g.orange !== undefined ? g.orange : 3,
                            red: g.red !== undefined ? g.red : 0
                        };
                    }
                    // Validate duration values
                    durations = {
                        green: !isNaN(durations.green) ? durations.green : 10,
                        orange: !isNaN(durations.orange) ? durations.orange : 3,
                        red: !isNaN(durations.red) ? durations.red : 0
                    };

                    return {
                        id,
                        name: g.name || `Groupe ${id}`,
                        type: g.type || 'VL',
                        courant: g.courant || '',
                        minGreen: g.minGreen !== undefined && !isNaN(g.minGreen) ? g.minGreen : 6,
                        durations,
                        offset: g.offset !== undefined && !isNaN(g.offset) ? g.offset : 0,
                        da: g.da || '',
                        phaseFlag: g.phaseFlag || '',
                        comment: g.comment || '',
                        commentColor: g.commentColor || '',
                        // Traffic Engineering Props
                        trafficStream: g.trafficStream || '',
                        laneCoef: g.laneCoef !== undefined ? g.laneCoef : 1,
                        trafficVol: g.trafficVol !== undefined ? g.trafficVol : 0,
                        effectiveGreen: g.effectiveGreen !== undefined ? g.effectiveGreen : 0,
                        usedCapacity: g.usedCapacity !== undefined ? g.usedCapacity : 0,
                        delay: g.delay !== undefined ? g.delay : 0,
                        queueLength: g.queueLength !== undefined ? g.queueLength : 0
                    };
                });
                setGroups(migratedGroups);
            }

            // Le cycle du PLAN ACTIF fait foi, pas celui du projet : cf.
            // cycleDuPlanActif. Prendre celui du projet faisait écraser le
            // cycle du plan par la recopie qui suit le chargement.
            setCycleLength(cycleDuPlanActif(data, DEFAULT_CYCLE));

            // Ensure conflict matrix matches group count
            const groupCount = data.groups ? data.groups.length : 0;
            if (data.conflictMatrix && groupCount > 0) {
                // Clean values outside valid range, resize to match group count
                // Minimum is 0 for Piéton/Cycliste from-group, 3 for others
                const loadedGroups = data.groups || [];
                const cleanedMatrix = Array.from({ length: groupCount }, (_, r) => {
                    return Array.from({ length: groupCount }, (_, c) => {
                        const val = data.conflictMatrix[r]?.[c];
                        if (val === undefined || val === null) return '';
                        const fromGroup = loadedGroups[r];
                        const minVal = (fromGroup && (fromGroup.type === 'Piéton' || fromGroup.type === 'P' || fromGroup.type === 'Cycliste' || fromGroup.type === 'CY')) ? 0 : 3;
                        const numericVal = typeof val === 'number' ? val : parseInt(val);
                        if (isNaN(numericVal) || numericVal < minVal || numericVal > 20) return '';
                        return numericVal;
                    });
                });
                setConflictMatrix(cleanedMatrix);
            } else if (groupCount > 0) {
                // No matrix in data, create empty one
                setConflictMatrix(Array.from({ length: groupCount }, () => new Array(groupCount).fill('')));
            }
            // Load action table data (pfTabs)
            if (data.pfTabs) {
                // Migrate and validate pfTabs structure
                const groupCount = data.groups ? data.groups.length : 0;
                const migratedPfTabs = data.pfTabs.map(pf => {
                    const migrated = { ...pf };

                    // Ensure data array exists
                    if (!migrated.data) {
                        migrated.data = [];
                    }

                    // Ensure diagram array exists with valid data
                    if (!migrated.diagram || !Array.isArray(migrated.diagram) || migrated.diagram.length === 0) {
                        // Initialize diagram from groups if available
                        if (data.groups) {
                            migrated.diagram = data.groups.map(g => ({
                                groupId: g.id,
                                offset: g.offset !== undefined && !isNaN(g.offset) ? g.offset : 0,
                                greenDuration: g.durations?.green !== undefined && !isNaN(g.durations.green) ? g.durations.green : 10,
                                da: g.da || '',
                                comment: g.comment || '',
                                commentColor: g.commentColor || '#000000',
                                phaseFlag: g.phaseFlag || ''
                            }));
                        } else {
                            migrated.diagram = [];
                        }
                    } else {
                        // Validate existing diagram entries
                        migrated.diagram = migrated.diagram.map(d => ({
                            ...d,
                            offset: d.offset !== undefined && !isNaN(d.offset) ? d.offset : 0,
                            greenDuration: d.greenDuration !== undefined && !isNaN(d.greenDuration) ? d.greenDuration : 10
                        }));
                    }

                    // Ensure conflictMatrix exists with proper size
                    if (!migrated.conflictMatrix || !Array.isArray(migrated.conflictMatrix) || migrated.conflictMatrix.length === 0) {
                        // Initialize from main conflict matrix or create empty
                        if (data.conflictMatrix && data.conflictMatrix.length > 0) {
                            migrated.conflictMatrix = data.conflictMatrix.map(row => [...row]);
                        } else if (groupCount > 0) {
                            migrated.conflictMatrix = Array.from({ length: groupCount }, () =>
                                new Array(groupCount).fill('')
                            );
                        }
                    }

                    // Ensure remarques field exists
                    if (migrated.remarques === undefined) {
                        migrated.remarques = '';
                    }

                    return migrated;
                });
                setPfTabs(migratedPfTabs);
                if (data.activePFId) setActivePFIdRaw(data.activePFId);
            } else if (data.actionData) {
                // Handle old format for backward compatibility
                const groupCount = data.groups ? data.groups.length : 0;
                const initialDiagram = data.groups ? data.groups.map(g => ({
                    groupId: g.id,
                    offset: g.offset !== undefined && !isNaN(g.offset) ? g.offset : 0,
                    greenDuration: g.durations?.green !== undefined && !isNaN(g.durations.green) ? g.durations.green : 10,
                    da: g.da || '',
                    comment: g.comment || '',
                    commentColor: g.commentColor || '#000000'
                })) : [];
                const initialMatrix = data.conflictMatrix && data.conflictMatrix.length > 0
                    ? data.conflictMatrix.map(row => [...row])
                    : (groupCount > 0 ? Array.from({ length: groupCount }, () => new Array(groupCount).fill('')) : []);
                setPfTabs([{
                    id: 1,
                    name: 'PF1',
                    data: data.actionData,
                    diagram: initialDiagram,
                    conflictMatrix: initialMatrix,
                    remarques: ''
                }]);
                setActivePFIdRaw(1);
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
            {
                const acw = data.actionColWidths || {};
                const clamp = (v, lo, hi, def) => {
                    const n = Number(v);
                    if (!isFinite(n)) return def;
                    return Math.min(hi, Math.max(lo, Math.round(n)));
                };
                setActionColWidths({
                    description: clamp(acw.description, 100, 350, 160),
                    micro: clamp(acw.micro, 300, 700, 420),
                    abrv: clamp(acw.abrv, 38, 75, 38)
                });
            }
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
            // avaN���-���jםw)ښ'-��kz˥���)ڗ_5�����蠆םn�`z޸�M+z���+a����j�,