/**
 * Point de repos : la description proposée porte la durée d'attente, que la
 * simulation applique (30 s au plus, 10 s sans valeur).
 */
import { expect, test } from '@playwright/test';
import { lignesConditions, modeDescription, ongletsPlans, ouvrirExemple, projetEnCache, projetExemple, restaurer } from './aide';

test('la durée écrite dans la description fixe la durée du repos simulé', async ({ page }) => {
    await ouvrirExemple(page);
    await ongletsPlans(page).filter({ hasText: 'PF_90' }).click();

    // La colonne Description est masquée dans l'exemple : elle le reste
    // jusqu'à ce qu'un point de repos y propose un texte.
    await expect(page.locator('.action-table textarea.input-desc')).toHaveCount(0);

    // Nouvelle condition : GF 4, point de repos à 30 s.
    await page.locator('.add-condition-btn').first().click();
    await page.keyboard.type('4');
    const lignes = page.locator('.action-table tbody tr');
    await expect.poll(() => lignesConditions(page)).toContain('4');
    const ligne = lignes.nth((await lignes.count()) - 2);
    await ligne.locator('select').first().selectOption('Point de repos');
    // Masquée, la colonne passe en Automatique : la description proposée se voit.
    await expect(ligne.locator('textarea.input-desc')).toHaveValue('attente maxi 10 secondes');
    const debut = ligne.locator('input.input-time-xs').first();
    await debut.fill('30');
    await debut.press('Tab');

    // En simulation, la case de ce point de repos porte la description proposée.
    await page.locator('.pf-tab.simulation-tab').click();
    const panneau = page.locator('.simulation-panel');
    await expect(panneau).toContainText('Simulation · 90s');
    const action = panneau.locator('label, li, .simulation-action').filter({ hasText: /GF4\s*Point de repos/ }).last();
    await expect(action).toContainText('attente maxi 10');
    await action.locator('input[type=checkbox]').check();
    await expect(panneau).toContainText('Simulation · 100s');

    // La durée se modifie dans la description, depuis l'onglet du plan (la
    // simulation est en lecture seule) : 25 s, puis 45 s ramenées à 30 s.
    const description = ligne.locator('textarea.input-desc');
    for (const [valeur, cycle] of [['25', 115], ['45', 120]] as const) {
        await ongletsPlans(page).filter({ hasText: 'PF_90' }).click();
        await description.fill(`attente maxi ${valeur} secondes`);
        await page.locator('.pf-tab.simulation-tab').click();
        await expect(panneau).toContainText(`Simulation · ${cycle}s`);
    }

    // Décoché, le cycle revient à 90 s.
    await action.locator('input[type=checkbox]').uncheck();
    await expect(panneau).toContainText('Simulation · 90s');
});

test('décocher un point de repos recale la tête de lecture', async ({ page }) => {
    await ouvrirExemple(page);
    await ongletsPlans(page).filter({ hasText: 'PF_90' }).click();
    await page.locator('.add-condition-btn').first().click();
    await page.keyboard.type('4');
    await expect.poll(() => lignesConditions(page)).toContain('4');
    const lignes = page.locator('.action-table tbody tr');
    const ligne = lignes.nth((await lignes.count()) - 2);
    await ligne.locator('select').first().selectOption('Point de repos');
    const debut = ligne.locator('input.input-time-xs').first();
    await debut.fill('30');
    await debut.press('Tab');

    await page.locator('.pf-tab.simulation-tab').click();
    const panneau = page.locator('.simulation-panel');
    const caseRepos = panneau.locator('label, li, .simulation-action').filter({ hasText: /GF4\s*Point de repos/ }).last().locator('input[type=checkbox]');
    const curseur = page.locator('input.time-slider').first();
    const tete = page.locator('.playhead-time').first();

    // Cocher avec la tête après le repos (60 s) : elle avance de 10 s.
    await curseur.fill('60');
    await expect(tete).toHaveText('60s');
    await caseRepos.check();
    await expect(tete).toHaveText('70s');
    await caseRepos.uncheck();
    await expect(tete).toHaveText('60s');

    // Repos de 10 s à 30 s. Tête dans la zone (35 s) : retour au début du repos.
    await caseRepos.check();
    await expect(panneau).toContainText('Simulation · 100s');
    await curseur.fill('35');
    await expect(tete).toHaveText('35s');
    await caseRepos.uncheck();
    await expect(tete).toHaveText('30s');

    // Tête après la zone (60 s) : recul de toute la durée du repos.
    await caseRepos.check();
    await curseur.fill('60');
    await expect(tete).toHaveText('60s');
    await caseRepos.uncheck();
    await expect(tete).toHaveText('50s');

    // Tête avant la zone (20 s) : inchangée.
    await caseRepos.check();
    await curseur.fill('20');
    await caseRepos.uncheck();
    await expect(tete).toHaveText('20s');
});

test('Description des conditions en Automatique : seulement pour les plans qui ont une condition décrite', async ({ page, context }) => {
    // Exemple dont le plan PF_80 n'a aucune description.
    const projet = projetExemple();
    const pf80 = projet.pfTabs.find((pf: { name: string }) => pf.name === 'PF_80');
    pf80.data = pf80.data.map((c: Record<string, unknown>) => ({ ...c, description: '' }));
    await projetEnCache(context, 'Sans description', projet);
    await ouvrirExemple(page);
    await restaurer(page, 'Sans description');

    await modeDescription(page, 'Automatique');
    const colonne = page.locator('.action-table textarea.input-desc');
    await ongletsPlans(page).filter({ hasText: 'PF_90' }).click();
    await expect(colonne.first()).toBeVisible();
    await ongletsPlans(page).filter({ hasText: 'PF_80' }).click();
    await expect(colonne).toHaveCount(0);

    await modeDescription(page, 'Afficher');
    await expect(colonne.first()).toBeVisible();
    await modeDescription(page, 'Masquer');
    await ongletsPlans(page).filter({ hasText: 'PF_90' }).click();
    await expect(colonne).toHaveCount(0);
});

test('le déroulé continue sans s\'arrêter quand on coche et décoche des actions', async ({ page }) => {
    await ouvrirExemple(page);
    await ongletsPlans(page).filter({ hasText: 'PF_90' }).click();
    await page.locator('.pf-tab.simulation-tab').click();
    const panneau = page.locator('.simulation-panel');
    const tete = page.locator('.playhead-time').first();
    const seconde = async () => parseInt((await tete.innerText()).replace(/\D/g, ''), 10);
    // Une action placée bien après le curseur : la cocher ne le déplace pas.
    const caseLointaine = panneau.locator('label, li, .simulation-action').filter({ hasText: /GF2\s*Point de repos\s*79s/ }).last().locator('input[type=checkbox]');

    await page.getByRole('button', { name: 'Lancer la simulation' }).click();
    await expect.poll(seconde).toBeGreaterThanOrEqual(1);
    const depart = await seconde();
    const debut = Date.now();
    for (let i = 0; i < 6; i++) {
        await caseLointaine.setChecked(i % 2 === 0);
        await page.waitForTimeout(400);
    }
    const ecoule = (Date.now() - debut) / 1000;
    const avance = (await seconde()) - depart;
    await page.getByRole('button', { name: 'Mettre la simulation en pause' }).click();
    // Une seconde de cycle par seconde réelle : au plus une seconde perdue en tout.
    expect(avance).toBeGreaterThanOrEqual(Math.floor(ecoule) - 1);
});
