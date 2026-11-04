import { describe, expect, it } from 'vitest';
import { FAMILLES_SIGNAUX_ISR } from './signauxIsr';
import { aspectSignal, BLANC_SIGNAL, decalageNumeroSignal, echelleSignal, ETEINT_SIGNAL, JAUNE_SIGNAL, ROUGE_SIGNAL, signalDessinable } from './aspectSignal';

const VERT = 'rgb(0, 255, 0)';
const LUCARNE = 'rgb(0, 180, 0)';
const fixe = { temps: 0, enLecture: false };

describe('echelleSignal', () => {
    it('suit le Zoom pour un véhicule, réduit de moitié', () => {
        expect(echelleSignal(1, 'TD')).toBe(0.5);
        expect(echelleSignal(2, 'TàG')).toBe(1);
    });

    it('fixe les traversées à 0,8 sur le même Zoom, quel que soit celui de la flèche', () => {
        expect(echelleSignal(1.8, 'Piéton')).toBeCloseTo(0.4);
        expect(echelleSignal(1.4, 'Cycle')).toBeCloseTo(0.4);
    });

    it('cale le numéro de groupe sur la taille du module', () => {
        expect(decalageNumeroSignal(2, 'TD')).toEqual({ dx: 40, dy: -40 });
        expect(decalageNumeroSignal(1.8, 'Piéton').dx).toBeCloseTo(16);
    });
});

describe('aspectSignal', () => {
    it('sait dessiner tous les signaux de la liste du formulaire', () => {
        const codes = FAMILLES_SIGNAUX_ISR.flatMap(f => f.signaux.map(s => s.code));
        expect(codes.filter(code => !signalDessinable(code))).toEqual([]);
    });

    it("n'a pas de dessin pour un champ vide ou un code inconnu", () => {
        expect(signalDessinable(undefined)).toBe(false);
        expect(signalDessinable('')).toBe(false);
        expect(signalDessinable('R99')).toBe(false);
        expect(signalDessinable('constructor')).toBe(false);
    });

    it('un tricolore reprend la couleur du groupe, seconde lucarne comprise', () => {
        expect(aspectSignal('R11v', { ...fixe, couleur: LUCARNE })).toEqual({ forme: 'disque', couleur: LUCARNE });
        expect(aspectSignal('R14tg', { ...fixe, couleur: JAUNE_SIGNAL })).toEqual({ forme: 'tg', couleur: JAUNE_SIGNAL });
        expect(aspectSignal('R13b', { ...fixe, couleur: ROUGE_SIGNAL })).toEqual({ forme: 'bus', couleur: ROUGE_SIGNAL });
    });

    it('un signal « j » montre du jaune à la place du vert, fixe à l’arrêt', () => {
        expect(aspectSignal('R11j', { ...fixe, temps: 1, couleur: VERT })?.couleur).toBe(JAUNE_SIGNAL);
        expect(aspectSignal('R13bj', { ...fixe, couleur: ROUGE_SIGNAL })?.couleur).toBe(ROUGE_SIGNAL);
    });

    it('le jaune clignotant bat chaque seconde pendant la lecture', () => {
        const en = (temps: number) => aspectSignal('R11j', { couleur: VERT, temps, enLecture: true })?.couleur;
        expect(en(4.5)).toBe(JAUNE_SIGNAL);
        expect(en(5.5)).toBe(ETEINT_SIGNAL);
    });

    it("une anticipation n'a qu'une lampe : allumée au vert, éteinte sinon", () => {
        expect(aspectSignal('R16tg', { ...fixe, couleur: VERT })).toEqual({ forme: 'tg', couleur: JAUNE_SIGNAL });
        expect(aspectSignal('R15b', { ...fixe, couleur: ROUGE_SIGNAL })).toEqual({ forme: 'bus', couleur: ETEINT_SIGNAL });
        expect(aspectSignal('R16d', { ...fixe, couleur: JAUNE_SIGNAL })?.couleur).toBe(ETEINT_SIGNAL);
    });

    it('R19 tire ses flèches du courant du groupe, à droite par défaut', () => {
        expect(aspectSignal('R19', { ...fixe, couleur: VERT, courant: 'TD_TàD' })?.direction).toBe('dtd');
        expect(aspectSignal('R19', { ...fixe, couleur: VERT, courant: 'Cycle' })?.direction).toBe('td');
    });

    it('un piéton change de figurine et ne connaît pas le jaune', () => {
        expect(aspectSignal('R12', { ...fixe, couleur: VERT })).toEqual({ forme: 'marche', couleur: VERT });
        expect(aspectSignal('R12', { ...fixe, couleur: JAUNE_SIGNAL })).toEqual({ forme: 'arret', couleur: ROUGE_SIGNAL });
        expect(aspectSignal('R12m', { ...fixe, couleur: ROUGE_SIGNAL })?.forme).toBe('mixte-arret');
    });

    it('R12pps allume son trait jaune entre les deux figurines', () => {
        expect(aspectSignal('R12pps', { ...fixe, couleur: JAUNE_SIGNAL })).toEqual({ forme: 'trait', couleur: JAUNE_SIGNAL });
    });

    it('R17 et R18 restent blancs : barre, disque, barre horizontale', () => {
        expect(aspectSignal('R17', { ...fixe, couleur: VERT })).toEqual({ forme: 'barre-v', couleur: BLANC_SIGNAL });
        expect(aspectSignal('R18tg', { ...fixe, couleur: VERT })?.forme).toBe('barre-g');
        expect(aspectSignal('R18td', { ...fixe, couleur: VERT })?.forme).toBe('barre-d');
        expect(aspectSignal('R17', { ...fixe, couleur: JAUNE_SIGNAL })?.forme).toBe('point');
        expect(aspectSignal('R18td', { ...fixe, couleur: ROUGE_SIGNAL })?.forme).toBe('barre-h');
    });

    it('un signal bicolore passe au rouge sans jaune', () => {
        expect(aspectSignal('R23v', { ...fixe, couleur: JAUNE_SIGNAL })?.couleur).toBe(ROUGE_SIGNAL);
    });

    it("R24 et R25 ne s'allument qu'au rouge ; seul STOP clignote sur R25", () => {
        expect(aspectSignal('R24', { ...fixe, couleur: VERT })?.couleur).toBe(ETEINT_SIGNAL);
        expect(aspectSignal('R25', { couleur: ROUGE_SIGNAL, temps: 1.2, enLecture: true }))
            .toEqual({ forme: 'stop', couleur: ROUGE_SIGNAL, couleurStop: ETEINT_SIGNAL });
    });

    it("l'A13b suit l'allumage de la bande intermittente, à l'arrêt comme en lecture", () => {
        expect(aspectSignal('A13b', { ...fixe, couleur: VERT, a13bAllume: true })?.couleur).toBe(JAUNE_SIGNAL);
        expect(aspectSignal('A13b', { ...fixe, couleur: VERT, a13bAllume: false })?.couleur).toBe(ETEINT_SIGNAL);
    });
});
