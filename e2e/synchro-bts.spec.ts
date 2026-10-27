import { expect, test } from '@playwright/test';
import { ouvrirExemple, projetExemple } from './aide';

test('la compensation BTS maintient le cycle et dessine son attente uniquement si activée', async ({ page }) => {
    const projet = projetExemple();
    const plan = projet.pfTabs[0];
    projet.pfTabs = [plan];
    projet.cycleLength = plan.cycleLength = 90;
    const ligne = { gf: '', plage1: '', plage2: '', abrv: '', description: '', micro: '', actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '' };
    plan.data = [
        { ...ligne, id: 1, action: 'Adaptatif vertical', deb: 10, fin: 18 },
        { ...ligne, id: 2, action: 'Synchro BTS', deb: 60, fin: '', abrv: 'BTS compensée' },
        { ...ligne, id: 3, action: 'Synchro BTS', deb: 5, fin: '', abrv: 'BTS sans attente' },
    ];
    await page.route('**/Carrefour_Exemple.json*', route => route.fulfill({ json: projet }));
    await ouvrirExemple(page);
    await page.locator('.pf-tab.simulation-tab').click();
    const panneau = page.locator('.simulation-panel');
    const option = panneau.getByRole('checkbox', { name: 'Compenser les contractions à la synchro BTS' });
    await expect(option).not.toBeChecked();
    // Tout cocher porte sur les actions : cela n'active pas l'option BTS.
    await panneau.locator('.simulation-scenario-select').click();
    await panneau.getByRole('option').filter({ hasText: 'Tout coché' }).click();
    await expect(panneau).toContainText('Simulation · 82s');
    await expect(page.locator('.rest-point-band')).toHaveCount(0);
    const cases = panneau.locator('.simulation-item input[type=checkbox]').first();
    const positionAvant = (await cases.boundingBox())!.y;
    await expect(page.locator('.synchro-bts-arrows')).toHaveCount(2);
    await expect(page.locator('.synchro-bts-label')).toHaveCount(2);
    await option.check();
    await expect(panneau).toContainText('Simulation · 90s');
    await expect(panneau).not.toContainText('Attente BTS');
    await expect.poll(async () => Math.abs((await cases.boundingBox())!.y - positionAvant)).toBeLessThan(1);
    await expect(page.locator('.synchro-bts-arrows')).toHaveCount(1);
    await expect(page.locator('.synchro-bts-label')).toHaveText('BTS sans attente');
    await expect(page.locator('.rest-point-band')).toContainText('Attente BTS');
    expect(await page.locator('.rest-point-band').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(0);
    await page.screenshot({ path: test.info().outputPath('attente-bts.png') });
    await option.uncheck();
    await expect(panneau).toContainText('Simulation · 82s');
    await expect(page.locator('.rest-point-band')).toHaveCount(0);
    await expect(page.locator('.synchro-bts-arrows')).toHaveCount(2);
    await expect(page.locator('.synchro-bts-label')).toHaveCount(2);
    await expect.poll(async () => Math.abs((await cases.boundingBox())!.y - positionAvant)).toBeLessThan(1);
});

for (const synchroVide of [false, true]) {
    test(`la case BTS est absente ${synchroVide ? 'si la synchro est sans instant' : 'sans synchro dans le plan'}`, async ({ page }) => {
        const projet = projetExemple();
        projet.pfTabs = [projet.pfTabs[0]];
        projet.pfTabs[0].data = synchroVide
            ? [{ id: 1, action: 'Synchro BTS', deb: '', fin: '', gf: '', plage1: '', plage2: '' }]
            : [];
        await page.route('**/Carrefour_Exemple.json*', route => route.fulfill({ json: projet }));
        await ouvrirExemple(page);
        await page.locator('.pf-tab.simulation-tab').click();
        await expect(page.locator('.simulation-panel')).toBeVisible();
        await expect(page.getByRole('checkbox', { name: 'Compenser les contractions à la synchro BTS' })).toHaveCount(0);
    });
}
