/**
 * Mise en page → Verrouillage saisie : une section cochée garde ses valeurs
 * lisibles mais non modifiables (pas de clavier sur smartphone).
 */
import { expect, test, type Page } from '@playwright/test';
import { ouvrirExemple } from './aide';

const cocher = async (page: Page, section: string) => {
    const sousMenu = page.locator('.menu-item-with-submenu', { hasText: 'Verrouillage saisie' });
    const miseEnPage = page.locator('.menu-bar').getByText('Mise en page', { exact: true });
    for (let i = 0; i < 6 && !(await sousMenu.isVisible()); i++) {
        await page.mouse.move(5, 400);
        await miseEnPage.hover();
        if (await sousMenu.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) break;
        await miseEnPage.click();
        await sousMenu.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
    }
    await sousMenu.hover();
    await sousMenu.locator('.submenu-dropdown').getByText(new RegExp(`^✓?${section}$`)).click();
    await page.keyboard.press('Escape');
    await page.mouse.click(900, 1050);
};

test('verrouiller la configuration et le diagramme : champs en lecture seule, le reste modifiable', async ({ page }) => {
    await ouvrirExemple(page);
    const nom = page.locator('.group-table input').first();
    const cycle = page.locator('.cycle-input-label input').first();
    await expect(nom).not.toHaveAttribute('readonly');
    await cocher(page, 'Configuration');
    await cocher(page, 'Diagramme');
    await expect(nom).toHaveAttribute('readonly');
    await expect(page.locator('.group-table-title .mention-verrou')).toHaveText('(verrouillé)');
    await expect(page.locator('.diagram-title .mention-verrou')).toHaveText('(verrouillé)');
    await expect(page.locator('.group-table select').first()).toBeDisabled();
    await expect(cycle).toHaveAttribute('readonly');
    // La valeur ne change pas à la frappe.
    const avant = await cycle.inputValue();
    await cycle.click();
    await page.keyboard.type('9');
    await expect(cycle).toHaveValue(avant);
    // Conditions de micro-régulation et variables micro.
    await cocher(page, 'Conditions de micro-régulation');
    await cocher(page, 'Variables micro');
    await expect(page.locator('.action-table select').first()).toBeDisabled();
    await expect(page.locator('.action-table textarea').first()).toHaveAttribute('readonly');
    await expect(page.locator('.custom-field-input').first()).toHaveAttribute('readonly');
    // La matrice, non cochée, reste modifiable.
    await expect(page.locator('.matrix-grid input').first()).not.toHaveAttribute('readonly');
    await cocher(page, 'Conditions de micro-régulation');
    await cocher(page, 'Variables micro');
    await expect(page.locator('.action-table select').first()).toBeEnabled();
    await cocher(page, 'Configuration');
    await cocher(page, 'Diagramme');
    await expect(page.locator('.group-table input').first()).not.toHaveAttribute('readonly');
    await expect(page.locator('.cycle-input-label input').first()).not.toHaveAttribute('readonly');
});


test('Trafic : la mention remplace le filtre et suit le verrou dans une fenêtre déjà détachée', async ({ page, context }) => {
    await ouvrirExemple(page);
    await page.locator('.tab-btn', { hasText: /^Trafic$/ }).click();
    const trafic = page.locator('.traffic-table-container');
    const ouverte = context.waitForEvent('page');
    await trafic.locator('.detach-btn').click();
    const fenetre = await ouverte;
    await expect(fenetre.locator('.traffic-table-container')).toBeVisible();
    await fenetre.getByRole('checkbox', { name: 'Tous les Grp' }).check();
    const largeur = await fenetre.evaluate(() => innerWidth);
    await cocher(page, 'Trafic');
    await expect(fenetre).toHaveTitle(/Données trafic \(verrouillé\)/);
    await expect(fenetre.locator('.traffic-header .mention-verrou')).toHaveText('(verrouillé)');
    await expect(fenetre.getByRole('checkbox', { name: 'Tous les Grp' })).toHaveCount(0);
    expect(await fenetre.evaluate(() => innerWidth)).toBe(largeur);
    await cocher(page, 'Trafic');
    await expect(fenetre).not.toHaveTitle(/verrouillé/);
    await expect(fenetre.getByRole('checkbox', { name: 'Tous les Grp' })).toBeChecked();
});
