import { expect, test } from '@playwright/test';
import { ouvrirExemple, ouvrirMenu, projetExemple } from './aide';

for (const cas of ['matrice vide', '10 groupes sur 13', '11 groupes sur 13'] as const) {
    test(`assistant : ${cas}`, async ({ page }) => {
        const projet = projetExemple();
        if (cas === 'matrice vide') {
            projet.conflictMatrix = projet.groups.map(() => projet.groups.map(() => ''));
            for (const pf of projet.pfTabs) pf.conflictMatrix = projet.conflictMatrix;
        } else {
            const complets = cas.startsWith('10') ? 10 : 11;
            projet.groups.slice(complets).forEach((g: { id: number; name: string }) => { g.name = `Groupe ${g.id}`; });
        }
        await page.route('**/Carrefour_Exemple.json', route => route.fulfill({ json: projet }));
        await ouvrirExemple(page);
        const assistant = page.getByRole('button', { name: 'Assistant conception...', exact: true });
        await ouvrirMenu(page, 'Diagramme', assistant);
        await expect(assistant).toHaveAttribute('title', /carrefours simples/);
        await expect(assistant).toHaveAttribute('title', /ne remplace ni l’expertise/);
        if (cas === '11 groupes sur 13') await expect(assistant).toBeEnabled();
        else {
            await expect(assistant).toBeDisabled();
            await expect(assistant).toHaveAttribute('title', cas === 'matrice vide' ? /Renseignez les temps interverts/ : /10\/13 renseignés, 11 requis/);
        }
    });
}

test('les infobulles des menus se désactivent indépendamment et restent mémorisées', async ({ page }) => {
    await ouvrirExemple(page);
    const infobulles = page.locator('.menu-item.has-submenu').filter({ hasText: /^Infobulles/ });
    await ouvrirMenu(page, 'Mise en page', infobulles);
    await infobulles.hover();
    const menu = page.getByRole('button', { name: /^(?:✓\s*)?Menu$/ });
    await expect(menu).toHaveClass(/checked/);
    await menu.click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tracflux.tooltips') || '{}'))).toMatchObject({ menu: false, main: true });
    const assistant = page.getByRole('button', { name: 'Assistant conception...', exact: true });
    await ouvrirMenu(page, 'Diagramme', assistant);
    await expect(assistant).not.toHaveAttribute('title');
    // Le mode exemple retire son paramètre et ne se restaure pas au simple F5.
    await ouvrirExemple(page);
    await ouvrirMenu(page, 'Diagramme', assistant);
    await expect(assistant).not.toHaveAttribute('title');
    await ouvrirMenu(page, 'Mise en page', infobulles);
    await infobulles.hover();
    await menu.click();
    await ouvrirMenu(page, 'Diagramme', assistant);
    await expect(assistant).toHaveAttribute('title', /carrefours simples/);
});
