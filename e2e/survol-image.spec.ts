/**
 * Survol de l'image du carrefour : seule une flèche réellement visée réagit.
 * Le cadre carré du symbole, agrandi et tourné avec elle, recouvrait ses
 * voisines et gardait le focus sur le groupe survolé juste avant.
 */
import { expect, test } from '@playwright/test';
import { ouvrirExemple } from './aide';

test('le long de son tracé, chaque flèche réagit à la place de ses voisines', async ({ page }) => {
    await ouvrirExemple(page);
    await page.locator('.pf-tab.simulation-tab').click();
    const marqueurs = page.locator('.intersection-image-area .arrow-marker');
    await expect(marqueurs).not.toHaveCount(0);

    const { justes, total } = await marqueurs.evaluateAll((liste) => {
        let justes = 0;
        let total = 0;
        for (const marqueur of liste) {
            marqueur.scrollIntoView({ block: 'center', inline: 'center' });
            const traits = [...marqueur.querySelectorAll<SVGGeometryElement>('svg line, svg polyline, svg path')]
                .filter(trait => !trait.classList.contains('fleche-prise'));
            for (const trait of traits) {
                const longueur = trait.getTotalLength();
                const repere = trait.getScreenCTM()!;
                for (let i = 0; i <= 8; i++) {
                    const point = trait.getPointAtLength(longueur * i / 8);
                    const x = repere.a * point.x + repere.c * point.y + repere.e;
                    const y = repere.b * point.x + repere.d * point.y + repere.f;
                    const cible = document.elementFromPoint(x, y);
                    if (!cible?.closest('.intersection-image-area')) continue;
                    total++;
                    if (cible.closest('.arrow-marker') === marqueur) justes++;
                }
            }
        }
        return { justes, total };
    });

    // Les flèches de l'exemple se croisent par endroits : la marge couvre ces croisements.
    expect(total).toBeGreaterThan(0);
    expect(justes / total).toBeGreaterThan(0.9);
});
