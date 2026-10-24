/**
 * Onde verte sur téléphone.
 * Régression de référence (24/10/2026) : le diagramme gardait sa largeur
 * d'ordinateur (plus de 1 000 px) et était coupé au bord de l'écran ; le titre
 * et le tableau des données élargissaient toute la page.
 */
import { expect, test } from '@playwright/test';

for (const [nom, taille] of [
    ['portrait', { width: 390, height: 844 }],
    ['paysage', { width: 844, height: 390 }],
] as const) {
    test(`téléphone en ${nom} : l'onde verte tient dans la largeur de l'écran`, async ({ page }) => {
        await page.setViewportSize(taille);
        await page.goto('/?greenwave&example=ondeverte');
        const diagramme = page.locator('.green-wave-svg');
        await expect(diagramme).toBeVisible();

        // Le diagramme entier, axe du temps compris, est dans l'écran.
        const cadre = await diagramme.boundingBox();
        expect(cadre!.x).toBeGreaterThanOrEqual(0);
        expect(cadre!.x + cadre!.width).toBeLessThanOrEqual(taille.width);
        // Proportions conservées : pas d'étirement.
        const [l, h] = await diagramme.evaluate((svg: SVGSVGElement) => [svg.viewBox.baseVal.width, svg.viewBox.baseVal.height]);
        expect(cadre!.height / cadre!.width).toBeCloseTo(h / l, 1);

        // Rien n'élargit la page au-delà de l'écran.
        const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(largeurPage).toBeLessThanOrEqual(taille.width);
    });
}

test("sur un écran d'ordinateur, le diagramme garde son échelle", async ({ page }) => {
    await page.goto('/?greenwave&example=ondeverte');
    const diagramme = page.locator('.green-wave-svg');
    await expect(diagramme).toBeVisible();
    const [largeur, dessin] = await diagramme.evaluate((svg: SVGSVGElement) => [svg.getBoundingClientRect().width, svg.viewBox.baseVal.width]);
    expect(Math.round(largeur)).toBeGreaterThanOrEqual(Math.round(dessin));
});
