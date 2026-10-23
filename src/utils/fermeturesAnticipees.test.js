import { describe, it, expect } from 'vitest';
import { proposerFermetures } from './fermeturesAnticipees';

// TD « carrefour en croix avec couloir bus d'approche », plan à 70 s (HPM).
const g = (id, type, debut, vert, vertMini, trafic = 0) => ({ id, type, debut, vert, vertMini, trafic, coefVoie: 1 });
const td = [
    g(1, 'V', 0, 29, 8, 600), g(2, 'V', 0, 29, 8, 500), g(3, 'B', 33, 6, 6, 24), g(4, 'V', 45, 19, 8, 380), g(5, 'V', 45, 19, 8, 300),
    g(6, 'P', 46, 16, 7), g(7, 'P', 44, 16, 8), g(8, 'P', 0, 37, 6), g(9, 'P', 0, 37, 6),
];
const m = [
    ['', '', '', 6, 5, 4, 6, '', ''],
    ['', '', 4, 5, 6, 6, 4, '', ''],
    ['', 4, '', 6, 5, 7, 5, '', ''],
    [6, 5, 5, '', '', '', '', 4, 6],
    [6, 5, 5, '', '', '', '', 6, 4],
    [8, 6, 6, '', '', '', '', '', ''],
    [8, 10, 10, '', '', '', '', '', ''],
    ['', '', '', 8, 6, '', '', '', ''],
    ['', '', '', 6, 8, '', '', '', ''],
];

describe('fermetures anticipées proposées', () => {
    it('TD : V2 (67 %) ferme 6 s plus tôt et B3 glisse ; V4 (78 %) 2 s et P9 glisse', () => {
        const r = proposerFermetures(td, m, 70);
        // Voitures sous 81 % : V1, V2, V4, V5 ; ni le bus ni les piétons.
        expect(r.map(f => f.groupe)).toEqual([1, 2, 4, 5]);
        const v2 = r.find(f => f.groupe === 2);
        expect([v2.deb, v2.fin, v2.duree]).toEqual([23, 29, 6]);
        expect(v2.glissements).toEqual([3]);
        expect(Math.round(v2.capacite)).toBe(67);
        // V1 : V4, P6, P7 retenus par B3 ; rien n'est proposé.
        const v1 = r.find(f => f.groupe === 1);
        expect(v1.duree).toBe(0);
        expect(v1.glissements).toEqual([]);
        expect(v1.retenus).toEqual(expect.arrayContaining([{ id: 4, par: 3 }, { id: 7, par: 3 }]));
        const v4 = r.find(f => f.groupe === 4);
        // P9 peut ouvrir à 68 s : V5→P9 4 s, V5 ferme à 64 s. P8 non : V5→P8 6 s.
        expect([v4.deb, v4.fin, v4.glissements]).toEqual([62, 64, [9]]);
        expect(v4.retenus).toEqual(expect.arrayContaining([{ id: 8, par: 5 }]));
        expect(r.filter(f => f.duree > 0).map(f => f.groupe)).toEqual([2, 4]);
    });

    it('groupe au-dessus du seuil : pas de fermeture', () => {
        expect(proposerFermetures(td, m, 70, 70).map(f => f.groupe)).toEqual([2, 5]);
    });

    it('le vert mini borne la fermeture', () => {
        const r = proposerFermetures(td.map(x => (x.id === 2 ? { ...x, vertMini: 26 } : x)), m, 70);
        const v2 = r.find(f => f.groupe === 2);
        expect([v2.deb, v2.duree]).toEqual([26, 3]);
    });
});
