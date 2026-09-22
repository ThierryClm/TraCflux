// @ts-check

/**
 * Le modèle de données d'un projet TraCflux, décrit une fois pour toutes.
 *
 * Ce fichier ne contient aucun code exécuté : rien que des définitions de
 * types, en JSDoc. Elles se lisent depuis n'importe quel module par
 * `@type {import('../types/projet.js').PlanDeFeu}`, et le compilateur
 * TypeScript les vérifie sur les fichiers qui portent `// @ts-check`.
 *
 * Pourquoi ici plutôt qu'en TypeScript : les défauts de ce dépôt ne sont pas
 * des erreurs de type, ce sont des erreurs de valeur et d'ordonnancement. Une
 * migration complète ne les aurait pas attrapés. Ce qu'elle aurait attrapé,
 * en revanche, c'est la faute qui a coûté du travail en septembre 2026 : un
 * champ présent dans le fichier projet et absent du cache du navigateur. D'où
 * ce périmètre — le modèle de données, et lui seul.
 *
 * Règle de tenue : tout champ ajouté à un projet enregistré s'ajoute ICI. Un
 * type qu'on oublie de compléter ne prévient de rien.
 */

/**
 * Durées d'un groupe de feu, en secondes. Leur somme vaut le cycle.
 * @typedef {Object} Durees
 * @property {number} green   Durée de vert.
 * @property {number} orange  Durée d'orange, 3 s par défaut.
 * @property {number} red     Durée de rouge, déduite du cycle.
 */

/**
 * Nature du courant porté par un groupe de feu.
 * @typedef {'VL'|'V'|'TC'|'B'|'Cycliste'|'CY'|'Piéton'|'P'} TypeGroupe
 */

/**
 * Drapeau de phase : aiguillage, escamotage, ou rien. Il grise les conflits.
 *
 * Le même champ existe sur le groupe et sur la ligne de diagramme qui le
 * projette. Les deux doivent porter le même type, sans quoi la recopie de
 * l'un vers l'autre laisse passer n'importe quelle chaîne.
 * @typedef {''|'a'|'e'} DrapeauPhase
 */

/**
 * Un groupe de feu : une ligne du diagramme, un courant du carrefour.
 *
 * Les champs de trafic ne sont plus la source de vérité — les volumes vivent
 * désormais dans les jeux de données (`trafficDatasets`) — mais ils subsistent
 * dans les projets anciens et sont donc encore lus.
 *
 * @typedef {Object} Groupe
 * @property {number} id
 * @property {string} name
 * @property {TypeGroupe} type
 * @property {string} [courant]        Mouvement de trafic : TD, TàD, TàG…
 * @property {number} minGreen         Vert minimal réglementaire.
 * @property {Durees} durations
 * @property {number} offset           Instant de début de vert dans le cycle.
 * @property {string} [da]             Code trajet d'approche bus, 2 caractères.
 * @property {DrapeauPhase} [phaseFlag]  Aiguillage ou escamotage : grise les conflits.
 * @property {string} [comment]
 * @property {string} [commentColor]
 * @property {string} [trafficStream]
 * @property {number} [laneCoef]       Coefficient de voie du calcul de capacité.
 * @property {number|string} [trafficVol]
 * @property {number} [effectiveGreen]
 * @property {number} [usedCapacity]
 * @property {number} [delay]
 * @property {number} [queueLength]
 */

/**
 * Une ligne du diagramme telle qu'un plan de feu la mémorise.
 *
 * C'est une PROJECTION des groupes, pas les groupes eux-mêmes : seuls y
 * figurent les champs qui changent d'un plan à l'autre. Le nom, le type ou le
 * vert minimal d'un groupe sont communs à tout le projet.
 *
 * @typedef {Object} LigneDiagramme
 * @property {number} groupId
 * @property {number} offset
 * @property {number} greenDuration
 * @property {string} [da]
 * @property {string} [comment]
 * @property {string} [commentColor]
 * @property {DrapeauPhase} [phaseFlag]
 */

/**
 * Une case de la matrice des temps interverts : un entier, ou vide.
 * @typedef {number|string} CaseMatrice
 */

/**
 * La matrice des temps interverts : `matrice[de][vers]`.
 * @typedef {CaseMatrice[][]} Matrice
 */

/**
 * Une action de micro-régulation, une ligne du tableau des conditions.
 *
 * Les champs sont majoritairement des chaînes parce qu'ils viennent de champs
 * de saisie, et qu'une saisie vide doit rester distincte d'un zéro.
 *
 * @typedef {Object} ActionMicro
 * @property {number} id
 * @property {string} action       Famille de l'action : « Escamotage de phase »…
 * @property {string} [gf]         Groupe concerné.
 * @property {string} [deb]        Instant de début, en secondes.
 * @property {string} [fin]        Instant de fin, en secondes.
 * @property {string} [abrv]       Abréviation portée sur le diagramme.
 * @property {string} [description]
 * @property {string} [micro]      Condition de micro-régulation, texte libre.
 * @property {string} [plage1]
 * @property {string} [plage2]
 * @property {string} [actGf1]
 * @property {string} [actGf1Gf2]
 * @property {string} [actGf1Gf3]
 * @property {string} [actGf1Gf4]
 */

/**
 * Un plan de feu : un programme complet du carrefour.
 *
 * Chaque plan porte SA durée de cycle, SON diagramme, SA matrice et SON
 * scénario. C'est le plan qui fait foi sur toutes ces valeurs — le niveau
 * projet n'en garde qu'une copie de travail, celle du plan actif.
 *
 * @typedef {Object} PlanDeFeu
 * @property {number} id
 * @property {string} name
 * @property {ActionMicro[]} data              Conditions de micro-régulation.
 * @property {LigneDiagramme[]} diagram
 * @property {Matrice} [conflictMatrix]
 * @property {number} [cycleLength]            Absent des plans d'avant la multiprogrammation.
 * @property {string} [remarques]              Texte enrichi, propre au plan.
 * @property {string[]} [microCustomFields]    Variables micro personnalisées.
 * @property {string} [color]                  Vert = validé, rouge = invalidé.
 * @property {boolean} [readOnly]              Plan importé, verrouillé.
 * @property {string} [simulationName]         Nom du scénario de micro-régulation.
 * @property {number[]} [simulationActions]    Identifiants des actions cochées.
 * @property {number} [phasageBulleCount]
 * @property {number[]} [phasageBulleTimes]
 */

/**
 * Les données de trafic d'un jeu donné, indexées par groupe.
 * @typedef {Record<string, { trafficVol?: number|string }>} JeuTrafic
 */

/**
 * Les options de mise en page enregistrées avec le projet.
 *
 * Onze drapeaux : quatre d'affichage, sept de détachement. Ils sont nommés un
 * par un plutôt que laissés en objet libre, parce que c'est leur disparition
 * silencieuse — un champ écrit par un chemin, ignoré par l'autre — qui a fait
 * perdre des réglages.
 *
 * @typedef {Object} OptionsMiseEnPage
 * @property {boolean} [showParameters]
 * @property {boolean} [showComments]
 * @property {boolean} [showRemarks]
 * @property {boolean} [showActionDescription]
 * @property {boolean} [showFloatingForm]
 * @property {boolean} [showFloatingMatrix]
 * @property {boolean} [showFloatingTraffic]
 * @property {boolean} [showFloatingImage]
 * @property {boolean} [showFloatingConditions]
 * @property {boolean} [showFloatingVariables]
 * @property {boolean} [showFloatingRemarks]
 */

/**
 * Un projet enregistré, tel que `getFullState` le produit.
 *
 * C'est le contrat des DEUX chemins d'enregistrement — fichier `.json` et
 * cache du navigateur. Ils doivent porter exactement la même chose : c'est
 * leur divergence qui a fait perdre des réglages en septembre 2026, et le test
 * de symétrie de `useFileOperations` veille sur cette égalité.
 *
 * @typedef {Object} Projet
 * @property {string|null} projectName
 * @property {string} intersectionName
 * @property {Groupe[]} groups
 * @property {number} cycleLength              Cycle du plan ACTIF, recopié ici.
 * @property {Matrice} conflictMatrix
 * @property {PlanDeFeu[]} pfTabs
 * @property {number} activePFId
 * @property {string|null} [intersectionImage] Image de fond, en data URL.
 * @property {Object[]} [intersectionArrows]
 * @property {number} [imageBrightness]
 * @property {number} [imageContrast]
 * @property {Record<string, JeuTrafic>} [trafficDatasets]
 * @property {string} [activeTrafficDataset]
 * @property {string[]} [customTrafficDatasetNames]  Noms des jeux de trafic ajoutés.
 * @property {Record<string, string>} [pfTrafficDatasetMap]
 * @property {number} [dependencyGap]
 * @property {number|null} [biCarrefourSeparator]
 * @property {boolean} [matricesLocked]
 * @property {Object} [actionColWidths]
 * @property {Object[]} [externalLinks]
 * @property {number[]|null} [capacityCompareSelection]
 * @property {string} [capacityCompareDataset]
 * @property {Object} [projectProperties]
 * @property {Object} [dossierSections]        Cases du dossier imprimé.
 * @property {number|null} [diagramHeight]
 * @property {Object} [floatingCrop]
 * @property {string} [floatingCropBasis]
 * @property {number} [floatingZoom]
 * @property {OptionsMiseEnPage} [layoutOptions]
 * @property {Object} [directoryNames]
 * @property {string} [savedAt]                Horodatage, posé à l'écriture.
 */

export {};
