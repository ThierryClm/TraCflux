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
