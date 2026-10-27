/**
 * Signaux lumineux de circulation de l'ISR, livre 1, 6e partie (art. 109-3),
 * proposés dans la colonne « Signal » du formulaire des groupes.
 * Désignations reprises du texte consolidé du 4/09/2025.
 */
export interface SignalIsr {
    code: string;
    libelle: string;
}

export interface FamilleSignauxIsr {
    famille: string;
    signaux: SignalIsr[];
}

export const FAMILLES_SIGNAUX_ISR: FamilleSignauxIsr[] = [
    {
        famille: 'R11 · Tricolores circulaires',
        signaux: [
            { code: 'R11v', libelle: 'Signal tricolore circulaire, vert sur le feu du bas' },
            { code: 'R11j', libelle: 'Signal tricolore circulaire, jaune clignotant sur le feu du bas' }
        ]
    },
    {
        famille: 'R12 · Piétons',
        signaux: [
            { code: 'R12', libelle: 'Signal piéton' },
            { code: 'R12m', libelle: 'Signal mixte piéton-cycle' },
            { code: 'R12pps', libelle: 'Signal piéton pour passage spécifique' }
        ]
    },
    {
        famille: 'R13 · Tricolores modaux',
        signaux: [
            { code: 'R13b', libelle: 'Signal tricolore modal, mention BUS' },
            { code: 'R13bj', libelle: 'Signal tricolore modal, mention BUS, jaune clignotant' },
            { code: 'R13c', libelle: 'Signal tricolore modal, forme de cycle' },
            { code: 'R13cj', libelle: 'Signal tricolore modal, forme de cycle, jaune clignotant' }
        ]
    },
    {
        famille: 'R14 · Tricolores directionnels',
        signaux: [
            { code: 'R14d', libelle: 'Signal tricolore directionnel, direct' },
            { code: 'R14tg', libelle: 'Signal tricolore directionnel, tourne-à-gauche' },
            { code: 'R14td', libelle: 'Signal tricolore directionnel, tourne-à-droite' },
            { code: 'R14dtg', libelle: 'Signal tricolore directionnel, direct et tourne-à-gauche' },
            { code: 'R14dtd', libelle: 'Signal tricolore directionnel, direct et tourne-à-droite' }
        ]
    },
    {
        famille: 'R15 · Anticipation modale',
        signaux: [
            { code: 'R15b', libelle: "Signal d'anticipation modal, mention BUS" },
            { code: 'R15c', libelle: "Signal d'anticipation modal, forme de cycle" }
        ]
    },
    {
        famille: 'R16 · Anticipation directionnelle',
        signaux: [
            { code: 'R16d', libelle: "Signal d'anticipation directionnel, direct" },
            { code: 'R16tg', libelle: "Signal d'anticipation directionnel, tourne-à-gauche" },
            { code: 'R16td', libelle: "Signal d'anticipation directionnel, tourne-à-droite" },
            { code: 'R16dtg', libelle: "Signal d'anticipation directionnel, direct et tourne-à-gauche" },
            { code: 'R16dtd', libelle: "Signal d'anticipation directionnel, direct et tourne-à-droite" }
        ]
    },
    {
        famille: 'R17 · R18 · Transports en commun',
        signaux: [
            { code: 'R17', libelle: 'Signal pour véhicules des services réguliers de transport en commun' },
            { code: 'R18tg', libelle: 'Signal directionnel transport en commun, tourne-à-gauche' },
            { code: 'R18td', libelle: 'Signal directionnel transport en commun, tourne-à-droite' }
        ]
    },
    {
        famille: 'R19 · Cycles',
        signaux: [
            { code: 'R19', libelle: "Signal d'autorisation conditionnelle de franchissement pour cycles" }
        ]
    },
    {
        famille: "R22 · R23 · Contrôle d'accès",
        signaux: [
            { code: 'R22v', libelle: 'Signal tricolore de contrôle de flot, vert sur le feu du bas' },
            { code: 'R22j', libelle: 'Signal tricolore de contrôle de flot, jaune clignotant sur le feu du bas' },
            { code: 'R23v', libelle: 'Signal bicolore de contrôle individuel, vert et rouge' },
            { code: 'R23j', libelle: 'Signal bicolore de contrôle individuel, jaune clignotant et rouge' }
        ]
    },
    {
        famille: "R24 · R25 · Signaux d'arrêt",
        signaux: [
            { code: 'R24', libelle: "Signal d'arrêt, rouge clignotant" },
            { code: 'R25', libelle: "Signal d'arrêt pour piétons" }
        ]
    }
];

const LIBELLES = new Map(FAMILLES_SIGNAUX_ISR.flatMap(f => f.signaux.map(s => [s.code, s.libelle] as const)));

/** Désignation ISR d'un signal, ou undefined s'il n'est pas dans la liste. */
export const libelleSignalIsr = (code: string | undefined): string | undefined =>
    code ? LIBELLES.get(code) : undefined;
