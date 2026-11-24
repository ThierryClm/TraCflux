import { describe, expect, it } from 'vitest';
import { analyserDiagramme } from './analyseDiagramme';
import type { Groupe, Matrice } from '../types/projet';

const g = (id: number, type: string, offset: number, green: number, extra: Partial<Groupe> = {}): Groupe => ({
    id, name: `Groupe ${id}`, type: type as Groupe['type'], minGreen: 6, offset,
    durations: { green, orange: type === 'P' ? 8 : 3, red: 0 }, ...extra
});
const ids = (r: ReturnType<typeof analyserDiagramme>) => r.constats.map(c => c.id);

describe('analyserDiagramme', () => {
    // Deux phases propres : G1 véhicules 0-30, G2 piétons 36-50, cycle 60.
    const groupes = [g(1, 'V', 0, 30, { signal: 'R11v', courant: 'TD' }), g(2, 'P', 36, 14, { signal: 'R12', courant: 'Piéton' })];
    const matrice: Matrice = [['', 5], [8, '']];

    it('ne signale rien sur un plan conforme', () => {
        const r = analyserDiagramme({ groups: groupes, cycleLength: 60, conflictMatrix: matrice,
            intersectionArrows: [{ id: 1, groupId: 1, x: 0, y: 0 }, { id: 2, groupId: 2, x: 0, y: 0 }] });
        expect(r.constats).toEqual([]);
        expect(r.controles).toBeGreaterThan(20);
    });

    it('distingue le vert réglementaire (6 s) du vert conseillé (8 et 10 s)', () => {
        const r = analyserDiagramme({ groups: [g(1, 'V', 0, 5), g(2, 'V', 20, 8)], cycleLength: 60, conflictMatrix: [['', ''], ['', '']] });
        const mini = r.constats.find(c => c.id === 'vert-mini')!;
        expect(mini.niveau).toBe('obligation');
        expect(mini.groupes).toEqual([1]);
        const confort = r.constats.find(c => c.id === 'vert-confort')!;
        expect(confort.niveau).toBe('information');
        expect(confort.groupes).toEqual([2]);
    });

    it('contrôle le jaune de 3 ou 5 s, et le disque R17 de 3 à 8 s', () => {
        const r = analyserDiagramme({
            groups: [g(1, 'V', 0, 20, { durations: { green: 20, orange: 4, red: 0 } }),
                g(2, 'B', 30, 10, { signal: 'R17', durations: { green: 10, orange: 6, red: 0 } })],
            cycleLength: 60, conflictMatrix: [['', ''], ['', '']]
        });
        expect(r.constats.find(c => c.id === 'jaune')!.groupes).toEqual([1]);
        expect(ids(r)).not.toContain('disque-tc');
    });

    it('applique les 120 s d\'attente à tous les courants, piétons compris', () => {
        const r = analyserDiagramme({ groups: [g(1, 'V', 0, 100), g(2, 'P', 106, 8)], cycleLength: 130, conflictMatrix: [['', 6], [8, '']] });
        expect(r.constats.find(c => c.id === 'attente-120')!.groupes).toEqual([2]);
    });

    it('signale une attente piétonne au-delà du seuil de tolérance (50 s)', () => {
        const r = analyserDiagramme({ groups: [g(1, 'V', 0, 60), g(2, 'P', 66, 8)], cycleLength: 100, conflictMatrix: [['', 6], [8, '']] });
        const c = r.constats.find(x => x.id === 'attente-pieton-maxi')!;
        expect(c.niveau).toBe('recommandation');
        expect(c.pointAttention).toBe(true);
        expect(c.groupes).toEqual([2]);
        // Le seuil est réglable : à 100 s, plus rien.
        const large = analyserDiagramme({ groups: [g(1, 'V', 0, 60), g(2, 'P', 66, 8)], cycleLength: 100, conflictMatrix: [['', 6], [8, '']], seuils: { attentePietonMaxi: 100 } });
        expect(ids(large)).not.toContain('attente-pieton-maxi');
    });

    it('signale un cycle court et un retard piéton de plus de 30 s', () => {
        const court = analyserDiagramme({ groups: [g(1, 'V', 0, 20), g(2, 'P', 24, 8)], cycleLength: 36, conflictMatrix: [['', 4], [6, '']] });
        expect(ids(court)).toContain('cycle-mini');
        const long = analyserDiagramme({ groups: [g(1, 'V', 0, 70), g(2, 'P', 76, 8)], cycleLength: 100, conflictMatrix: [['', 6], [8, '']] });
        const retard = long.constats.find(c => c.id === 'retard-pieton')!;
        expect(retard.details).toContain('GF2 Groupe 2 (42 s)');
        expect(retard.suggestion).toMatch(/hors micro-régulation/);
    });

    it('recommande un refuge au-delà de 12 m de traversée (dégagement > 12 s)', () => {
        const r = analyserDiagramme({ groups: groupes, cycleLength: 60, conflictMatrix: [['', 5], [14, '']] });
        expect(r.constats.find(c => c.id === 'refuge-12m')!.groupes).toEqual([2]);
    });

    it('relève conflits et incompatibilités déclarées dans un seul sens, en règle non respectée', () => {
        const r = analyserDiagramme({ groups: [g(1, 'V', 0, 30), g(2, 'V', 31, 20)], cycleLength: 60, conflictMatrix: [['', 5], ['', '']] });
        expect(ids(r)).toEqual(expect.arrayContaining(['conflits', 'matrice-asymetrique']));
        expect(r.constats.find(c => c.id === 'matrice-asymetrique')!.niveau).toBe('obligation');
    });

    it('contrôle la cohérence de la matrice : diagonale, temps trop faible, temps plus long que le cycle', () => {
        const r = analyserDiagramme({
            groups: [g(1, 'V', 0, 20), g(2, 'V', 25, 20)],
            cycleLength: 60, conflictMatrix: [[4, 2], [70, '']]
        });
        expect(ids(r)).toEqual(expect.arrayContaining(['matrice-diagonale', 'intervert-faible', 'intervert-cycle']));
    });

    it('signale une matrice vide comme point d\'attention', () => {
        const r = analyserDiagramme({ groups: [g(1, 'V', 0, 20), g(2, 'V', 25, 20)], cycleLength: 60, conflictMatrix: [['', ''], ['', '']] });
        const c = r.constats.find(x => x.id === 'matrice-vide')!;
        expect(c.niveau).toBe('recommandation');
        expect(c.pointAttention).toBe(true);
    });

    it('vérifie le signal selon le type, R11v admis pour un bus', () => {
        const r = analyserDiagramme({
            groups: [g(1, 'V', 0, 20, { signal: 'R12' }), g(2, 'B', 30, 10, { signal: 'R11v' })],
            cycleLength: 60, conflictMatrix: [['', ''], ['', '']]
        });
        expect(r.constats.find(c => c.id === 'signal-type')!.groupes).toEqual([1]);
    });

    it('repère un R11 et un R14 sur des flèches voisines de même orientation', () => {
        const groupes = [
            g(1, 'V', 0, 8, { signal: 'R11v', courant: 'TD' }),
            g(2, 'V', 9, 8, { signal: 'R14d', courant: 'TD' }),
            g(3, 'V', 18, 8, { signal: 'R14tg', courant: 'TG' }),
            g(4, 'V', 27, 8, { signal: 'R14td', courant: 'TG' }),
            g(5, 'V', 36, 8, { signal: 'R14dtg', courant: 'TG' }),
            g(6, 'V', 45, 8, { signal: 'R14dtd', courant: 'TG' })
        ];
        const fleches = [
            { id: 1, groupId: 1, x: 40, y: 60, rotation: 90 },
            { id: 2, groupId: 2, x: 44, y: 61, rotation: 92 }
        ];
        const r = analyserDiagramme({ groups: groupes, cycleLength: 60, conflictMatrix: [], intersectionArrows: fleches });
        expect(r.constats.find(c => c.id === 'r11-r14-image')!.details)
            .toContain('GF1 Groupe 1 (R11v) et GF2 Groupe 2 (R14d) — flèches à 4.1 % l\'une de l\'autre, 2° d\'écart');
        expect(r.constats.find(c => c.id === 'r14-trop')!.niveau).toBe('recommandation');
        // Flèches éloignées ou d'orientation différente : rien.
        const loin = analyserDiagramme({ groups: groupes, cycleLength: 60, conflictMatrix: [],
            intersectionArrows: [{ id: 1, groupId: 1, x: 10, y: 10, rotation: 90 }, { id: 2, groupId: 2, x: 80, y: 80, rotation: 92 }] });
        expect(ids(loin)).not.toContain('r11-r14-image');
        const tournees = analyserDiagramme({ groups: groupes, cycleLength: 60, conflictMatrix: [],
            intersectionArrows: [{ id: 1, groupId: 1, x: 40, y: 60, rotation: 0 }, { id: 2, groupId: 2, x: 42, y: 61, rotation: 90 }] });
        expect(ids(tournees)).not.toContain('r11-r14-image');
        // Sans flèches renseignées, pas de conclusion.
        const sansImage = analyserDiagramme({ groups: groupes, cycleLength: 60, conflictMatrix: [] });
        expect(ids(sansImage)).not.toContain('r11-r14-image');
    });

    it('suggère une flèche par groupe, sans contrôler les retours de flèche', () => {
        const r = analyserDiagramme({
            groups: [g(1, 'V', 0, 20, { courant: 'TD_TàD' }), g(2, 'V', 30, 10, { courant: 'TàG' }), g(3, 'V', 45, 8, { courant: 'TD' })],
            cycleLength: 60, conflictMatrix: [['', '', ''], ['', '', ''], ['', '', '']],
            intersectionArrows: [{ id: 1, groupId: 1, x: 0, y: 0, turnLength: 0.5 }, { id: 2, groupId: 2, x: 0, y: 0, turnLength: 0.4 }]
        });
        expect(r.constats.map(c => c.id)).not.toContain('retour-fleche');
        expect(r.constats.find(c => c.id === 'sans-fleche')!.groupes).toEqual([3]);
    });

    it('ne fait aucune suggestion sur les groupes Priorité piétons (sans mini ni jaune)', () => {
        const pp = g(2, 'PP', 0, 0, { signal: 'A13b', courant: 'PP', minGreen: 0, durations: { green: 0, orange: 0, red: 0 } });
        const r = analyserDiagramme({ groups: [g(1, 'V', 0, 20, { courant: 'TD' }), pp], cycleLength: 60, conflictMatrix: [['', ''], ['', '']],
            intersectionArrows: [{ id: 1, groupId: 1, x: 0, y: 0 }] });
        expect(r.constats.flatMap(c => c.groupes)).not.toContain(2);
    });

    it('ne fait aucune suggestion sur un groupe porteur d\'un signal d\'aide à la conduite', () => {
        const sac = g(2, 'V', 0, 3, { minGreen: 0 });
        const r = analyserDiagramme({ groups: [g(1, 'V', 0, 20), sac], cycleLength: 60, conflictMatrix: [['', ''], ['', '']],
            actionData: [{ id: 1, gf: '2', action: 'Signal aide conduite', deb: 10, fin: 20 }] as never });
        expect(r.constats.flatMap(c => c.groupes)).not.toContain(2);
    });

    it('ignore les groupes sans type ou sans vert et les compte', () => {
        const vide = g(2, '', 0, 0, { minGreen: 0, durations: { green: 0, orange: 0, red: 0 } });
        const r = analyserDiagramme({ groups: [g(1, 'V', 10, 20, { signal: 'R11v' }), vide], cycleLength: 60, conflictMatrix: [['', ''], ['', '']] });
        expect(r.groupesIgnores).toBe(1);
        expect(r.constats.flatMap(c => c.groupes)).not.toContain(2);
    });

    it('applique aux piétons leur propre seuil de vert, à 6 s par défaut', () => {
        const r = analyserDiagramme({ groups: [g(1, 'V', 0, 30), g(2, 'P', 36, 8)], cycleLength: 60, conflictMatrix: [['', 5], [8, '']] });
        // À 6 s, un vert piéton de 8 s ne déclenche plus la suggestion de confort.
        expect(ids(r)).not.toContain('vert-pieton');
        expect(r.constats.find(c => c.id === 'vert-confort')?.groupes ?? []).not.toContain(2);
        const strict = analyserDiagramme({ groups: [g(1, 'V', 0, 30), g(2, 'P', 36, 8)], cycleLength: 60,
            conflictMatrix: [['', 5], [8, '']], seuils: { vertPietonSouhaite: 10 } });
        expect(strict.constats.find(c => c.id === 'vert-pieton')!.groupes).toEqual([2]);
    });

    it('suggère de vérifier les verts de plus de 40 s', () => {
        const r = analyserDiagramme({ groups: [g(1, 'V', 0, 45), g(2, 'P', 50, 6)], cycleLength: 70, conflictMatrix: [['', 4], [6, '']] });
        const c = r.constats.find(x => x.id === 'vert-long')!;
        expect(c.niveau).toBe('information');
        expect(c.groupes).toEqual([1]);
    });

    it('classe la capacité en point d\'attention orange, jamais en règle non respectée', () => {
        const groups = [g(1, 'V', 0, 20, { laneCoef: 1 }), g(2, 'V', 26, 28, { laneCoef: 1 })];
        const trafic = (id: number) => ({ trafficVol: id === 1 ? 700 : 100 });
        const r = analyserDiagramme({ groups, cycleLength: 60, conflictMatrix: [['', ''], ['', '']], getTrafficData: trafic });
        const c = r.constats.find(x => x.id === 'capacite')!;
        expect(c.niveau).toBe('recommandation');
        expect(c.pointAttention).toBe(true);
        expect(c.groupes).toEqual([1]);
    });

    it('applique la règle Cerema du tourne-à-gauche selon le trafic et la protection', () => {
        const deuxGroupes = [g(1, 'V', 10, 20, { courant: 'TàG', signal: 'R11v' }), g(2, 'V', 0, 20, { courant: 'TD', signal: 'R11v' })];
        const matrice: Matrice = [['', 5], [5, '']];
        // Au-delà de 150 uvp/h sans feu de type R14 : protection nécessaire.
        const haut = analyserDiagramme({ groups: deuxGroupes, cycleLength: 60, conflictMatrix: matrice,
            getTrafficData: id => ({ trafficVol: id === 1 ? 180 : 300 }) });
        const necessaire = haut.constats.find(c => c.id === 'tag-phase-necessaire')!;
        expect(necessaire.niveau).toBe('recommandation');
        expect(necessaire.pointAttention).toBe(true);
        // Sous 100 uvp/h mais avec un R14 : phase spéciale probablement inutile.
        const avecFleche = [g(1, 'V', 10, 20, { courant: 'TàG', signal: 'R14tg' }), deuxGroupes[1]];
        const bas = analyserDiagramme({ groups: avecFleche, cycleLength: 60, conflictMatrix: matrice,
            getTrafficData: id => ({ trafficVol: id === 1 ? 60 : 300 }) });
        expect(bas.constats.find(c => c.id === 'tag-phase-inutile')!.niveau).toBe('information');
        // Zone charnière : le trafic d'en face est rappelé.
        const charniere = analyserDiagramme({ groups: deuxGroupes, cycleLength: 60, conflictMatrix: matrice,
            getTrafficData: id => ({ trafficVol: id === 1 ? 120 : 300 }) });
        expect(charniere.constats.find(c => c.id === 'tag-charniere')!.details)
            .toContain('GF1 Groupe 1 (120 uvp/h, en face 300 uvp/h par voie)');
        expect(ids(charniere)).not.toContain('tag-phase-necessaire');
    });

    it('déconseille un TàG en conflit avec deux voies opposées, même à faible trafic', () => {
        const groupes = [g(1, 'V', 10, 20, { courant: 'TàG', signal: 'R11v' }),
            g(2, 'V', 0, 30, { courant: 'TD', signal: 'R11v', laneCoef: 1.8 })];
        const r = analyserDiagramme({ groups: groupes, cycleLength: 60, conflictMatrix: [['', 5], [5, '']],
            getTrafficData: id => ({ trafficVol: id === 1 ? 40 : 300 }) });
        const c = r.constats.find(x => x.id === 'tag-conflit-voies')!;
        expect(c.niveau).toBe('recommandation');
        expect(c.pointAttention).toBe(true);
        expect(c.details).toContain('GF1 Groupe 1 (2 voies opposées, 40 uvp/h)');
        // Une protection R14 à faible trafic ne déclenche pas « phase inutile »
        // quand deux voies opposées sont en jeu.
        const protege = analyserDiagramme({ groups: [g(1, 'V', 10, 20, { courant: 'TàG', signal: 'R14tg' }), groupes[1]],
            cycleLength: 60, conflictMatrix: [['', 5], [5, '']], getTrafficData: id => ({ trafficVol: id === 1 ? 40 : 300 }) });
        expect(ids(protege)).not.toContain('tag-phase-inutile');
    });

    it('affiche les règles non respectées avant les recommandations et les suggestions', () => {
        const r = analyserDiagramme({
            groups: [g(1, 'V', 0, 4), g(2, 'V', 20, 8), g(3, 'V', 30, 20)],
            cycleLength: 60, conflictMatrix: [['', ''], ['', ''], ['', '']]
        });
        const niveaux = r.constats.map(c => c.niveau);
        expect(niveaux[0]).toBe('obligation');
        const premierOrange = niveaux.indexOf('recommandation');
        const premierBleu = niveaux.indexOf('information');
        expect(premierOrange).toBeGreaterThan(0);
        expect(premierBleu).toBeGreaterThan(premierOrange);
    });
});
