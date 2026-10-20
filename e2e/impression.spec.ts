/**
 * Impression du dossier : l'aperçu est copié dans un onglet indépendant,
 * avec le pied de page, puis refermé. On capture le document envoyé à
 * l'onglet au lieu de l'ouvrir.
 */
import { expect, test } from '@playwright/test';
import { menuFichier, ouvrirExemple } from './aide';

for (const format of ['Paysage', 'Portrait'] as const) {
    test(`dossier complet en ${format.toLowerCase()}`, async ({ page, context, browserName }) => {
        test.skip(browserName !== 'chromium', 'le document produit ne dépend pas du navigateur');
        await context.addInitScript(() => {
            const w = window as unknown as { __impressions: string[] };
            w.__impressions = [];
            const creer = URL.createObjectURL.bind(URL);
            URL.createObjectURL = (objet: Blob | MediaSource) => {
                if (objet instanceof Blob && objet.type === 'text/html') objet.text().then(t => w.__impressions.push(t));
                return creer(objet);
            };
            window.open = () => null;
        });
        await ouvrirExemple(page);
        await menuFichier(page, 'Imprimer le projet');
        const boite = page.locator('.modal-overlay').last();
        await boite.locator('.dossier-orientation-choix button', { hasText: format }).click();
        const aCocher = boite.locator('input[type=checkbox]:not(:checked):not(:disabled)');
        while (await aCocher.count()) await aCocher.first().check();
        await boite.locator('button.btn-confirm', { hasText: 'Imprimer' }).click();

        await expect.poll(() => page.evaluate(() => (window as unknown as { __impressions: string[] }).__impressions.length)).toBe(1);
        const html = await page.evaluate(() => (window as unknown as { __impressions: string[] }).__impressions[0]);
        // Classes du corps du document : celles que visent les règles @media print.
        const classes = (html.match(/<body[^>]*class="([^"]*)"/) || [])[1]?.split(' ') ?? [];
        expect(classes).toContain('print-dossier');
        expect(classes.includes('print-portrait')).toBe(format === 'Portrait');
        // Les 5 plans de feu y sont, avec leurs diagrammes.
        for (const plan of ['PF1_120', 'PF_90', 'PF_80', 'ACTUEL', 'PF_Aiguillage']) expect(html).toContain(plan);
        expect((html.match(/<svg/g) || []).length).toBeGreaterThan(100);
        // L'aperçu hors écran est refermé, TraCflux reste utilisable.
        await expect(page.locator('.print-preview-overlay')).toHaveCount(0);
    });
}
