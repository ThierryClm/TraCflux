/**
 * Ouvrir et Sauvegarder un fichier projet.
 * Régression de référence : sous Firefox et Safari, sans fenêtres natives,
 * « Ouvrir » renvoyait à la liste du cache et « Sauvegarder » ne produisait
 * aucun fichier (corrigé en 1.5.0, PR #80).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { menuFichier, ongletsPlans, projetExemple } from './aide';

/** Chrome et Edge ont les fenêtres natives ; Brave, du même moteur, les masque. */
const fenetresNatives = (browserName: string, projet: string) => browserName === 'chromium' && projet !== 'brave';

test('Firefox, Safari et Brave : Ouvrir lit un fichier du poste, Sauvegarder le télécharge', async ({ page, browserName }, testInfo) => {
    test.skip(fenetresNatives(browserName, testInfo.project.name), 'Chrome ouvre ses fenêtres natives, que Playwright ne pilote pas');
    const fichier = testInfo.outputPath('Mon_carrefour.json');
    writeFileSync(fichier, JSON.stringify(projetExemple()));

    await page.goto('/');
    const selecteur = page.waitForEvent('filechooser');
    await menuFichier(page, 'Ouvrir un projet');
    await (await selecteur).setFiles(fichier);
    await expect(ongletsPlans(page)).toHaveCount(5);
    // Le titre reprend le nom du carrefour enregistré dans le fichier.
    await expect(page).toHaveTitle(/Carrefour_exemple/);

    await page.locator('.tab-btn', { hasText: /^Propriétés$/ }).click();
    const titre = page.getByRole('textbox', { name: 'Nom du carrefour', exact: true });
    await titre.fill('Place des Écoles — projet coordonné');
    const nomProprietes = page.locator('.properties-form input').first();
    await expect(nomProprietes).toHaveValue('Place des Écoles — projet coordonné');
    const coordonne = page.getByRole('checkbox', { name: 'Carrefour coordonné' });
    await expect(coordonne).not.toBeChecked();
    await coordonne.check();
    await nomProprietes.fill('Place des Écoles — variante');
    await expect(titre).toHaveValue('Place des Écoles — variante');
    await expect(page).toHaveTitle(/Place des Écoles — variante/);

    const telechargement = page.waitForEvent('download');
    await page.mouse.click(800, 880);
    await page.keyboard.press('Control+s');
    const enregistre = await telechargement;
    expect(enregistre.suggestedFilename()).toBe('Mon_carrefour.json');
    const contenu = JSON.parse(readFileSync(await enregistre.path(), 'utf8'));
    expect(contenu.intersectionName).toBe('Place des Écoles — variante');
    expect(contenu.projectName).toBe('Mon_carrefour');
    expect(contenu.projectProperties.carrefourCoordonne).toBe(true);
    expect(contenu.groups).toHaveLength(13);
    expect(contenu.pfTabs).toHaveLength(5);
});

test('Chrome et Edge gardent leurs fenêtres natives Ouvrir / Enregistrer', async ({ page, browserName }, testInfo) => {
    test.skip(!fenetresNatives(browserName, testInfo.project.name), 'propre à Chrome et Edge');
    await page.goto('/');
    const natives = await page.evaluate(() => (['showOpenFilePicker', 'showSaveFilePicker'] as const)
        .map(nom => String((window as unknown as Record<string, unknown>)[nom]).includes('[native code]')));
    expect(natives).toEqual([true, true]);
});
