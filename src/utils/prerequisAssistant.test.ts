import { describe, expect, it } from 'vitest';
import type { Groupe, Matrice } from '../types/projet';
import { evaluerPrerequisAssistant } from './prerequisAssistant';

const groupe = (id: number): Groupe => ({ id, name: `V${id}`, type: 'V', minGreen: 6, durations: { green: 0, orange: 3, red: 0 }, offset: 0 });
const groupes = (n: number) => Array.from({ length: n }, (_, i) => groupe(i + 1));
const matrice = (n: number): Matrice => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === 0 && j === 1 ? 4 : ''));

describe('prérequis de l’assistant conception', () => {
    it('bloque un projet vide ou une matrice vide, même avec des groupes complets', () => {
        expect(evaluerPrerequisAssistant([], []).pret).toBe(false);
        expect(evaluerPrerequisAssistant(groupes(5), Array.from({ length: 5 }, () => Array(5).fill(''))).pret).toBe(false);
        expect(evaluerPrerequisAssistant(groupes(5), [[4]]).pret).toBe(false);
    });
    it('ne compte ni la diagonale seule ni un nom automatique comme des données renseignées', () => {
        expect(evaluerPrerequisAssistant(groupes(2), [[4, ''], ['', 4]]).pret).toBe(false);
        const g = groupes(5).map(x => ({ ...x, name: `Groupe ${x.id}` }));
        expect(evaluerPrerequisAssistant(g, matrice(5)).renseignes).toBe(0);
    });
    it('ouvre à 80 % exactement, arrondit le nombre requis au supérieur et ne demande pas de verts déjà dessinés', () => {
        const g = groupes(5); g[0].name = '';
        expect(evaluerPrerequisAssistant(g, matrice(5)).pret).toBe(true);
        g[1].type = '';
        expect(evaluerPrerequisAssistant(g, matrice(5)).pret).toBe(false);
        const treize = groupes(13); treize.slice(10).forEach(x => { x.name = ''; });
        expect(evaluerPrerequisAssistant(treize, matrice(13))).toMatchObject({ pret: false, requis: 11, renseignes: 10 });
        treize[10].name = 'P11';
        expect(evaluerPrerequisAssistant(treize, matrice(13)).pret).toBe(true);
    });
    it('exige type, mini et jaune, tout en permettant un dégagement nul pour un groupe sans jaune tricolore', () => {
        const g = groupes(5); g[0].type = ''; g[1].minGreen = 0;
        expect(evaluerPrerequisAssistant(g, matrice(5)).pret).toBe(false);
        g[0] = groupe(1); g[1] = groupe(2); g[0].durations.orange = 0; g[1].durations.orange = Number.NaN;
        expect(evaluerPrerequisAssistant(g, matrice(5)).pret).toBe(false);
        g[0].type = 'P';
        expect(evaluerPrerequisAssistant(g, matrice(5)).pret).toBe(true);
        g[0].durations.orange = -1;
        expect(evaluerPrerequisAssistant(g, matrice(5)).pret).toBe(false);
    });
});
