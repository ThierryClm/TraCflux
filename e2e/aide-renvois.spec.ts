/**
 * Renvois de l'aide : un lien du texte mène à sa section, ou déplie dans la
 * fenêtre principale le menu dont il parle, sans fermer l'aide.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ouvrirMenu } from './aide';

const ouvrirAide = async (page: Page): Promise<Page> => {
    await page.goto('/');
    const item = page.locator('.menu-bar').getByText('Aide', { exact: true });
    await ouvrirMenu(page, 'A propos', item);
    const nouvelle = page.context().waitForEvent('page');
    await item.click();
    const aide = await nouvelle;
    await expect(aide.getByRole('searchbox', { name: "Rechercher dans l'aide" })).toBeVisible({ timeout: 15_000 });
    return aide;
};

test('un renvoi de section y conduit', async ({ page }) => {
    const aide = await ouvrirAide(page);
    await aide.locator('[data-aide-section="Impression du dossier"]').first().click();
    await expect(aide.getByRole('heading', { name: 'Impression du dossier' })).toBeInViewport();
});

test('un renvoi de menu déplie ce menu dans la fenêtre principale', async ({ page }) => {
    const aide = await ouvrirAide(page);
    await aide.locator('[data-aide-menu="Mise en page → Options de contraste"]').first().click();
    await expect(page.locator('.menu-bar .menu-repere')).toContainText('Options de contraste');
    await expect(page.locator('.menu-bar .submenu-dropdown')).toContainText('Sépia');
    await expect(aide.getByRole('searchbox', { name: "Rechercher dans l'aide" })).toBeVisible();
});
