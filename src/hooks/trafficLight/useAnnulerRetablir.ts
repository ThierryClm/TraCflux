/**
 * Annuler / Rétablir : instantanés pris avant chaque modification, et
 * glisser du diagramme qui n'en prend qu'un au départ. Sous-hook de
 * useTrafficLight ; l'état de l'historique reste déclaré par celui-ci, qui
 * le vide à l'ouverture d'un projet.
 */
import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Groupe, Matrice, PlanDeFeu } from '../../types/projet';
import type { EtatHistorique } from './types';

export const MAX_HISTORY_SIZE = 50;

interface EntreesAnnulerRetablir {
    groups: Groupe[];
    setGroups: Dispatch<SetStateAction<Groupe[]>>;
    conflictMatrix: Matrice;
    setConflictMatrix: Dispatch<SetStateAction<Matrice>>;
    pfTabs: PlanDeFeu[];
    setPfTabs: Dispatch<SetStateAction<PlanDeFeu[]>>;
    activePFId: number;
    setActivePFIdRaw: Dispatch<SetStateAction<number>>;
    cycleLength: number;
    setCycleLength: Dispatch<SetStateAction<number>>;
    intersectionName: string;
    setIntersectionName: Dispatch<SetStateAction<string>>;
    history: EtatHistorique[];
    setHistory: Dispatch<SetStateAction<EtatHistorique[]>>;
    redoHistory: EtatHistorique[];
    setRedoHistory: Dispatch<SetStateAction<EtatHistorique[]>>;
    isUndoing: MutableRefObject<boolean>;
    isRedoing: MutableRefObject<boolean>;
    isDragging: MutableRefObject<boolean>;
    resetPfSyncRefs: (newActivePFId: number) => void;
}

export const useAnnulerRetablir = ({
    groups, setGroups, conflictMatrix, setConflictMatrix, pfTabs, setPfTabs,
    activePFId, setActivePFIdRaw, cycleLength, setCycleLength, intersectionName, setIntersectionName,
    history, setHistory, redoHistory, setRedoHistory, isUndoing, isRedoing, isDragging, resetPfSyncRefs
}: EntreesAnnulerRetablir) => {
    // Save current state to history (for undo)
    const saveToHistory = useCallback(() => {
        if (isUndoing.current || isRedoing.current) return; // Don't save during undo/redo

        const currentState: EtatHistorique = {
            groups: JSON.parse(JSON.stringify(groups)),
            conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix)),
            pfTabs: JSON.parse(JSON.stringify(pfTabs)),
            activePFId,
            cycleLength,
            intersectionName
        };

        setHistory(prev => {
            const newHistory = [...prev, currentState];
            // Limit history size
            if (newHistory.length > MAX_HISTORY_SIZE) {
                return newHistory.slice(-MAX_HISTORY_SIZE);
            }
            return newHistory;
        });

        // Clear redo history when a new action is performed
        setRedoHistory([]);
    }, [groups, conflictMatrix, pfTabs, activePFId, cycleLength, intersectionName, isUndoing, isRedoing, setHistory, setRedoHistory]);

    // Start drag - save history once at the beginning
    const startDrag = useCallback(() => {
        if (!isDragging.current) {
            saveToHistory();
            isDragging.current = true;
        }
    }, [saveToHistory, isDragging]);

    // End drag
    const endDrag = useCallback(() => {
        isDragging.current = false;
    }, [isDragging]);

    // Undo function
    const undo = useCallback(() => {
        if (history.length === 0) return false;

        isUndoing.current = true;

        // Save current state to redo history before restoring
        const currentState: EtatHistorique = {
            groups: JSON.parse(JSON.stringify(groups)),
            conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix)),
            pfTabs: JSON.parse(JSON.stringify(pfTabs)),
            activePFId,
            cycleLength,
            intersectionName
        };
        setRedoHistory(prev => [...prev, currentState]);

        const previousState = history[history.length - 1];

        // Restore previous state
        setGroups(previousState.groups);
        setConflictMatrix(previousState.conflictMatrix);
        if (previousState.pfTabs) {
            setPfTabs(previousState.pfTabs);
            setActivePFIdRaw(previousState.activePFId);
        } else if (previousState.actionData) {
            // Handle old history format
            const anciennesActions = previousState.actionData;
            setPfTabs(prev => prev.map(pf =>
                pf.id === activePFId ? { ...pf, data: anciennesActions } : pf
            ));
        }
        setCycleLength(previousState.cycleLength);
        setIntersectionName(previousState.intersectionName);

        // Une annulation réinstalle d'un bloc les groupes, le cycle, les plans
        // de feu ET le plan actif. Sans cette remise à zéro, la recopie
        // « groupes → PF actif » y voyait un changement d'onglet : elle écrivait
        // le cycle et le diagramme qu'on venait de restaurer dans le plan de feu
        // actif AVANT l'annulation, écrasant ce que l'historique venait de
        // rendre. Annuler sur un plan revenait ainsi à abîmer l'autre.
        resetPfSyncRefs(previousState.activePFId || activePFId);

        // Remove the last history entry
        setHistory(prev => prev.slice(0, -1));

        // Reset the flag after a short delay
        setTimeout(() => {
            isUndoing.current = false;
        }, 100);

        return true;
        // resetPfSyncRefs ne lit qu'une réf : inutile de recréer la fonction à chaque rendu.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, groups, conflictMatrix, pfTabs, activePFId, cycleLength, intersectionName,
        isUndoing, setHistory, setRedoHistory, setGroups, setConflictMatrix, setPfTabs, setActivePFIdRaw, setCycleLength, setIntersectionName]);

    // Redo function
    const redo = useCallback(() => {
        if (redoHistory.length === 0) return false;

        isRedoing.current = true;

        // Save current state to history before restoring
        const currentState: EtatHistorique = {
            groups: JSON.parse(JSON.stringify(groups)),
            conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix)),
            pfTabs: JSON.parse(JSON.stringify(pfTabs)),
            activePFId,
            cycleLength,
            intersectionName
        };
        setHistory(prev => [...prev, currentState]);

        const nextState = redoHistory[redoHistory.length - 1];

        // Restore next state
        setGroups(nextState.groups);
        setConflictMatrix(nextState.conflictMatrix);
        if (nextState.pfTabs) {
            setPfTabs(nextState.pfTabs);
            setActivePFIdRaw(nextState.activePFId);
        }
        setCycleLength(nextState.cycleLength);
        setIntersectionName(nextState.intersectionName);

        // Même raison que dans undo : le rétablissement réinstalle le plan actif
        // en même temps que l'état, la synchronisation ne doit pas le prendre
        // pour un changement d'onglet.
        resetPfSyncRefs(nextState.activePFId || activePFId);

        // Remove the last redo history entry
        setRedoHistory(prev => prev.slice(0, -1));

        // Reset the flag after a short delay
        setTimeout(() => {
            isRedoing.current = false;
        }, 100);

        return true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [redoHistory, groups, conflictMatrix, pfTabs, activePFId, cycleLength, intersectionName,
        isRedoing, setHistory, setRedoHistory, setGroups, setConflictMatrix, setPfTabs, setActivePFIdRaw, setCycleLength, setIntersectionName]);

    return { saveToHistory, startDrag, endDrag, undo, redo };
};
