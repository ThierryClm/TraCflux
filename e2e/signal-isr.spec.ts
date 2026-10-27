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
