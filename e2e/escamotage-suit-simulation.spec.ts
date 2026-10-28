/**
 * Cas de Thierry (28/10) : en simulation, un adaptatif coché avance le vert
 * d'un groupe placé après lui ; la plage de son escamotage (hachures, ou vert
 * escamoté) doit avancer avec lui au lieu de rester au temps saisi.
 */
import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { ouvrirExemple, projetExemple } from './aide';

/** Écart entre le début de la plage d'escamotage et celui du vert, et leurs largeurs. */
const mesurer = async (piste: Locator) => {
    const vert = (await piste.locator('.phase-bar.green').first().boundingBox())!;
    const coupe = (await piste.locator('.green-cut-overlay').first().boundingBox())!;
    return { ecart: Math.abs(coupe.x - vert.x), vert: vert.width, coupe: coupe.width };
};

test('la plage d’escamotage suit le vert déplacé par un adaptatif coché', async ({ page }) => {
    const projet = projetExemple();
    const plan = projet.pfTabs[0];
    projet.pfTabs = [plan];
    const ligne = { gf: '', plage1: '', plage2: '', abrv: '', description: '', micro: '', actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '' };
    // GF9 : vert de 52 à 60 s ; l'adaptatif retire 10 à 18 s du cycle.
    plan.data = [
        { ...ligne, id: 1, action: 'Adaptatif vertical', deb: 10, fin: 18, abrv: 'AV' },
        { ...ligne, id: 2, action: 'Escamotage', gf: 9, actGf1: 9, deb: 52, fin: 60, abrv: 'ESC9' },
    ];
    await page.route('**/Carrefour_Exemple.json*', route => route.fulfill({ json: projet }));
    await ouvrirExemple(page);
    await page.locator('.pf-tab.simulation-tab').click();
    const panneau = page.locator('.simulation-panel');
    const piste = page.locator('.timeline-row-track').nth(8);

    // Adaptatif seul : hachures de l'escamotage possible, sur le vert avancé.
    await panneau.locator('.simulation-item', { hasText: 'Adaptatif vertical' }).locator('input[type=checkbox]').check();
    await expect(panneau).toContainText('Simulation · 112s');
    await expect(piste.locator('.green-cut-overlay')).toHaveCount(1);
    let m = await mesurer(piste);
    expect(m.ecart).toBeLessThan(2);
    expect(Math.abs(m.coupe - m.vert)).toBeLessThan(2);
    // Le cadre de l'action Escamotage (non cochée) part et finit avec le vert simulé…
    const vert = (await piste.locator('.phase-bar.green').first().boundingBox())!;
    const cadre = (await page.locator('.escamotage-hachure-cadre').first().boundingBox())!;
    expect(Math.abs(cadre.x - vert.x)).toBeLessThan(2);
    expect(Math.abs(cadre.x + cadre.width - (vert.x + vert.width))).toBeLessThan(2);
    // … et son infobulle donne ces secondes simulées, pas celles saisies.
    await page.locator('.escamotage-group-hover').first().hover();
    await expect(page.locator('.action-hover-tooltip-seconds').first()).toHaveText('seconde 44 à 52');
    await page.mouse.move(5, 5);

    // Adaptatif et escamotage cochés : le vert escamoté, au même endroit.
    await panneau.locator('.simulation-item', { hasText: 'GF9' }).locator('input[type=checkbox]').check();
    await expect(piste.locator('.green-cut-overlay.escamote')).toHaveCount(1);
    m = await mesurer(piste);
    expect(m.ecart).toBeLessThan(2);
    // Escamoté jusqu'à la fin du vert : son jaune disparaît avec lui.
    expect(m.coupe).toBeGreaterThan(m.vert);
    await page.screenshot({ path: test.info().outputPath('escamotage-suit.png') });
});
