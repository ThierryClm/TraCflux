/**
 * Jeux de trafic du projet (HPM, HPS, HC, Estimation, Projection et jeux
 * personnalisés) : leur état, leurs noms affichés, et les opérations du
 * tableau Données Trafic. Sous-hooks de useTrafficLight.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { buildTrafficDatasetNames, trafficDatasetHasData, planSuppressionJeu } from '../../utils/trafficHelpers';
import type { Groupe, JeuTrafic, PlanDeFeu } from '../../types/projet';
import { safeLocalStorage } from './stockageLocal';
import type { JeuxTrafic } from './types';

// Traffic dataset types
export const TRAFFIC_DATASETS = ['HPM', 'HPS', 'HC', 'Estimation', 'Projection'];

// Create empty traffic data for a group (only trafficVol varies by dataset)
export const createEmptyTrafficData = () => ({
    trafficVol: 0
});

/** État des jeux de trafic, persistant entre deux sessions pour le jeu actif et les noms. */
export const useEtatJeuxTrafic = () => {
    // Traffic datasets state (HPM, HPS, HC, Estimation, Projection)
    const [activeTrafficDataset, setActiveTrafficDataset] = useState(() => {
        return safeLocalStorage.getItem('trafficActiveDataset') || 'HPM';
    });
    const [customTrafficDatasetNames, setCustomTrafficDatasetNames] = useState<string[]>(() => {
        try {
            const saved = safeLocalStorage.getItem('customTrafficDatasetNames');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    // Mapping PF id → dataset actif (choix conservé par PF)
    const [pfTrafficDatasetMap, setPfTrafficDatasetMap] = useState<Record<string, string>>(() => {
        try {
            const saved = safeLocalStorage.getItem('pfTrafficDatasetMap');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    // Ref pour accéder au mapping PF→dataset à jour dans le wrapper setActivePFId
    const pfTrafficDatasetMapRef = useRef(pfTrafficDatasetMap);
    pfTrafficDatasetMapRef.current = pfTrafficDatasetMap;

    // Initialize traffic datasets with empty data for all groups
    const createInitialTrafficDatasets = (groupCount: number) => {
        const datasets: JeuxTrafic = {};
        TRAFFIC_DATASETS.forEach(ds => {
            datasets[ds] = {};
            for (let i = 1; i <= groupCount; i++) {
                datasets[ds][i] = createEmptyTrafficData();
            }
        });
        return datasets;
    };

    const [trafficDatasets, setTrafficDatasets] = useState<JeuxTrafic>(() => createInitialTrafficDatasets(5));

    return {
        activeTrafficDataset, setActiveTrafficDataset,
        customTrafficDatasetNames, setCustomTrafficDatasetNames,
        pfTrafficDatasetMap, setPfTrafficDatasetMap, pfTrafficDatasetMapRef,
        trafficDatasets, setTrafficDatasets
    };
};

interface EntreesNomsJeux {
    pfTabs: PlanDeFeu[];
    pfTrafficDatasetMap: Record<string, string>;
    customTrafficDatasetNames: string[];
    trafficDatasets: JeuxTrafic;
    activeTrafficDataset: string;
    groups: Groupe[];
}

/** Noms des jeux proposés dans la liste, et ceux qui ont des volumes (sources de copie). */
export const useNomsJeuxTrafic = ({
    pfTabs, pfTrafficDatasetMap, customTrafficDatasetNames, trafficDatasets, activeTrafficDataset, groups
}: EntreesNomsJeux) => {
    const trafficDatasetNames = useMemo(() => {
        if (!pfTabs || pfTabs.length === 0) return TRAFFIC_DATASETS;
        return buildTrafficDatasetNames(
            pfTabs,
            pfTrafficDatasetMap,
            customTrafficDatasetNames,
            trafficDatasets,
            activeTrafficDataset
        );
    }, [pfTabs, pfTrafficDatasetMap, customTrafficDatasetNames, trafficDatasets, activeTrafficDataset]);

    const trafficDatasetSourceNames = useMemo(() => {
        const groupIds = groups.map(group => group.id);
        return trafficDatasetNames.filter(name =>
            trafficDatasetHasData(trafficDatasets[name], groupIds)
        );
    }, [trafficDatasetNames, trafficDatasets, groups]);

    return { trafficDatasetNames, trafficDatasetSourceNames };
};

interface EntreesOperationsJeux extends EntreesNomsJeux {
    setTrafficDatasets: Dispatch<SetStateAction<JeuxTrafic>>;
    setActiveTrafficDataset: Dispatch<SetStateAction<string>>;
    setCustomTrafficDatasetNames: Dispatch<SetStateAction<string[]>>;
    setPfTrafficDatasetMap: Dispatch<SetStateAction<Record<string, string>>>;
    setCapacityCompareDataset: Dispatch<SetStateAction<string>>;
    trafficDatasetNames: string[];
    activePFId: number;
    isEditLocked: () => boolean;
}

/** Lecture, saisie, copie, ajout et suppression des jeux ; persistance du choix par plan. */
export const useOperationsJeuxTrafic = ({
    trafficDatasets, setTrafficDatasets,
    activeTrafficDataset, setActiveTrafficDataset,
    customTrafficDatasetNames, setCustomTrafficDatasetNames,
    pfTrafficDatasetMap, setPfTrafficDatasetMap,
    setCapacityCompareDataset, trafficDatasetNames,
    pfTabs, groups, activePFId, isEditLocked
}: EntreesOperationsJeux) => {
    // Save traffic datasets to localStorage
    useEffect(() => {
        safeLocalStorage.setItem('trafficActiveDataset', activeTrafficDataset);
        safeLocalStorage.setItem('customTrafficDatasetNames', JSON.stringify(customTrafficDatasetNames));
        safeLocalStorage.setItem('pfTrafficDatasetMap', JSON.stringify(pfTrafficDatasetMap));
    }, [activeTrafficDataset, customTrafficDatasetNames, pfTrafficDatasetMap]);

    // Mémoriser le choix du dataset pour le PF courant
    useEffect(() => {
        if (activePFId && activeTrafficDataset) {
            setPfTrafficDatasetMap(prev => {
                if (prev[activePFId] === activeTrafficDataset) return prev;
                return { ...prev, [activePFId]: activeTrafficDataset };
            });
        }
    }, [activeTrafficDataset, activePFId, setPfTrafficDatasetMap]);

    // Update traffic data for a specific group in the active dataset
    const updateTrafficData = useCallback((groupId: number, field: keyof JeuTrafic[string], value: number | string) => {
        if (isEditLocked()) return;
        setTrafficDatasets(prev => {
            const newDatasets = { ...prev };
            if (!newDatasets[activeTrafficDataset]) {
                newDatasets[activeTrafficDataset] = {};
            }
            if (!newDatasets[activeTrafficDataset][groupId]) {
                newDatasets[activeTrafficDataset][groupId] = createEmptyTrafficData();
            }
            newDatasets[activeTrafficDataset][groupId] = {
                ...newDatasets[activeTrafficDataset][groupId],
                [field]: value
            };
            return newDatasets;
        });
        // isEditLocked ne lit que des réfs : inutile de recréer la fonction à chaque rendu.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTrafficDataset, setTrafficDatasets]);

    // Get traffic data for a specific group in the active dataset
    const getTrafficData = useCallback((groupId: number) => {
        if (!trafficDatasets[activeTrafficDataset]) {
            return createEmptyTrafficData();
        }
        return trafficDatasets[activeTrafficDataset][groupId] || createEmptyTrafficData();
    }, [trafficDatasets, activeTrafficDataset]);

    // Copy traffic data from one dataset to another
    const copyTrafficDataset = useCallback((sourceDataset: string, targetDataset: string) => {
        setTrafficDatasets(prev => {
            const source = prev[sourceDataset];
            if (!source || sourceDataset === targetDataset) return prev;
            const target = { ...prev[targetDataset] };
            Object.keys(source).forEach(groupId => {
                target[groupId] = { ...source[groupId] };
            });
            return { ...prev, [targetDataset]: target };
        });
    }, [setTrafficDatasets]);

    const addCustomTrafficDataset = useCallback((name: string) => {
        if (!name || trafficDatasetNames.includes(name)) return;
        setCustomTrafficDatasetNames(prev => [...prev, name]);
        // Initialiser les données vides pour ce nouveau jeu
        setTrafficDatasets(prev => {
            const newDatasets = { ...prev };
            newDatasets[name] = {};
            groups.forEach(g => {
                newDatasets[name][g.id] = createEmptyTrafficData();
            });
            return newDatasets;
        });
    }, [trafficDatasetNames, groups, setCustomTrafficDatasetNames, setTrafficDatasets]);

    /** Ce que supprimer le jeu impliquerait : plans concernés, remplaçant, ou refus. */
    const infoSuppressionJeuTrafic = useCallback((nom: string) => planSuppressionJeu(
        nom, trafficDatasetNames, pfTabs, pfTrafficDatasetMap, trafficDatasets, groups.map(g => g.id)
    ), [trafficDatasetNames, pfTabs, pfTrafficDatasetMap, trafficDatasets, groups]);

    /**
     * Supprime un jeu de trafic : ses volumes, son nom personnalisé, et son
     * rattachement aux plans, qui passent sur le jeu remplaçant. Un jeu
     * standard (HPM, HPS…) revient vide, et ne reparaît dans la liste qu'une
     * fois rempli.
     */
    const supprimerJeuTrafic = useCallback((nom: string) => {
        if (isEditLocked()) return;
        const { refus, remplacement } = infoSuppressionJeuTrafic(nom);
        if (refus) return;
        setTrafficDatasets(prev => {
            const suivants = { ...prev };
            delete suivants[nom];
            return suivants;
        });
        setCustomTrafficDatasetNames(prev => prev.filter(n => n !== nom));
        setPfTrafficDatasetMap(prev => {
            const suivant: Record<string, string> = {};
            pfTabs.forEach(pf => {
                const jeu = prev[String(pf.id)] || pf.name;
                if (jeu === nom) suivant[String(pf.id)] = remplacement;
                else if (prev[String(pf.id)]) suivant[String(pf.id)] = prev[String(pf.id)];
            });
            return suivant;
        });
        setCapacityCompareDataset(prev => prev === nom ? '__per_pf__' : prev);
        if (activeTrafficDataset === nom) setActiveTrafficDataset(remplacement);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [infoSuppressionJeuTrafic, pfTabs, activeTrafficDataset]);

    // Ensure traffic datasets have entries for all groups when group count changes
    useEffect(() => {
        setTrafficDatasets(prev => {
            const newDatasets = { ...prev };
            let changed = false;
            TRAFFIC_DATASETS.forEach(ds => {
                if (!newDatasets[ds]) {
                    newDatasets[ds] = {};
                    changed = true;
                }
                groups.forEach(g => {
                    if (!newDatasets[ds][g.id]) {
                        newDatasets[ds][g.id] = createEmptyTrafficData();
                        changed = true;
                    }
                });
            });
            return changed ? newDatasets : prev;
        });
    }, [groups, setTrafficDatasets]);


    return {
        updateTrafficData, getTrafficData, copyTrafficDataset, addCustomTrafficDataset,
        infoSuppressionJeuTrafic, supprimerJeuTrafic
    };
};
