import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * L'accord entre la règle de surlignage et l'élément réellement dessiné.
 *
 * Les tests voisins vérifient que la classe `highlighted` est bien posée. Ils
 * ne disent rien de ce qu'elle déclenche — et c'est par là que le défaut est
 * passé en septembre 2026 : le tracé des bandes passantes avait été converti
 * de `<line>` en `<path>`, la règle CSS visait toujours `.debut-bande-arrows
 * line`. La classe était posée, la règle ne correspondait à rien, et le
 * surlignage était mort depuis des semaines. Aucun test ne pouvait le voir.
 *
 * Celui-ci lit les deux fichiers et confronte leurs vocabulaires : pour chaque
 * famille dessinée en SVG, les balises visées par les règles `.famille
 * .highlighted <balise>` doivent exister dans le JSX de cette famille.
 *
 * Il ne prouve pas que le style est visible — cela demanderait un navigateur.
 * Il prouve que la règle a une cible, ce qui est exactement ce qui manquait.
 */

const ici = path.dirname(fileURLToPath(import.meta.url));
const jsx = readFileSync(path.join(ici, 'TimelineDiagram.jsx'), 'utf8');
const css = readFileSync(path.join(ici, 'TimelineDiagram.css'), 'utf8');

// Familles dessinées en SVG : leur règle de surlignage nomme une balise, et
// c'est ce nom qui peut se désaccorder du code.
const FAMILLES_SVG = [
    'point-repos-arrows',
    'synchro-bts-arrows',
    'instant-co-arrows',
    'escamotage-arrows',
    'debut-bande-arrows',
    'fin-bande-arrows'
];

/** Les balises SVG dessinées dans le JSX d'une famille. */
const balisesDessinees = (famille) => {
    const balises = new Set();
    const lignes = jsx.split('\n');
    lignes.forEach((ligne, i) => {
        if (!ligne.includes(famille) || !ligne.includes('className')) return;
        // Le corps du <svg> suit sa déclaration ; 40 lignes couvrent le plus
        // long (bande passante qui enjambe la fin de cycle).
        lignes.slice(i, i + 40).join('\n')
            .split('</svg>')[0]
            .replace(/<(line|path|polygon|rect|circle)\b/g, (_, b) => balises.add(b))
    });
    return balises;
};

/** Les balises visées par les règles de surlignage d'une famille. */
const balisesVisees = (famille) => {
    const visees = new Set();
    const motif = new RegExp(`\\.${famille}\\.highlighted\\s+([a-z]+)`, 'g');
    let m;
    while ((m = motif.exec(css)) !== null) visees.add(m[1]);
    return visees;
};

describe('Surlignage — la règle CSS vise une balise qui existe', () => {
    FAMILLES_SVG.forEach(famille => {
        it(`.${famille} : tout ce que le CSS vise est dessiné`, () => {
            const dessinees = balisesDessinees(famille);
            const visees = balisesVisees(famille);

            // Le test n'a de sens que si les deux côtés existent.
            expect(dessinees.size, `aucune balise SVG trouvée pour .${famille}`).toBeGreaterThan(0);
            expect(visees.size, `aucune règle .${famille}.highlighted dans le CSS`).toBeGreaterThan(0);

            const orphelines = [...visees].filter(b => !dessinees.has(b));
            expect(
                orphelines,
                `le CSS surligne <${orphelines.join('>, <')}> que .${famille} ne dessine pas — `
                + `il dessine <${[...dessinees].join('>, <')}>`
            ).toEqual([]);
        });
    });

    it('le tracé des bandes passantes est bien visé, quelle que soit sa balise', () => {
        // Régression nommée : c'est ce tracé qui est passé de <line> à <path>.
        ['debut-bande-arrows', 'fin-bande-arrows'].forEach(famille => {
            const dessinees = balisesDessinees(famille);
            const visees = balisesVisees(famille);
            const traces = [...dessinees].filter(b => b === 'line' || b === 'path');
            expect(traces.length, `.${famille} ne dessine ni <line> ni <path>`).toBeGreaterThan(0);
            traces.forEach(b => {
                expect(visees.has(b), `.${famille}.highlighted ne vise pas <${b}>, qui est pourtant dessiné`).toBe(true);
            });
        });
    });
});
