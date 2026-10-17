import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { render } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';
import { calculateSimulatedDiagram } from '../simulation';

/**
 * Escamotage : un seul rendu dans le plan de feu et en simulation — bandeau
 * hachuré (hachures sombres) sur la moitié basse de la barre, le vert restant
 * visible au-dessus. Coché en simulation, l'escamotage a lieu et la zone
 * prend toute la hauteur.
 */

const ici = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(ici, 'TimelineDiagram.css'), 'utf8');
const regle = (selecteur) => {
    const i = css.indexOf(`${selecteur} {`);
    return css.slice(i, css.indexOf('}', i));
};

const PPS = 10;
const groupe = (id, offset, green) => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5, offset,
    durations: { green, orange: 3, red: 46 - green - 3 }
});
const groupes = [groupe(1, 16, 11), groupe(2, 31, 8)];
const actions = [{
    id: 1, action: 'Escamotage', gf: '1', deb: '16', fin: '27', actGf1: '1',
    actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '', plage1: '', plage2: '', abrv: '', description: '', micro: ''
}];
const matrice = groupes.map(() => groupes.map(() => ''));

const diagramme = (cochees) => render(
    <TimelineDiagram
        groups={groupes} cycleLength={46} pixelsPerSecond={PPS} conflicts={[]} conflictMatrix={matrice}
        actionData={actions}
        simulationResult={cochees ? calculateSimulatedDiagram(groupes, actions, cochees, 46, matrice) : null}
        simulationFilter={cochees ? new Set(cochees) : null}
        cycleLengthInput="46" setCycleLengthInput={() => {}} setCycleLength={() => {}}
        onGroupClick={() => {}} updateGroupParams={() => {}} updateActionRow={() => {}}
        setHoveredActionId={() => {}} startDrag={() => {}} endDrag={() => {}}
    />
).container;

describe('Escamotage — bandeau hachuré sur la moitié basse', () => {
    it('non coché : bandeau sur la moitié basse ; coché : toute la hauteur', () => {
        expect(regle('.green-cut-overlay')).toContain('bottom: 7px');
        expect(regle('.green-cut-overlay')).toContain('height: calc((100% - 14px) / 2)');
        expect(regle('.green-cut-overlay.escamote')).toContain('top: 7px');
        expect(regle('.green-cut-overlay.escamote')).toContain('height: auto');
    });

    it('en simulation, non coché : le vert reste affiché sous le bandeau', () => {
        const ligne = diagramme([]).querySelectorAll('.timeline-row-track')[0];
        expect(ligne.querySelector('.green-cut-overlay:not(.escamote)')).not.toBeNull();
        expect(parseFloat(ligne.querySelector('.phase-bar.green').style.width)).toBe(11 * PPS);
    });

    it('dans le plan de feu : mêmes hachures sombres que la simulation', () => {
        const svg = diagramme(null);
        expect(svg.querySelector('pattern[id^="escam-hatch-"] line.escamotage-hachure-trait')).not.toBeNull();
        expect(svg.querySelector('rect.escamotage-hachure-cadre')).not.toBeNull();
        expect(css).toMatch(/\.escamotage-hachure-trait\s*\{\s*stroke: var\(--escamotage-hachure\)/);
        expect(regle('.green-cut-overlay')).toContain('var(--escamotage-hachure)');
    });
});
