/**
 * Scénarios de simulation du plan de feu actif : nom, actions cochées et
 * scénarios enregistrés, tous rangés dans le plan. Sous-hook de useTrafficLight.
 */
import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
    scenariosDuPlan, scenarioFixeDesCases,
    choisirScenario, quitterScenario, creerScenario, enregistrerScenario, supprimerScenario
} from '../../simulation';
import type { PlanDeFeu } from '../../types/projet';

interface EntreesScenarios {
    pfTabs: PlanDeFeu[];
    setPfTabs: Dispatch<SetStateAction<PlanDeFeu[]>>;
    activePFId: number;
    isEditLocked: () => boolean;
}

export const useScenariosSimulation = ({ pfTabs, setPfTabs, activePFId, isEditLocked }: EntreesScenarios) => {
    // Simulation functions
    //
    // Le scénario — son nom et les actions cochées — appartient au PLAN DE FEU,
    // et non à la session. Il était tenu dans un état local, perdu à chaque
    // fermeture : on retrouvait un projet avec ses actions de micro-régulation
    // saisies mais plus aucune trace de la combinaison qu'on avait retenue,
    // ni de son intitulé.
    //
    // Il n'y a délibérément PAS de second état recopié vers l'onglet actif : la
    // valeur affichée EST celle du plan. Les recopies miroir de ce fichier ont
    // coûté trois défauts d'intégrité en septembre 2026 — un plan héritant du
    // cycle d'un autre — et rien ici n'en justifie une de plus.
    const planActif = useMemo(
        () => pfTabs.find(pf => pf.id === activePFId) || null,
        [pfTabs, activePFId]);

    const simulationSelectedActions = useMemo(
        () => (Array.isArray(planActif?.simulationActions) ? planActif.simulationActions : []),
        [planActif]);

    const simulationName = planActif?.simulationName || '';

    const simulationScenarios = useMemo(() => scenariosDuPlan(planActif), [planActif]);

    /**
     * Écrit dans le plan de feu actif, seul dépositaire du scénario. La liste
     * des scénarios est réécrite à chaque fois : un projet d'avant les
     * scénarios multiples y fige ainsi son scénario unique dès la première
     * case touchée, faute de quoi ce scénario suivrait les cases à l'écran et
     * ne paraîtrait jamais modifié.
     */
    const ecrireScenario = useCallback((maj: (actuelles: number[], pf: PlanDeFeu) => Partial<PlanDeFeu> | null) => {
        setPfTabs(prev => prev.map(pf => {
            if (pf.id !== activePFId) return pf;
            const actuelles = Array.isArray(pf.simulationActions) ? pf.simulationActions : [];
            const changement = maj(actuelles, pf);
            if (!changement) return pf;
            return { ...pf, simulationScenarios: scenariosDuPlan(pf), ...changement };
        }));
    }, [activePFId, setPfTabs]);

    /** Ouvre un scénario enregistré ; '' revient à « Sans titre ». */
    const choisirScenarioSimulation = useCallback((nom: string) => {
        ecrireScenario((_, pf) => nom ? choisirScenario(pf, nom) : quitterScenario(pf));
    }, [ecrireScenario]);

    // Créer, enregistrer, supprimer changent le contenu du plan : refusés,
    // comme le titre l'était, sur un plan ou un dossier en lecture seule.
    const creerScenarioSimulation = useCallback((titre: string) => {
        if (isEditLocked()) return;
        ecrireScenario((_, pf) => creerScenario(pf, titre));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ecrireScenario]);

    const enregistrerScenarioSimulation = useCallback((titre: string) => {
        if (isEditLocked()) return;
        ecrireScenario((_, pf) => enregistrerScenario(pf, titre));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ecrireScenario]);

    const supprimerScenarioSimulation = useCallback(() => {
        if (isEditLocked()) return;
        ecrireScenario((_, pf) => supprimerScenario(pf));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ecrireScenario]);

    const toggleSimulationAction = useCallback((actionId: number) => {
        // Sans scénario choisi, le panneau affiche le scénario fixe des cases :
        // la première case touchée le retient, pour qu'il paraisse modifié.
        ecrireScenario((actuelles, pf) => ({
            simulationName: pf.simulationName || scenarioFixeDesCases(actuelles, pf.data),
            simulationActions: actuelles.includes(actionId)
                ? actuelles.filter(id => id !== actionId)
                : [...actuelles, actionId]
        }));
    }, [ecrireScenario]);

    return {
        simulationSelectedActions, simulationName, simulationScenarios,
        choisirScenarioSimulation, creerScenarioSimulation, enregistrerScenarioSimulation,
        supprimerScenarioSimulation, toggleSimulationAction
    };
};
