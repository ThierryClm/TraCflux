import { describe, it, expect } from 'vitest';
import { intervertMinimal, migrerGroupes, matriceDuCache, plansDuCache, matriceDuFichier, largeursColonnesBornees } from './lectureProjet';

describe('lecture d\'un projet', () => {
    it('intervert minimal : 0 s pour piétons et cycles, 3 s sinon', () => {
        expect(intervertMinimal({ type: 'P' })).toBe(0);
        expect(intervertMinimal({ type: 'Cycliste' })).toBe(0);
        expect(intervertMinimal({ type: 'VL' })).toBe(3);
        expect(intervertMinimal(undefined)).toBe(3);
    });

    it('groupes à l\'ancien format : durées à plat, champs manquants complétés', () => {
        const [g] = migrerGroupes([{ id: 4, green: 22, orange: 4 }]);
        expect(g.durations).toEqual({ green: 22, orange: 4, red: 0 });
        expect(g).toMatchObject({ id: 4, name: 'Groupe 4', type: 'VL', minGreen: 6, offset: 0, laneCoef: 1 });
        // greenDuration, plus ancien encore ; id absent → rang + 1
        expect(migrerGroupes([{ greenDuration: 15 }])[0]).toMatchObject({ id: 1, durations: { green: 15 } });
    });

    it('matrice du cache : redimensionnée, valeurs hors bornes effacées', () => {
        const data = {
            groups: [{ id: 1, type: 'VL' }, { id: 2, type: 'P' }],
            conflictMatrix: [['', 2, 9], [0, '', 5]]
        };
        // 2 s depuis un VL (< 3) : effacé ; 0 s depuis un piéton : admis.
        expect(matriceDuCache(data)).toEqual([['', ''], [0, '']]);
        expect(matriceDuCache({ groups: [{ id: 1 }] })).toEqual([['']]);
        expect(matriceDuCache({})).toBeNull();
    });

    it('projet d\'avant les plans de feux : une table d\'actions devient PF1', () => {
        const data = { groups: [{ id: 1, offset: 5, durations: { green: 12 } }], actionData: [{ id: 1 }] };
        const lus = plansDuCache(data);
        expect(lus.activePFId).toBe(1);
        expect(lus.pfTabs).toHaveLength(1);
        expect(lus.pfTabs[0]).toMatchObject({ id: 1, name: 'PF1', data: [{ id: 1 }], remarques: '' });
        expect(lus.pfTabs[0].diagram[0]).toMatchObject({ groupId: 1, offset: 5, greenDuration: 12 });
        expect(plansDuCache({})).toBeNull();
    });

    it('plans du cache : structure complétée, plan actif repris', () => {
        const data = { groups: [{ id: 1 }], conflictMatrix: [['']], pfTabs: [{ id: 3, name: 'A' }], activePFId: 3 };
        const lus = plansDuCache(data);
        expect(lus.activePFId).toBe(3);
        expect(lus.pfTabs[0]).toMatchObject({ id: 3, name: 'A', data: [], remarques: '', conflictMatrix: [['']] });
    });

    it('matrice d\'un fichier : purgée, ou vide de 5 groupes par défaut', () => {
        expect(matriceDuFichier({ groups: [{ type: 'VL' }], conflictMatrix: [[25]] })).toEqual([['']]);
        expect(matriceDuFichier({})).toHaveLength(5);
    });

    it('largeurs de colonnes bornées, valeurs par défaut si absentes', () => {
        expect(largeursColonnesBornees()).toEqual({ description: 160, micro: 420, abrv: 38 });
        expect(largeursColonnesBornees({ description: 999, micro: 'x', abrv: 50.4 })).toEqual({ description: 350, micro: 420, abrv: 50 });
    });
});
