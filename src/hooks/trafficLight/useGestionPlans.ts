/**
 * Onglets des plans de feux : dupliquer, supprimer, renommer, colorer,
 * annoter et réordonner. Sous-hook de useTrafficLight.
 */
import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { MAX_PF, createEmptyActionData } from '../../utils/pfHelpers';
import type { ActionMicro, LigneDiagramme, Matrice, PlanDeFeu } from '../../types/projet';

interface EntreesGestionPlans {
    pfTabs: PlanDeFeu[];
    setPfTabs: Dispatch<SetStateAction<PlanDeFeu[]>>;
    activePFId: number;
    setActivePFId: (pfId: number) => void;
    actionData: ActionMicro[];
    conflictMatrix: Matrice;
    cycleLength: number;
    dossierReadOnlyRef: MutableRefObject<boolean>;
}

export const useGestionPlans = ({
    pfTabs, setPfTabs, activePFId, setActivePFId, actionData, conflictMatrix, cycleLength, dossierReadOnlyRef
}: EntreesGestionPlans) => {
    // Duplicate current PF. Renvoie null si la limite MAX_PF est atteinte
    // (l'appelant affiche le message d'erreur).
    const duplicatePF = useCallback(() => {
        if (dossierReadOnlyRef.current) return;
        if (pfTabs.length >= MAX_PF) return null;
        const nextId = Math.max(...pfTabs.map(pf => pf.id)) + 1;
        const newName = `PF${nextId}`;
        const currentData = JSON.parse(JSON.stringify(actionData));
        const currentPF = pfTabs.find(pf => pf.id === activePFId);
        const currentRemarques = currentPF?.remarques || '';
        const currentDiagram = currentPF?.diagram ? JSON.parse(JSON.stringify(currentPF.diagram)) : [];
        const currentCycleLength = currentPF?.cycleLength || cycleLength;
        const currentMicro = currentPF?.microCustomFields ? JSON.parse(JSON.stringify(currentPF.microCustomFields)) : [];
        setPfTabs(prev => [...prev, {
            id: nextId,
            name: newName,
            data: currentData,
            remarques: currentRemarques,
            conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix)),
            diagram: currentDiagram,
            cycleLength: currentCycleLength,
            microCustomFields: currentMicro
        }]);
        setActivePFId(nextId);
        return nextId;
    }, [pfTabs, actionData, activePFId, conflictMatrix, cycleLength, dossierReadOnlyRef, setPfTabs, setActivePFId]);

    // Nouveau plan de feu vierge, point de départ de l'assistant : verts, DA,
    // conditions et variables micro vides ; même carrefour (groupes, matrice).
    // Renvoie l'id créé, ou null si la limite MAX_PF est atteinte.
    const nouveauPF = useCallback(() => {
        if (dossierReadOnlyRef.current) return null;
        if (pfTabs.length >= MAX_PF) return null;
        const nextId = Math.max(...pfTabs.map(pf => pf.id)) + 1;
        const noms = new Set(pfTabs.map(pf => pf.name));
        let nom = 'Nouveau PF';
        for (let n = 2; noms.has(nom); n++) nom = `Nouveau PF ${n}`;
        const currentPF = pfTabs.find(pf => pf.id === activePFId);
        const diagram: LigneDiagramme[] = (currentPF?.diagram || []).map(d => ({
            groupId: d.groupId, offset: 0, greenDuration: 0, da: '', comment: '', commentColor: ''
        }));
        setPfTabs(prev => [...prev, {
            id: nextId,
            name: nom,
            data: createEmptyActionData(),
            remarques: '',
            conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix)),
            diagram,
            cycleLength: currentPF?.cycleLength || cycleLength,
            microCustomFields: []
        }]);
        setActivePFId(nextId);
        return nextId;
    }, [pfTabs, activePFId, conflictMatrix, cycleLength, dossierReadOnlyRef, setPfTabs, setActivePFId]);

    // Delete a PF (cannot delete if only one remains)
    const deletePF = useCallback((pfId: number) => {
        if (dossierReadOnlyRef.current) return;
        if (pfTabs.length <= 1) return false;
        setPfTabs(prev => prev.filter(pf => pf.id !== pfId));
        if (activePFId === pfId) {
            const remaining = pfTabs.filter(pf => pf.id !== pfId);
            setActivePFId(remaining[0].id);
        }
        return true;
    }, [pfTabs, activePFId, dossierReadOnlyRef, setPfTabs, setActivePFId]);

    // Rename a PF
    const renamePF = useCallback((pfId: number, newName: string) => {
        if (dossierReadOnlyRef.current) return;
        setPfTabs(prev => prev.map(pf =>
            pf.id === pfId ? { ...pf, name: newName } : pf
        ));
    }, [dossierReadOnlyRef, setPfTabs]);

    // Set PF color (for validation)
    const setPFColor = useCallback((pfId: number, color: string | null) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === pfId ? { ...pf, color: color } : pf
        ));
    }, [setPfTabs]);

    // Update remarques for active PF
    const updatePFRemarques = useCallback((remarques: string) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId ? { ...pf, remarques: remarques } : pf
        ));
    }, [activePFId, setPfTabs]);

    // Reorder PF tabs (drag & drop)
    const reorderPF = useCallback((fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        setPfTabs(prev => {
            const newTabs = [...prev];
            const [movedTab] = newTabs.splice(fromIndex, 1);
            newTabs.splice(toIndex, 0, movedTab);
            return newTabs;
        });
    }, [setPfTabs]);

    return { duplicatePF, nouveauPF, deletePF, renamePF, setPFColor, updatePFRemarques, reorderPF };
};
