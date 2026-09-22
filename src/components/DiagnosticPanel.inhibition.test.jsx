import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DiagnosticPanel from './DiagnosticPanel';
import { groupesInhibes } from '../utils/trafficHelpers';
import { actionsSimulables, conflitsSimules } from './SimulationPanel';

/**
 * Deux tableaux voisins, une seule lecture des mêmes règles.
 *
 * Le dossier imprimé pose côte à côte les données de trafic et la réserve de
 * capacité. Le premier laisse vides les colonnes calculées d'un groupe qu'une
 * action cochée en simulation inhibe — escamotage de phase, fermeture
 * anticipée, adaptatif vertical : son vert ne vaut plus ce que le plan
 * annonce, sa capacité non plus. Le second les calculait quand même, et
 * annonçait un degré de saturation pour un groupe dont le tableau du dessus ne
 * donnait aucune capacité.
 *
 * Les règles qui décident de tout cela — quels groupes sont inhibés, quelles
 * actions la simulation rejoue, quels conflits elle retient — vivaient chacune
 * dans un seul composant. Le dossier imprimé en aurait tenu une copie ; c'est
 * ainsi que le tableau de trafic imprimé avait fini par diverger de celui de
 * l'écran. Elles sont désormais exportées, et ces tests les tiennent.
 */

const groupe = (id, vert, coef) => ({
    id, name: `V${id}`, type: 'VL', offset: 0, laneCoef: coef,
    durations: { green: vert, orange: 3, red: 60 - vert - 3 }
});

const action = (id, nom, gf, sur = {}) => ({
    id, action: nom, gf: String(gf), deb: '10', fin: '30',
    actGf1: '', description: '', ...sur
});

describe('Groupes inhibés — la règle partagée', () => {
    const actions = [
        action(1, 'Escamotage de phase', 3),
        action(2, 'Fermeture anticipée', 5),
        action(3, 'Adaptatif vertical', 7),
        action(4, 'Ouverture anticipée', 9),   // n'inhibe pas
        action(5, 'Seconde lucarne', 11)       // n'inhibe pas
    ];

    it('ne retient que les trois familles qui suppriment du vert', () => {
        expect([...groupesInhibes(actions, [1, 2, 3, 4, 5])].sort()).toEqual([3, 5, 7]);
    });

    it("une action non cochée n'inhibe rien", () => {
        expect([...groupesInhibes(actions, [4, 5])]).toEqual([]);
        expect([...groupesInhibes(actions, [])]).toEqual([]);
    });

    // Le champ « GF » d'une action porte un numéro, parfois précédé d'un G.
    // C'est la seule lettre que la lecture enlève : écrire « GF7 » ne donnerait
    // rien, ici comme dans le filtre des conflits.
    it("lit le groupe même précédé d'un G", () => {
        expect([...groupesInhibes([action(9, 'Adaptatif vertical', 'G7')], [9])]).toEqual([7]);
    });
});

describe('Réserve de capacité — un groupe inhibé ne montre plus de chiffres', () => {
    const groupes = [groupe(1, 20, 0.9), groupe(3, 25, 1.8)];
    const trafic = { 1: { trafficVol: 320 }, 3: { trafficVol: 1200 } };
    const dessiner = (inhibes) => render(
        <DiagnosticPanel
            groups={groupes}
            cycleLength={60}
            getTrafficData={(id) => trafic[id] || {}}
            actionData={[]}
            activeTrafficDataset="HPM"
            inhibitedGroups={inhibes}
            hideTitle
        />
    );

    /** Les cellules calculées d'une ligne — tout sauf la colonne GF. */
    const cellules = (container, gfId) => {
        const ligne = [...container.querySelectorAll('.diagnostic-table tbody tr')]
            .find(tr => tr.querySelector('.dg-id')?.textContent === `GF${gfId}`);
        return ligne ? [...ligne.querySelectorAll('td')].slice(1).map(td => td.textContent.trim()) : null;
    };

    it('sans inhibition, les deux groupes sont chiffrés', () => {
        const { container } = dessiner(null);
        expect(cellules(container, 1).every(v => v === '—')).toBe(false);
        expect(cellules(container, 3).every(v => v === '—')).toBe(false);
    });

    it('le groupe inhibé perd ses cinq colonnes, et lui seul', () => {
        const { container } = dessiner(new Set([1]));
        expect(cellules(container, 1), 'GF1 est inhibé : ses chiffres ne veulent plus rien dire')
            .toEqual(['—', '—', '—', '—', '—']);
        expect(cellules(container, 3).every(v => v === '—'), 'GF3 a été effacé à tort').toBe(false);
    });

    it("le groupe inhibé ne peut plus être le courant dimensionnant", () => {
        // GF1 est le plus chargé au regard de son vert ; inhibé, la synthèse
        // doit désigner GF3 et non un groupe dont on n'affiche aucun chiffre.
        const { container } = dessiner(new Set([1]));
        const synthese = container.querySelector('.diagnostic-carrefour');
        if (synthese) expect(synthese.textContent).not.toContain('GF1');
    });

    it('la ligne inhibée reste identifiable', () => {
        const { container } = dessiner(new Set([1]));
        const ligne = [...container.querySelectorAll('.diagnostic-table tbody tr')]
            .find(tr => tr.querySelector('.dg-id')?.textContent === 'GF1');
        expect(ligne.className).toContain('row-inhibited');
    });
});

describe('Actions et conflits de la simulation — les listes partagées', () => {
    it('six familles restent hors simulation', () => {
        const actions = [
            action(1, 'Escamotage de phase', 1),
            action(2, 'Début de bande passante', 2),
            action(3, 'Fin de bande passante', 3),
            action(4, 'Priorité piétons', 4),
            action(5, 'Signal aide conduite', 5),
            action(6, 'Synchro BTS', 6),
            action(7, "Flèche d'anticipation", 7),
            action(8, 'Ouverture anticipée', 8),
            action(9, '', 9)
        ];
        expect(actionsSimulables(actions).map(a => a.id)).toEqual([1, 8]);
    });

    it('un escamotage coché absorbe le conflit du couple qu\'il nomme', () => {
        const conflits = [
            { from: 3, to: 13, message: 'Dégagement insuffisant' },
            { from: 5, to: 10, message: 'Dégagement insuffisant' }
        ];
        const actions = [action(1, 'Escamotage', 3, { actGf1: '13' })];
        expect(conflitsSimules(conflits, actions, [1])).toEqual([conflits[1]]);
    });

    it('le couple est absorbé dans les deux sens', () => {
        const conflits = [{ from: 13, to: 3, message: 'Dégagement insuffisant' }];
        const actions = [action(1, 'Escamotage', 3, { actGf1: 'G13' })];
        expect(conflitsSimules(conflits, actions, [1])).toEqual([]);
    });

    it("un escamotage non coché ne masque aucun conflit", () => {
        const conflits = [{ from: 3, to: 13, message: 'Dégagement insuffisant' }];
        const actions = [action(1, 'Escamotage', 3, { actGf1: '13' })];
        expect(conflitsSimules(conflits, actions, [])).toEqual(conflits);
    });
});
