/**
 * Modèle de données persistant de TraCflux.
 *
 * Tout champ ajouté à un projet enregistré doit être déclaré ici. Ce contrat
 * couvre à la fois les fichiers JSON et le cache du navigateur.
 */

/** Durées d'un groupe de feu, en secondes. Leur somme vaut le cycle. */
export interface Durees {
    green: number;
    orange: number;
    red: number;
}

/** Nature du courant porté par un groupe de feu. */
export type TypeGroupe =
    | ''
    | 'V'
    | 'VL'
    | 'B'
    | 'TC'
    | 'P'
    | 'Piéton'
    | 'CY'
    | 'Cycliste'
    | 'FL'
    | 'PP';

/** Drapeau de phase : aiguillage, escamotage, ou rien. */
export type DrapeauPhase = '' | 'a' | 'e';

/** Un groupe de feu : une ligne du diagramme, un courant du carrefour. */
export interface Groupe {
    id: number;
    name: string;
    type: TypeGroupe;
    courant?: string;
    minGreen: number;
    durations: Durees;
    offset: number;
    da?: string;
    phaseFlag?: DrapeauPhase;
    comment?: string;
    commentColor?: string;
    trafficStream?: string;
    laneCoef?: number;
    trafficVol?: number | string;
    effectiveGreen?: number;
    usedCapacity?: number;
    delay?: number;
    queueLength?: number;
}

/** Projection d'un groupe dans un plan de feu. */
export interface LigneDiagramme {
    groupId: number;
    offset: number;
    greenDuration: number;
    da?: string;
    comment?: string;
    commentColor?: string;
    phaseFlag?: DrapeauPhase;
}

/** Une case de la matrice des temps interverts : un entier, ou vide. */
export type CaseMatrice = number | string;

/** Matrice des temps interverts : matrice[de][vers]. */
export type Matrice = CaseMatrice[][];

/** Une action de micro-régulation. */
export interface ActionMicro {
    id: number;
    action: string;
    gf?: string | number;
    deb?: string | number;
    fin?: string | number;
    abrv?: string;
    description?: string;
    micro?: string;
    plage1?: string;
    plage2?: string;
    actGf1?: string;
    actGf1Gf2?: string;
    actGf1Gf3?: string;
    actGf1Gf4?: string;
}

/** Un programme complet du carrefour. */
export interface PlanDeFeu {
    id: number;
    name: string;
    data: ActionMicro[];
    diagram: LigneDiagramme[];
    conflictMatrix?: Matrice;
    cycleLength?: number;
    remarques?: string;
    microCustomFields?: string[];
    color?: string;
    readOnly?: boolean;
    simulationName?: string;
    simulationActions?: number[];
    phasageBulleCount?: number;
    phasageBulleTimes?: number[];
    phasageBubbleScale?: number;
    phasageEllipseScale?: number;
    phasageBubbleRatio?: number;
}

/** Une flèche de courant posée sur l'image du carrefour. */
export interface FlecheCarrefour {
    id: number;
    /** Groupe de feu dont la flèche prend la couleur. */
    groupId: number;
    /** Position du centre, en % de l'image. */
    x: number;
    y: number;
    /** Rotation en degrés ; 0 pointe vers le haut. */
    rotation?: number;
    scale?: number;
    /** Longueur de la hampe, 1 = normale. */
    length?: number;
    /** Portée de la branche tournante, de 0 à 1. */
    turnLength?: number;
}

/** Données de trafic d'un jeu donné, indexées par groupe. */
export type JeuTrafic = Record<string, { trafficVol?: number | string }>;

/** Options de mise en page enregistrées avec le projet. */
export interface OptionsMiseEnPage {
    showParameters?: boolean;
    showComments?: boolean;
    showRemarks?: boolean;
    showActionDescription?: boolean;
    showFloatingForm?: boolean;
    showFloatingMatrix?: boolean;
    showFloatingTraffic?: boolean;
    showFloatingImage?: boolean;
    showFloatingConditions?: boolean;
    showFloatingVariables?: boolean;
    showFloatingRemarks?: boolean;
    /** Image du carrefour : numéros des groupes affichés. */
    showImageGroupNumbers?: boolean;
    /** Image du carrefour : noms des groupes affichés. */
    showImageGroupNames?: boolean;
    /** Image du carrefour : ajout de flèches au clic (« Ajouter un courant de circulation »). */
    showImageArrows?: boolean;
}

/** Un projet enregistré, tel que getFullState le produit. */
export interface Projet {
    projectName: string | null;
    intersectionName: string;
    groups: Groupe[];
    cycleLength: number;
    conflictMatrix: Matrice;
    pfTabs: PlanDeFeu[];
    activePFId: number;
    intersectionImage?: string | null;
    intersectionArrows?: Record<string, unknown>[];
    imageBrightness?: number;
    imageContrast?: number;
    trafficDatasets?: Record<string, JeuTrafic>;
    activeTrafficDataset?: string;
    customTrafficDatasetNames?: string[];
    pfTrafficDatasetMap?: Record<string, string>;
    dependencyGap?: number;
    biCarrefourSeparator?: number | null;
    matricesLocked?: boolean;
    actionColWidths?: Record<string, unknown>;
    externalLinks?: Record<string, unknown>[];
    capacityCompareSelection?: number[] | null;
    capacityCompareDataset?: string;
    projectProperties?: Record<string, unknown>;
    dossierSections?: Record<string, unknown>;
    diagramHeight?: number | null;
    floatingCrop?: Record<string, unknown>;
    floatingCropBasis?: string;
    floatingZoom?: number;
    layoutOptions?: OptionsMiseEnPage;
    directoryNames?: Record<string, string | null>;
    savedAt?: string;
}
