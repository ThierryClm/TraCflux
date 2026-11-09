import { expect, test } from '@playwright/test';
import { ouvrirExemple, projetEnCache, projetExemple, restaurer } from './aide';

test('Action GF part de la fin de l’accolade lorsque celle-ci précède la fin du vert', async ({ page, context }) => {
    const projet = projetExemple();
    projet.activePFId = 5; // PF_80 : FA1 de GF1 vers GF2.
    const pf = projet.pfTabs.find((p: { id: number }) => p.id === 5);
    pf.data.find((a: { id: number }) => a.id === 1).fin = 50;
    await projetEnCache(context, 'Ancrage_GF', projet);
    await page.goto('/');
    await restaurer(page, 'Ancrage_GF');
    const accolade = page.locator('.timeline-row-track').first().locator('.brace-marker');
    await expect(accolade).toBeVisible();
    const fin = await accolade.evaluate(e => parseFloat((e as HTMLElement).style.left) + parseFloat((e as HTMLElement).style.width));
    const origine = Number(await page.locator('.fermeture-arrow line').first().getAttribute('x1'));
    expect(origine).toBeCloseTo(fin, 4);
    const pps = await page.locator('.ruler-tick').nth(1).evaluate(e => parseFloat((e as HTMLElement).style.left) / 5);
    expect(origine / pps).toBeCloseTo(50, 4);
});

test('Image du carrefour : verrouiller les options garde le survol et le détachement', async ({ page, context }) => {
    await ouvrirExemple(page);
    const ouverte = context.waitForEvent('page');
    await page.locator('.group-table-container .detach-btn').click();
    const formulaire = await ouverte;
    await expect(formulaire.locator('.group-table')).toBeVisible();
    await page.locator('.pf-tab.simulation-tab').click();
    const image = page.locator('.intersection-image-container');
    await expect(image.getByRole('checkbox', { name: 'Signaux', exact: true })).toBeEnabled();
    await page.locator('.menu-bar').getByRole('button', { name: 'Mise en page', exact: true }).click();
    const verrou = page.locator('.menu-item-with-submenu', { hasText: 'Verrouillage saisie' });
    await verrou.hover();
    await verrou.locator('.submenu-dropdown').getByText(/^✓?Image du carrefour$/).click();
    await page.keyboard.press('Escape');
    await expect(image.getByRole('checkbox', { name: 'Signaux', exact: true })).toBeDisabled();
    await expect(image.locator('input[type=range]').first()).toBeDisabled();
    await expect(image.getByRole('button', { name: 'Changer image' })).toBeDisabled();
    await expect(image.getByRole('button', { name: 'Détacher image', exact: true })).toBeEnabled();
    // Une traversée en bas de l’image est éloignée de l’en-tête collant.
    const fleche = image.locator('.arrow-marker').nth(5).locator('svg .fleche-prise').first();
    await fleche.hover();
    await expect(page.locator('.timeline-row-track.image-hovered-row')).toHaveCount(1);
    await expect(formulaire.locator('.form-hovered-row')).toHaveCount(1);
    await expect(formulaire.locator('.form-hovered-row td').first()).toHaveCSS('box-shadow', /rgb\(79, 195, 255\)/);
    await expect(page.locator('.arrow-highlighted .phase-bar').first()).toHaveCSS('outline-width', '2px');
});
