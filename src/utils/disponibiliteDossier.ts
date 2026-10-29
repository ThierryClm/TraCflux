import type { PlanDeFeu } from '../types/projet';
import { PAR_PLAN, jeuDuPlan, jeuRenseigne, type DonneesTrafic } from './comparaisonCapacite';

/**
 * Sections du dossier imprimé qui n'ont rien à montrer. Leur case reste en
 * place dans la boîte d'impression, mais grisée et décochée, et la section
 * ne s'imprime pas — même cochée dans un dossier enregistré auparavant.
 */

/** Image du carrefour chargée. */
export const imageRenseignee = (image: string | null | undefined): boolean => !!image;

/** Phasage bulle : image et flèches présentes, et au moins un instant de bulle non nul. */
export const phasageRenseigne = (pf: PlanDeFeu, image: string | null | undefined, fleches: unknown[]): boolean => {
    if (!image || fleches.length === 0) return false;
    const nombre = pf.phasageBulleCount || 4;
    return (pf.phasageBulleTimes || []).slice(0, nombre).some(t => Number(t) > 0);
};

/** Variables micro : au moins une variable saisie (plan actif : celles de l'écran). */
export const variablesRenseignees = (pf: PlanDeFeu, actif: { activePFId: number; microCustomFields?: string[] }): boolean =>
    (pf.id === actif.activePFId && actif.microCustomFields ? actif.microCustomFields : (pf.microCustomFields || []))
        .some(f => !!f && f.trim() !== '');

/** Données de trafic et réserve de capacité : le jeu de trafic du plan a des valeurs. */
export const traficRenseigne = (pf: PlanDeFeu, trafic: DonneesTrafic): boolean =>
    jeuRenseigne(jeuDuPlan(pf, PAR_PLAN, trafic), trafic);
