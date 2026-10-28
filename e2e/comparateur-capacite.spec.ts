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
    const item = page.locator('.menu-bar').getByText('Comparer la capacité des plans de feu...', { exact: true });
    await ouvrirMenu(page, 'Diagramme', item);
    const nouvelle = context.waitForEvent('page');
    await item.click();
    const fenetre = await nouvelle;
    const comparateur = fenetre.locator('.capacity-comparison');
    await comparateur.waitFor();

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
    await fenetre.screenshot({ path: test.info().outputPath('comparateur.png') });

    // V.Utile masqué puis rétabli.
    await comparateur.locator('.cc-pf-liste-bouton').click();
    await comparateur.getByLabel('Afficher le V.Utile').click();
    await expect(comparateur.getByLabel('Afficher le V.Utile')).not.toBeChecked();
    await expect(comparateur.locator('th', { hasText: 'V.Utile' })).toHaveCount(0);

    // Le tableau au dossier imprimé, tel que réglé.
    await menuFichier(page, 'Imprimer le projet');
    const boite = page.locator('.modal-overlay').last();
    await boite.getByLabel('Comparateur de capacité').click();
    await expect(boite.getByLabel('Comparateur de capacité')).toBeChecked();
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
