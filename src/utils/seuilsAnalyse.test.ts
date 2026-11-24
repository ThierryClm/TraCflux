import { afterEach, describe, expect, it } from 'vitest';
import {
    CLE_SEUILS_ANALYSE, SEUILS_ANALYSE_DEFAUT, chargerSeuilsAnalyse, completerSeuils,
    enregistrerSeuilsAnalyse, reinitialiserSeuilsAnalyse
} from './seuilsAnalyse';

describe('seuils de l\'analyse', () => {
    afterEach(() => localStorage.clear());

    it('part des valeurs par défaut quand rien n\'est enregistré', () => {
        expect(chargerSeuilsAnalyse()).toEqual(SEUILS_ANALYSE_DEFAUT);
    });

    it('relit les seuils enregistrés et complète les clés manquantes', () => {
        localStorage.setItem(CLE_SEUILS_ANALYSE, JSON.stringify({ retardPietonMaxi: 25 }));
        const seuils = chargerSeuilsAnalyse();
        expect(seuils.retardPietonMaxi).toBe(25);
        expect(seuils.attentePietonMaxi).toBe(50);
    });

    it('ignore les valeurs invalides et survit à un stockage illisible', () => {
        expect(completerSeuils({ vertMiniReglementaire: Number.NaN, cycleMini: -4 }).vertMiniReglementaire).toBe(6);
        expect(completerSeuils({ vertMiniReglementaire: Number.NaN, cycleMini: -4 }).cycleMini).toBe(40);
        localStorage.setItem(CLE_SEUILS_ANALYSE, 'pas du json');
        expect(chargerSeuilsAnalyse()).toEqual(SEUILS_ANALYSE_DEFAUT);
    });

    it('enregistre et réinitialise', () => {
        enregistrerSeuilsAnalyse({ ...SEUILS_ANALYSE_DEFAUT, attentePietonMaxi: 35 });
        expect(chargerSeuilsAnalyse().attentePietonMaxi).toBe(35);
        expect(reinitialiserSeuilsAnalyse()).toEqual(SEUILS_ANALYSE_DEFAUT);
        expect(chargerSeuilsAnalyse()).toEqual(SEUILS_ANALYSE_DEFAUT);
    });
});
