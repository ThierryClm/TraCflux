import type { ActionMicro } from '../types/projet';

/**
 * Les actions que la simulation sait rejouer.
 *
 * Ces familles n'ont pas de case individuelle : elles annotent le diagramme
 * ou concernent un autre système. Les BTS participent toutefois à la
 * compensation lorsque l'option globale dédiée est activée.
 * Cette liste était enfermée dans le composant ; le dossier imprimé en aurait
 * tenu une copie, et les deux listes auraient fini par diverger comme l'ont
 * fait, ici même, le tableau de trafic imprimé et celui de l'écran. Elle est
 * donc exportée : une seule liste, deux lecteurs.
 */
export const ACTIONS_HORS_SIMULATION = [
    'Début de bande passante',
    'Fin de bande passante',
    'Priorité piétons',
    'Signal aide conduite',
    'Synchro BTS',
    'Instant Co',
    "Flèche d'anticipation"
];

/** Les actions d'un plan que la simulation prend en compte, dans l'ordre saisi. */
export const actionsSimulables = (actionData: ActionMicro[] = []): ActionMicro[] => actionData.filter(a =>
    a.action && a.action !== '' && !ACTIONS_HORS_SIMULATION.includes(a.action)
);
