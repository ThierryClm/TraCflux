/**
 * Téléphone en portrait (390 × 844).
 * Régressions de référence (24/10/2026) :
 * - la matrice des interverts dépassait de son panneau et ne se lisait qu'en
 *   la faisant défiler, alors qu'elle tenait en paysage ;
 * - l'« Assistant conception » s'ouvrait en fenêtre détachée, qui devient
 *   sur un téléphone un onglet affiché en largeur d'ordinateur : minuscule.
 */
import { expect, test } from '@playwright/test';
import { ouvrirExemple, ouvrirMenu } from './aide';

test.use({ viewport: { width: 390, height: 844 } });

test('la matrice du carrefour exemple tient dans la largeur du téléphone', async ({ page }) => {
    await ouvrirExemple(page);
    await page.getByText('Matrice', { exact: true }).first().click();
    const defilement = page.locator('.matrix-scroll').first();
    await expect(defilement).toBeVisible();
    const [visible, totale] = await defilement.evaluate(e => [e.clientWidth, e.scrollWidth]);
    expect(totale).toBeLessThanOrEqual(visible);
    // Les noms abrégés gardent leur nom complet en infobulle.
    await expect(page.locator('.matrix-grid .row-name').first()).toHaveAttribute('title', 'Rue BALISE nord');
});

test("l'assistant conception s'ouvre dans la page, sur toute la largeur de l'écran", async ({ page, context }) => {
    await ouvrirExemple(page);
    let fenetres = 0;
    context.on('page', () => { fenetres++; });
    const item = page.locator('.menu-bar').getByText('Assistant conception...', { exact: true });
    await ouvrirMenu(page, 'Diagramme', item);
    await item.click();
    const assistant = page.locator('.modal-content.suggestion-cycle');
    await expect(assistant).toBeVisible();
    const cadre = await assistant.boundingBox();
    expect(cadre!.x).toBeLessThanOrEqual(1);
    expect(cadre!.width).toBeGreaterThanOrEqual(388);
    // Aucune fenêtre détachée ; la page ne déborde plus de l'écran.
    expect(fenetres).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await assistant.getByRole('button', { name: 'Fermer' }).click();
    await expect(assistant).toHaveCount(0);
    await expect(page.locator('.split-view')).toBeVisible();
});
