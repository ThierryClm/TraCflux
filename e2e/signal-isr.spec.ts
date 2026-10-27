/** Formulaire : colonne Signal (ISR, livre 1, 6e partie) juste après Type. */
import { expect, test } from '@playwright/test';
import { ouvrirExemple } from './aide';

test('choisir le signal ISR d\'un groupe dans le formulaire', async ({ page }) => {
    await ouvrirExemple(page);
    const entetes = await page.locator('.group-table th').allTextContents();
    expect(entetes.indexOf('Signal')).toBe(entetes.indexOf('Type') + 1);
    const signal = page.getByLabel('Signal du groupe 1', { exact: true });
    await expect(signal).toHaveValue('');
    await signal.selectOption('R14tg');
    await expect(signal).toHaveValue('R14tg');
    await expect(signal).toHaveAttribute('title', 'Signal tricolore directionnel, tourne-à-gauche');
    await page.getByLabel('Signal du groupe 4', { exact: true }).selectOption('R12');
    await page.locator('.group-table-container').screenshot({ path: test.info().outputPath('formulaire-signal.png') });
    // Annuler revient au choix précédent.
    await page.locator('body').click({ position: { x: 900, y: 5 } });
    await page.keyboard.press('Control+z');
    await expect(page.getByLabel('Signal du groupe 4', { exact: true })).toHaveValue('');
    await expect(signal).toHaveValue('R14tg');
});

test('le type propose signal et courant, et le formulaire tient en entier dans le panneau', async ({ page }) => {
    await ouvrirExemple(page);
    const table = page.locator('.group-table').first();
    const largeurs = await table.evaluate(t => [t.getBoundingClientRect().width, t.closest('.group-table-container')!.clientWidth]);
    expect(largeurs[0]).toBeLessThanOrEqual(largeurs[1]);
    // Groupe 3 : V, courant TD_TàG saisi, signal vide → B propose R13b et garde TD_TàG.
    const ligne = table.locator('tbody tr').nth(2);
    await ligne.locator('.input-type').selectOption('B');
    await expect(ligne.locator('.input-signal')).toHaveValue('R13b');
    await expect(ligne.locator('.input-courant')).toHaveValue('TD_TàG');
    // Groupe 1 : V vide de signal → P propose R12 et impose Piéton.
    const premiere = table.locator('tbody tr').first();
    await premiere.locator('.input-type').selectOption('P');
    await expect(premiere.locator('.input-signal')).toHaveValue('R12');
    await expect(premiere.locator('.input-courant')).toHaveValue('Piéton');
    // La liste se limite aux signaux du type ; PP propose le panneau A13b.
    await expect(premiere.locator('.input-signal option')).toHaveText(['', 'R12', 'R12m', 'R12pps']);
    await premiere.locator('.input-type').selectOption('PP');
    await expect(premiere.locator('.input-signal')).toHaveValue('A13b');
    await expect(premiere.locator('.input-signal option')).toHaveText(['', 'A13b']);
    await page.locator('.group-table-container').first().screenshot({ path: test.info().outputPath('formulaire-elargi.png') });
});
