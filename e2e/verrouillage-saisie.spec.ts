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
    await expect(page.locator('.group-table select').first()).toBeDisabled();
    await expect(cycle).toHaveAttribute('readonly');
    // La valeur ne change pas à la frappe.
    const avant = await cycle.inputValue();
    await cycle.click();
    await page.keyboard.type('9');
    await expect(cycle).toHaveValue(avant);
    // Préférence du poste, mémorisée dans le navigateur ; on décoche ensuite.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tracflux.verrouSaisie') || '{}'))).toMatchObject({ configuration: true, diagramme: true, trafic: false });
    await cocher(page, 'Configuration');
    await cocher(page, 'Diagramme');
    await expect(page.locator('.group-table input').first()).not.toHaveAttribute('readonly');
    await expect(page.locator('.cycle-input-label input').first()).not.toHaveAttribute('readonly');
});
