import { describe, expect, it } from 'vitest';
import { imageRenseignee, phasageRenseigne, traficRenseigne, variablesRenseignees } from './disponibiliteDossier';
import { texteAvecSauts } from './couleursTexte';

const pf = (extra = {}) => ({ id: 2, name: 'PF2', data: [], diagram: [], ...extra });
const trafic = { trafficDatasets: { HPM: { 1: { trafficVol: 300 } }, Vide: {} }, pfTrafficDatasetMap: { 2: 'HPM', 3: 'Vide' }, activeTrafficDataset: 'Vide', trafficDatasetNames: ['HPM', 'Vide'] };

describe('sections renseignées du dossier', () => {
    it('image du carrefour', () => {
        expect(imageRenseignee('data:image/png;base64,x')).toBe(true);
        expect(imageRenseignee(null)).toBe(false);
    });
    it('phasage bulle : instants tous à 0 = non renseigné', () => {
        expect(phasageRenseigne(pf({ phasageBulleTimes: [0, 0, 0, 0] }), 'img', [{}])).toBe(false);
        expect(phasageRenseigne(pf({ phasageBulleTimes: [0, 25, 0, 0] }), 'img', [{}])).toBe(true);
        expect(phasageRenseigne(pf({ phasageBulleTimes: [0, 25, 0, 0] }), null, [{}])).toBe(false);
    });
    it('variables micro : celles de l’écran pour le plan actif', () => {
        expect(variablesRenseignees(pf({ microCustomFields: ['', ' '] }), { activePFId: 1 })).toBe(false);
        expect(variablesRenseignees(pf({ microCustomFields: [''] }), { activePFId: 2, microCustomFields: ['TMAB = 10'] })).toBe(true);
    });
    it('trafic : jeu du plan avec des valeurs', () => {
        expect(traficRenseigne(pf(), trafic)).toBe(true);
        expect(traficRenseigne(pf({ id: 3 }), trafic)).toBe(false);
    });
    it('remarques : texte simple avec sauts de ligne', () => {
        expect(texteAvecSauts('<span style="font-size: 22px">A</span><br>B<div>C</div>')).toBe('A\nB\nC');
    });
});
