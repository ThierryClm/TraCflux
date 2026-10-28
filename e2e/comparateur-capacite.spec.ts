/**
 * Comparateur de capacité : liste déroulante des plans de feu et de leurs
 * scénarios, plans sans trafic grisés, V.Utile facultatif, et tableau au
 * dossier imprimé.
 */
import { expect, test } from '@playwright/test';
import { menuFichier, ouvrirExemple, ouvrirMenu, projetExemple } from './aide';


test('plans et scénarios à comparer, V.Utile facultatif, tableau au dossier', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'fenêtre détachée et document imprimé indépendants du navigateur');
    await page.setViewportSize({ width: 1600, height: 1000 });
    const projet = projetExemple();
    projet.capacityCompareScenarios = [];
    // Deux plans au départ : la fenêtre a de quoi s'élargir quand on ajoute une colonne.
    projet.capacityCompareSelection = projet.pfTabs.slice(0, 2).map((pf: { id: number }) => pf.id);
    await page.route('**/Carrefour_Exemple.json*', route => route.fulfill({ json: projet }));
    await context.addInitScript(() => {
        const w = window as unknown as { __impressions: string[] };
        w.__impressions = [];
        const creer = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (objet: Blob | MediaSource) => {
            if (objet instanceof Blob && objet.type === 'text/html') objet.text().then(t => w.__impressions.push(t));
            return creer(objet);
        };
    });
    await ouvrirExemple(page);
    const item = page.locator('.menu-bar').getByText('Capacité des plans de feu...', { exact: true });
    await ouvrirMenu(page, 'Diagramme', item);
    const nouvelle = context.waitForEvent('page');
    await item.click();
    const fenetre = await nouvelle;
    const comparateur = fenetre.locator('.capacity-comparison');
    await comparateur.waitFor();
    // Le navigateur de test sans écran ignore resizeTo : on relève les tailles
    // que l'application DEMANDE à la fenêtre.
    await fenetre.evaluate(() => {
        const w = window as unknown as { __tailles: number[][] };
        w.__tailles = [];
        window.resizeTo = (l: number, h: number) => { w.__tailles.push([l, h]); };
        // Et lui fait croire à un écran de bureau, sans quoi tout est plafonné à 920 × 620.
        Object.defineProperty(window.screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(window.screen, 'availHeight', { get: () => 1040 });
    });
    const derniereTaille = () => fenetre.evaluate(() => {
        const t = (window as unknown as { __tailles: number[][] }).__tailles;
        return t.length ? t[t.length - 1] : [0, 0];
    });

    await comparateur.locator('.cc-pf-liste-bouton').click();
    const liste = comparateur.locator('.cc-pf-liste');
    await expect(liste).toBeVisible();
    // Un scénario enregistré de l'exemple, en retrait sous son plan.
    const scenario = liste.locator('.cc-scenario-checkbox').first();
    await expect(scenario).toBeVisible();
    // La case suit l'état tenu par la fenêtre principale : elle se coche au retour.
    await scenario.locator('input').click();
    await expect(scenario.locator('input')).toBeChecked();
    await expect(comparateur.locator('.cc-scenario-header')).toHaveCount(1);
    await expect(comparateur.locator('.cc-pf-liste-bouton')).toHaveText('2 plans de feu comparés + 1 scénario ▾');
    // Tous les plans cochés : la fenêtre demandée s'élargit, et sa hauteur couvre
    // tout le tableau (en-têtes de scénario compris), marge en plus.
    const nonCochees = liste.locator('.cc-pf-groupe > .cc-pf-checkbox input:not(:checked):not(:disabled)');
    await fenetre.evaluate(() => { (window as unknown as { __tailles: number[][] }).__tailles = []; });
    for (let i = 0; i < 10 && await nonCochees.count(); i++) {
        const avant = await nonCochees.count();
        await nonCochees.first().click();
        await expect(nonCochees).toHaveCount(avant - 1);
    }
    await comparateur.locator('.cc-pf-liste-bouton').click();
    const tableauFenetre = comparateur.locator('.cc-table');
    const largeurTableau = await tableauFenetre.evaluate(t => t.getBoundingClientRect().width);
    const hauteurTableau = await tableauFenetre.evaluate(t => t.getBoundingClientRect().height);
    await expect.poll(async () => (await derniereTaille())[0]).toBeGreaterThan(largeurTableau);
    await expect.poll(async () => (await derniereTaille())[1]).toBeGreaterThan(hauteurTableau + 100);
    await comparateur.locator('.cc-pf-liste-bouton').click();
    await fenetre.screenshot({ path: test.info().outputPath('comparateur.png') });

    // V.Utile masqué puis rétabli.
    await comparateur.locator('.cc-pf-liste-bouton').click();
    await comparateur.getByLabel('Afficher le V.Utile').click();
    await expect(comparateur.getByLabel('Afficher le V.Utile')).not.toBeChecked();
    await expect(comparateur.locator('th', { hasText: 'V.Utile' })).toHaveCount(0);

    // Le tableau au dossier imprimé, tel que réglé.
    await menuFichier(page, 'Imprimer le projet');
    const boite = page.locator('.modal-overlay').last();
    await boite.getByLabel('Capacité des plans de feu et scénarios').click();
    await expect(boite.getByLabel('Capacité des plans de feu et scénarios')).toBeChecked();
    await page.evaluate(() => { window.open = () => null; });
    await boite.locator('button.btn-confirm', { hasText: 'Imprimer' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __impressions: string[] }).__impressions.length)).toBe(1);
    const html = await page.evaluate(() => (window as unknown as { __impressions: string[] }).__impressions[0]);
    expect(html).toContain('Capacité des plans de feu et des scénarios');
    expect(html).toContain('cc-scenario-header');
    expect(html).not.toContain('>V.Utile<');
    const feuille = await context.newPage();
    await feuille.setViewportSize({ width: 1047, height: 800 });
    await feuille.goto('/');
    await feuille.setContent(html, { waitUntil: 'load' });
    await feuille.emulateMedia({ media: 'print' });
    const tableau = feuille.locator('.print-dossier-comparateur');
    await tableau.scrollIntoViewIfNeeded();
    expect((await tableau.locator('.cc-table').boundingBox())!.width).toBeLessThanOrEqual(1047);
    await tableau.screenshot({ path: test.info().outputPath('comparateur-dossier.png') });
});
