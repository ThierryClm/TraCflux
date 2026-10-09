/**
 * Modèle de données du module Onde verte.
 *
 * Une onde verte enchaîne des carrefours, chacun repris d'un dossier TraCflux :
 * ses groupes de feux, ses plans de feux et le plan retenu. Deux groupes y sont
 * suivis, chacun à sa propre distance le long de l'axe.
 */
import type { ActionMicro, Groupe, PlanDeFeu } from './projet';

/** Plan de feux tel que repris d'un dossier : au minimum numéro, nom et actions. */
export type GreenWavePf = Pick<PlanDeFeu, 'id' | 'name' | 'data'> & Partial<PlanDeFeu>;

/** Champs d'un dossier TraCflux utiles à l'onde verte. */
export interface GreenWaveProjectSource {
    projectName?: string | null;
    intersectionName?: string;
    groups?: Groupe[];
    cycleLength?: number;
    pfTabs?: GreenWavePf[];
    actionData?: ActionMicro[];
}

/** Un carrefour de l'onde verte. */
export interface GreenWaveIntersection {
    id?: number;
    /** Nom du fichier du dossier, qui sert aussi de clé dans le cache. */
    projectName: string;
    /** Titre du projet (champ « nom du carrefour » du dossier). */
    intersectionName?: string;
    /** Distance du GF descendant (selectedGroup1), en mètres. */
    distance: number;
    /** Distance du GF montant (selectedGroup2), en mètres ; à défaut, celle du descendant. */
    distanceG2?: number;
    groups: Groupe[];
    cycleLength: number;
    pfTabs?: GreenWavePf[];
    selectedPfId?: number;
    /** GF descendant. */
    selectedGroup1?: number;
    /** GF montant. */
    selectedGroup2?: number;
    actionData?: ActionMicro[];
}

/** Réglages des lignes de vitesse propres à un plan de feux. */
export interface GreenWavePfParams {
    speedUp: number;
    speedDown: number;
    offsetUp: number;
    offsetDown: number;
    showSpeedLines: boolean;
}

/** Réglages d'affichage d'une onde verte, tels qu'enregistrés ou transmis à l'ouverture. */
export interface GreenWaveSettings {
    name?: string;
    loadedFileName?: string;
    speedUp?: number;
    speedDown?: number;
    /** Ancien format : une seule vitesse pour les deux sens. */
    speed?: number;
    speedLineOffsetUp?: number;
    speedLineOffsetDown?: number;
    showSpeedLines?: boolean;
    pfParams?: Record<string, GreenWavePfParams>;
    pixelsPerSecond?: number;
    pixelsPerMeter?: number;
    displayCycles?: number;
}

/** Onde verte complète, telle qu'enregistrée en fichier ou dans le cache du navigateur. */
export interface SavedGreenWave extends GreenWaveSettings {
    name: string;
    intersections: GreenWaveIntersection[];
    savedAt?: string;
}
