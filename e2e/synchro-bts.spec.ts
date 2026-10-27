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
        { ...ligne, id: 2, action: 'Synchro BTS', deb: 60, fin: '' },
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
    await option.check();
    await expect(panneau).toContainText('Attente BTS : 8 s — cycle maintenu à 90 s');
    await expect(page.locator('.rest-point-band')).toContainText('Attente BTS');
    expect(await page.locator('.rest-point-band').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(0);
    await page.screenshot({ path: test.info().outputPath('attente-bts.png') });
    await option.uncheck();
    await expect(panneau).toContainText('Simulation · 82s');
    await expect(page.locator('.rest-point-band')).toHaveCount(0);
});
