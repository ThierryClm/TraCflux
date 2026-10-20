/**
 * Export PNG du diagramme : l'image est générée et téléchargée (une copie
 * part aussi dans le presse-papiers quand le navigateur l'autorise).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ouvrirExemple } from './aide';

test('Exporter en PNG > Diagramme télécharge une image du diagramme', async ({ page }) => {
    await ouvrirExemple(page);
    const racine = page.locator('.menu-item-with-submenu', { hasText: 'Exporter en PNG' });
    for (let i = 0; i < 4 && !(await racine.isVisible()); i++) {
        await page.locator('.menu-bar').getByText('Fichier', { exact: true }).click();
        await page.waitForTimeout(250);
    }
    // Le sous-menu s'ouvre au survol de son entrée.
    await racine.hover();
    const entree = racine.locator('.submenu-dropdown').getByText('Diagramme', { exact: true });
    await expect(entree).toBeVisible();
    const telechargement = page.waitForEvent('download');
    await entree.click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toMatch(/\.png$/);
    const png = readFileSync(await fichier.path());
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    // Largeur et hauteur lues dans l'en-tête : une vraie image, pas un cadre vide.
    expect(png.readUInt32BE(16)).toBeGreaterThan(400);
    expect(png.readUInt32BE(20)).toBeGreaterThan(200);
});
