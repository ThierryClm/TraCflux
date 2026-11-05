/**
 * Fenêtre détachée : la matrice s'ouvre dans sa propre fenêtre (second
 * écran, visio) et reste solidaire du projet, couleurs d'écart comprises.
 */
import { expect, test } from '@playwright/test';
import { ongletsPlans, ouvrirExemple } from './aide';

test('la matrice détachée s\'ouvre dans sa fenêtre, avec les écarts du plan affiché', async ({ page, context }) => {
    await ouvrirExemple(page);
    await ongletsPlans(page).filter({ hasText: 'PF_90' }).click();
    const nouvelle = context.waitForEvent('page');
    await page.locator('.matrix-container-inline .detach-btn').first().click();
    const fenetre = await nouvelle;
    await expect(fenetre.locator('.matrix-grid')).toBeVisible();
    await expect(fenetre.locator('.matrix-grid .matrix-compare-higher')).toHaveCount(1);
    await expect(fenetre.locator('.matrix-grid .matrix-compare-lower')).toHaveCount(21);

    // Changer de plan dans la fenêtre principale met la fenêtre détachée à jour.
    await ongletsPlans(page).filter({ hasText: 'PF_80' }).click();
    await expect(fenetre.locator('.matrix-grid .matrix-compare-higher')).toHaveCount(2);
    await expect(fenetre.locator('.matrix-grid .matrix-compare-lower')).toHaveCount(18);
});

test('une liste déroulante garde la main sur la fenêtre détachée, qui remonte ensuite', async ({ page, context }) => {
    await ouvrirExemple(page);
    await page.evaluate(() => {
        const espion = window as Window & { remontees?: number };
        espion.remontees = 0;
        const ouvrir = window.open;
        window.open = (...args) => {
            const fenetre = ouvrir.apply(window, args);
            if (fenetre) {
                const focaliser = fenetre.focus.bind(fenetre);
                fenetre.focus = () => { espion.remontees = (espion.remontees ?? 0) + 1; focaliser(); };
            }
            return fenetre;
        };
    });
    const remontees = () => page.evaluate(() => (window as Window & { remontees?: number }).remontees ?? 0);

    const nouvelle = context.waitForEvent('page');
    await page.locator('.matrix-container-inline .detach-btn').first().click();
    await expect((await nouvelle).locator('.matrix-grid')).toBeVisible();
    await page.bringToFront();
    await page.waitForTimeout(1300);
    const avant = await remontees();

    // Passé le délai de remontée, la liste n'a pas été dérangée.
    const liste = page.locator('select.input-type').first();
    await liste.click();
    await page.waitForTimeout(1300);
    await expect(liste).toBeFocused();
    expect(await remontees()).toBe(avant);

    // Une fois quittée, la fenêtre détachée revient au premier plan.
    await page.keyboard.press('Escape');
    await page.locator('.diagram-title span').first().click();
    await expect.poll(remontees).toBeGreaterThan(avant);
});
