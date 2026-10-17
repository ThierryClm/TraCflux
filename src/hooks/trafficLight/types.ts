/**
 * Types et constantes partagés par useTrafficLight et ses sous-hooks.
 */
import type { MutableRefObject } from 'react';
import type { AlertFunction, ConfirmFunction } from '../../components/ConfirmProvider';
import type { ActionMicro, Durees, Groupe, JeuTrafic, Matrice, PlanDeFeu, Projet } from '../../types/projet';

export const DEFAULT_PROJECT_PROPERTIES = {
    commune: '', idCommune: '', idCarrefour: '', controleur: '', programme: '',
    horsAgglomeration: false,
    moa: '', moe: '', bureauEtudes: '', auteur: '',
    logoMoa: '', logoMoe: '',
    dateCreation: '', dateModification: '', numeroDossier: '', phaseEtude: '', commentaires: ''
};

/** Jeux de trafic du projet, indexés par nom (HPM, HPS…). */
export type JeuxTrafic = Record<string, JeuTrafic>;

/** Propriétés administratives du projet (fenêtre « Propriétés »). */
export type ProprietesProjet = typeof DEFAULT_PROJECT_PROPERTIES;

/**
 * Groupe tel qu'un ancien projet a pu l'enregistrer : durées parfois posées
 * à plat sur le groupe, champs parfois absents.
 */
export type GroupeEnregistre = Partial<Omit<Groupe, 'durations' | 'id'>> & {
    id: number;
    durations?: Partial<Durees> | null;
    green?: number;
    orange?: number;
    red?: number;
    greenDuration?: number;
};

/** Projet relu du cache ou d'un fichier, avant toute normalisation. */
export type ProjetEnregistre = Omit<Partial<Projet>, 'groups'> & {
    groups?: GroupeEnregistre[];
    /** Format d'avant les plans de feux : une seule table d'actions. */
    actionData?: ActionMicro[];
};

/** Modification partielle d'un groupe ; les durées peuvent n'être que partielles. */
export type ParametresGroupe = Partial<Omit<Groupe, 'durations'>> & { durations?: Partial<Durees> };

/** Projet complet au format actuel, tel que loadFullState le reçoit. */
export type EtatProjet = Partial<Projet> & {
    /** Format d'avant les plans de feux : une seule table d'actions. */
    actionData?: ActionMicro[];
};

/** Instantané pris avant une modification, pour Annuler / Rétablir. */
export interface EtatHistorique {
    groups: Groupe[];
    conflictMatrix: Matrice;
    pfTabs?: PlanDeFeu[];
    activePFId: number;
    cycleLength: number;
    intersectionName: string;
    /** Format d'historique d'avant les plans de feux. */
    actionData?: ActionMicro[];
}

/** Entrée de la liste « Restaurer un projet récent ». */
export interface SauvegardeCache {
    name: string;
    savedAt: string | null;
    size: number;
}

/**
 * Champs de projet tenus par d'autres modules : `lire` les fournit à
 * l'enregistrement, `ecrire` les leur rend à l'ouverture.
 */
export interface ChampsProjet {
    lire?: () => Record<string, unknown>;
    ecrire?: (data: ProjetEnregistre) => void;
}

export interface UseTrafficLightOptions {
    askConfirm?: ConfirmFunction;
    showAlert?: AlertFunction;
    champsProjetRef?: MutableRefObject<ChampsProjet>;
}
