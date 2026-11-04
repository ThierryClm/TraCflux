/**
 * Aspect du module affiché à la place de la flèche sur l'image du carrefour,
 * quand la case « Signal » est cochée : un seul feu du signal ISR (6e partie,
 * art. 109-3), celui que l'état du groupe allume à cet instant.
 *
 * La couleur vient toujours du moteur des flèches (getGroupColorAtTime) ; ce
 * module ne fait que la traduire dans ce que le signal sait montrer. Un R12 n'a
 * pas de feu jaune, un R16 n'a qu'une lampe, un R17 n'a que des feux blancs.
 */
import { etatDeCouleur } from './groupColorAtTime';

export type FormeSignal =
    | 'disque' | 'd' | 'tg' | 'td' | 'dtg' | 'dtd' | 'bus' | 'cycle' | 'cycle-direction'
    | 'marche' | 'arret' | 'mixte-marche' | 'mixte-arret' | 'trait' | 'stop'
    | 'barre-v' | 'barre-g' | 'barre-d' | 'barre-h' | 'point' | 'a13b';

export type DirectionSignal = 'd' | 'tg' | 'td' | 'dtg' | 'dtd';

export interface AspectSignal {
    forme: FormeSignal;
    couleur: string;
    /** R25 : le piéton rouge est fixe, seule la mention STOP clignote. */
    couleurStop?: string;
    /** R19 : flèches portées sous le cycle. */
    direction?: DirectionSignal;
}

export interface ContexteSignal {
    /** Couleur du groupe à cet instant (getGroupColorAtTime). */
    couleur: string;
    /** Instant affiché, en secondes. */
    temps: number;
    /** Le clignotement n'existe que pendant le déroulement du temps. */
    enLecture: boolean;
    /** Lampe de l'A13b allumée à cet instant (isPPLit). */
    a13bAllume?: boolean;
    /** Courant du groupe : le code R19 ne dit pas ses directions. */
    courant?: string;
}

export const JAUNE_SIGNAL = 'rgb(255, 255, 0)';
export const ROUGE_SIGNAL = 'rgb(255, 0, 0)';
export const BLANC_SIGNAL = 'rgb(255, 255, 255)';
/** Lampe éteinte : la teinte des feux clignotants entre deux éclats. */
export const ETEINT_SIGNAL = 'rgb(120, 120, 120)';

/** Forme de chaque feu tricolore ; R11 et R22 sont circulaires. */
const TRICOLORES: Record<string, FormeSignal> = {
    R11v: 'disque', R11j: 'disque', R22v: 'disque', R22j: 'disque',
    R13b: 'bus', R13bj: 'bus', R13c: 'cycle', R13cj: 'cycle',
    R14d: 'd', R14tg: 'tg', R14td: 'td', R14dtg: 'dtg', R14dtd: 'dtd'
};
const BICOLORES: Record<string, FormeSignal> = { R23v: 'disque', R23j: 'disque' };
/** Une seule lampe jaune clignotante, associée à un signal R11v. */
const ANTICIPATIONS: Record<string, FormeSignal> = {
    R15b: 'bus', R15c: 'cycle',
    R16d: 'd', R16tg: 'tg', R16td: 'td', R16dtg: 'dtg', R16dtd: 'dtd',
    R19: 'cycle-direction'
};
/** Barre du feu du bas : verticale sur R17, inclinée sur R18. */
const TRANSPORTS: Record<string, FormeSignal> = { R17: 'barre-v', R18tg: 'barre-g', R18td: 'barre-d' };

const DIRECTIONS_COURANT: Record<string, DirectionSignal> = {
    TD: 'd', TàG: 'tg', TàD: 'td',
    TD_TàG: 'dtg', TDTàG: 'dtg', 'TD-TàG': 'dtg',
    TD_TàD: 'dtd', TDTàD: 'dtd', 'TD-TàD': 'dtd'
};

/** Les signaux « j » remplacent leur vert par du jaune clignotant. */
const vertClignotant = (code: string) => code.endsWith('j');

/**
 * Aspect du signal, ou undefined si le code n'a pas de dessin : le groupe
 * garde alors sa flèche.
 */
export const aspectSignal = (code: string | undefined, contexte: ContexteSignal): AspectSignal | undefined => {
    if (!code) return undefined;
    const { couleur, temps, enLecture, a13bAllume = false, courant = '' } = contexte;
    const etat = etatDeCouleur(couleur);
    // Une seconde allumée, une seconde éteinte (art. 109-3). À l'arrêt, le temps
    // ne s'écoule plus : une lampe saisie entre deux éclats passerait pour éteinte.
    const eclat = !enLecture || Math.floor(temps) % 2 === 0;
    const clignotant = (teinte: string) => eclat ? teinte : ETEINT_SIGNAL;
    const allumeSiVert = etat === 'vert' ? clignotant(JAUNE_SIGNAL) : ETEINT_SIGNAL;

    if (Object.hasOwn(TRICOLORES, code)) {
        const teinte = etat === 'vert' && vertClignotant(code) ? clignotant(JAUNE_SIGNAL) : couleur;
        return { forme: TRICOLORES[code], couleur: teinte };
    }
    if (Object.hasOwn(BICOLORES, code)) {
        if (etat === 'jaune') return { forme: BICOLORES[code], couleur: ROUGE_SIGNAL };
        const teinte = etat === 'vert' && vertClignotant(code) ? clignotant(JAUNE_SIGNAL) : couleur;
        return { forme: BICOLORES[code], couleur: teinte };
    }
    if (Object.hasOwn(ANTICIPATIONS, code)) {
        const forme = ANTICIPATIONS[code];
        return forme === 'cycle-direction'
            ? { forme, couleur: allumeSiVert, direction: DIRECTIONS_COURANT[courant] ?? 'td' }
            : { forme, couleur: allumeSiVert };
    }
    if (Object.hasOwn(TRANSPORTS, code)) {
        if (etat === 'eteint') return { forme: 'barre-h', couleur: ETEINT_SIGNAL };
        const forme = etat === 'vert' ? TRANSPORTS[code] : etat === 'jaune' ? 'point' : 'barre-h';
        return { forme, couleur: BLANC_SIGNAL };
    }

    switch (code) {
        case 'R12':
            return etat === 'vert' ? { forme: 'marche', couleur } : { forme: 'arret', couleur: ROUGE_SIGNAL };
        case 'R12m':
            return etat === 'vert' ? { forme: 'mixte-marche', couleur } : { forme: 'mixte-arret', couleur: ROUGE_SIGNAL };
        case 'R12pps':
            if (etat === 'jaune') return { forme: 'trait', couleur: clignotant(JAUNE_SIGNAL) };
            return etat === 'vert' ? { forme: 'marche', couleur } : { forme: 'arret', couleur: ROUGE_SIGNAL };
        case 'R24':
            return { forme: 'disque', couleur: etat === 'rouge' ? clignotant(ROUGE_SIGNAL) : ETEINT_SIGNAL };
        case 'R25':
            return etat === 'rouge'
                ? { forme: 'stop', couleur: ROUGE_SIGNAL, couleurStop: clignotant(ROUGE_SIGNAL) }
                : { forme: 'stop', couleur: ETEINT_SIGNAL, couleurStop: ETEINT_SIGNAL };
        case 'A13b':
            // Même cadence que la bande intermittente du diagramme, comme le
            // triangle du courant PP : elle bat aussi à l'arrêt.
            return { forme: 'a13b', couleur: a13bAllume ? JAUNE_SIGNAL : ETEINT_SIGNAL };
        default:
            return undefined;
    }
};

/** Le code a-t-il un dessin ? Un signal inconnu laisse le groupe avec sa flèche. */
export const signalDessinable = (code: string | undefined): boolean =>
    aspectSignal(code, { couleur: ROUGE_SIGNAL, temps: 0, enLecture: false }) !== undefined;

/** Un groupe au moins a-t-il un signal à montrer ? Sinon, la case Signal est sans objet. */
export const auMoinsUnSignal = (groupes: { signal?: string }[]): boolean =>
    groupes.some(g => signalDessinable(g.signal));

/** Zoom des signaux de traversée, dans l'unité du réglage Zoom des flèches. */
const ZOOM_SIGNAL_TRAVERSEE = 0.8;

/**
 * Le Zoom d'une flèche piéton ou cycle sert à couvrir la largeur de la
 * traversée : il ne dit rien de la taille d'un feu, qui est donc fixe.
 */
const estSignalTraversee = (courant: string | undefined) => courant === 'Piéton' || courant === 'Cycle';

/**
 * Échelle du module, rapportée au Zoom : une flèche est un trait fin qui laisse
 * voir le plan, un module est un bloc opaque. À taille égale, ils se
 * recouvraient sur le projet exemple.
 */
export const echelleSignal = (zoomFleche: number, courant?: string) =>
    (estSignalTraversee(courant) ? ZOOM_SIGNAL_TRAVERSEE : zoomFleche) * 0.5;

/** Numéro de groupe au coin haut droit du module : au centre, il couvrirait le pictogramme. */
export const decalageNumeroSignal = (zoomFleche: number, courant?: string) => {
    const demiCote = 40 * echelleSignal(zoomFleche, courant);
    return { dx: demiCote, dy: -demiCote };
};
