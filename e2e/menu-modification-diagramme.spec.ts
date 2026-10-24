/**
 * Menu Diagramme : Déplacer un groupe, Glisser, Insérer, Réduire et
 * bi-Carrefour sont regroupés sous « Modification du diagramme ».
 */
import { expect, test } from '@playwright/test';
import { ouvrirExemple } from './aide';

test('Diagramme → Modification du diagramme regroupe les cinq opérations', async ({ page }) => {
    await ouvrirExemple(page);
    const sousMenu = page.locator('.menu-item-with-submenu', { hasText: 'Modification du diagramme' });
    const diagramme = page.locator('.menu-bar').getByText('Diagramme', { exact: true });
    for (let i = 0; i < 6 && !(await sousMenu.isVisible()); i++) {
        await page.mouse.move(5, 400);
        await diagramme.hover();
        if (await sousMenu.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) break;
        await diagramme.click();
        await sousMenu.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
    }
    await sousMenu.hover();
    const liste = sousMenu.locator('.submenu-dropdown');
    for (const entree of ['Déplacer un groupe de feu...', 'Glisser...', 'Insérer...', 'Réduire...']) {
        await expect(liste.getByText(entree, { exact: true })).toBeVisible();
    }
    await expect(liste.getByText(/bi-Carrefour|uni-carrefour/)).toBeVisible();
    // Plus au premier niveau du menu.
    const premierNiveau = page.locator('.menu-bar .dropdown-menu > *').filter({ hasText: /^Glisser\.\.\.$/ });
    await expect(premierNiveau).toHaveCount(0);
    // L'entrée ouvre toujours sa fenêtre.
    await liste.getByText('Glisser...', { exact: true }).click();
    await expect(page.locator('.modal-content').first()).toBeVisible();
});
