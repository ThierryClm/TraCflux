import { expect, test } from '@playwright/test';
import { ouvrirExemple, projetExemple } from './aide';

// Deux verts antagonistes simultanés : le repère doit rester près de Durée,
// même lorsque l'on consulte la fin d'un cycle long.
test('les repères de conflit restent fixes pendant le défilement horizontal', async ({ page }) => {
    const projet = projetExemple();
    projet.cycleLength = 240;
    const plan = projet.pfTabs[0];
    projet.pfTabs = [plan];
    plan.cycleLength = 240;
    plan.data = [];
    projet.conflictMatrix[0][1] = 6;
    projet.conflictMatrix[1][0] = 6;
    for (const groupe of projet.groups.slice(0, 2)) {
        groupe.offset = 10;
        groupe.durations.green = 30;
        groupe.phaseFlag = '';
    }
    plan.conflictMatrix[0][1] = 6;
    plan.conflictMatrix[1][0] = 6;
    for (const ligne of plan.diagram.slice(0, 2)) {
        ligne.offset = 10;
        ligne.greenDuration = 30;
        ligne.phaseFlag = '';
    }
    await page.route('**/Carrefour_Exemple.json*', route => route.fulfill({ json: projet }));
    await ouvrirExemple(page);
    const repere = page.locator('.row-conflict-fixed').first();
    await expect(repere).toBeVisible();
    const avant = await repere.boundingBox();
    expect(await repere.evaluate(el => getComputedStyle(el, '::after').width)).toBe('6px');
    const defilement = page.locator('.timeline-container.scrollable .timeline-layout').first();
    await defilement.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await expect.poll(() => defilement.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
    await expect.poll(async () => Math.abs((await repere.boundingBox())!.x - avant!.x)).toBeLessThan(1);
    await expect(repere).toBeInViewport();
    const duree = repere.locator('input').last();
    expect((await duree.boundingBox())!.x).toBeLessThan(avant!.x + avant!.width - 6);
    await page.screenshot({ path: test.info().outputPath('conflit-apres-defilement.png') });
});
