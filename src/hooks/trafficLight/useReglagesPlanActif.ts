/**
 * Réglages rangés dans le plan de feu actif : champs personnalisés des
 * conditions de micro-régulation et paramètres du phasage bulle. Sous-hook
 * de useTrafficLight.
 */
import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PlanDeFeu } from '../../types/projet';

interface EntreesReglagesPlan {
    pfTabs: PlanDeFeu[];
    setPfTabs: Dispatch<SetStateAction<PlanDeFeu[]>>;
    activePFId: number;
}

export const useReglagesPlanActif = ({ pfTabs, setPfTabs, activePFId }: EntreesReglagesPlan) => {
    // Get current microCustomFields based on active PF (up to 60 fields)
    const MAX_MICRO_FIELDS = 60;
    const microCustomFields = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        const fields = activePF?.microCustomFields || [];
        // Ensure array has up to MAX_MICRO_FIELDS slots
        const padded = [...fields];
        while (padded.length < MAX_MICRO_FIELDS) padded.push('');
        return padded.slice(0, MAX_MICRO_FIELDS);
    }, [pfTabs, activePFId]);

    // Update microCustomFields for the active PF
    const updateMicroCustomField = useCallback((index: number, value: string) => {
        setPfTabs(prev => prev.map(pf => {
            if (pf.id !== activePFId) return pf;
            const current = pf.microCustomFields || [];
            const padded = [...current];
            while (padded.length < MAX_MICRO_FIELDS) padded.push('');
            padded[index] = value;
            // Trim trailing empty strings to keep storage lean
            let lastFilled = padded.length - 1;
            while (lastFilled >= 0 && padded[lastFilled] === '') lastFilled--;
            return { ...pf, microCustomFields: padded.slice(0, lastFilled + 1) };
        }));
    }, [activePFId, setPfTabs]);

    // Get phasage bulle count for active PF
    const phasageBulleCount = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF?.phasageBulleCount ?? 4;
    }, [pfTabs, activePFId]);

    // Get phasage bulle times for active PF
    const phasageBulleTimes = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        // Tout à zéro par défaut : un plan jamais configuré affiche alors des
        // bulles identiques, signal qu'il n'est pas renseigné. Des instants
        // pré-remplis ressemblaient à un réglage plausible sans en être un.
        return activePF?.phasageBulleTimes || [0, 0, 0, 0, 0, 0];
    }, [pfTabs, activePFId]);

    // Update phasage bulle count for active PF
    const setPhasageBulleCount = useCallback((count: number) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? { ...pf, phasageBulleCount: count }
                : pf
        ));
    }, [activePFId, setPfTabs]);

    // Update phasage bulle times for active PF
    const setPhasageBulleTimes = useCallback((times: number[]) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? { ...pf, phasageBulleTimes: times }
                : pf
        ));
    }, [activePFId, setPfTabs]);

    // Get phasage bulle scale factors for active PF
    const phasageBubbleScale = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF?.phasageBubbleScale ?? 100;
    }, [pfTabs, activePFId]);

    const phasageEllipseScale = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF?.phasageEllipseScale ?? 100;
    }, [pfTabs, activePFId]);

    // Update phasage bulle scale factors for active PF
    const setPhasageBubbleScale = useCallback((scale: number) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? { ...pf, phasageBubbleScale: scale }
                : pf
        ));
    }, [activePFId, setPfTabs]);

    const setPhasageEllipseScale = useCallback((scale: number) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? { ...pf, phasageEllipseScale: scale }
                : pf
        ));
    }, [activePFId, setPfTabs]);

    // Get/set phasage bulle ratio for active PF
    const phasageBubbleRatio = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF?.phasageBubbleRatio ?? 100;
    }, [pfTabs, activePFId]);

    const setPhasageBubbleRatio = useCallback((ratio: number) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? { ...pf, phasageBubbleRatio: ratio }
                : pf
        ));
    }, [activePFId, setPfTabs]);

    return {
        microCustomFields, updateMicroCustomField,
        phasageBulleCount, setPhasageBulleCount, phasageBulleTimes, setPhasageBulleTimes,
        phasageBubbleScale, setPhasageBubbleScale, phasageEllipseScale, setPhasageEllipseScale,
        phasageBubbleRatio, setPhasageBubbleRatio
    };
};
