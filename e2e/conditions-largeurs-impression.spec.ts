/**
 * Tableau des conditions imprimé : chaque colonne garde la largeur réglée dans
 * le projet (Description, Abrv, Action_Micro), dans les proportions de
 * l'écran ; seule l'échelle d'ensemble s'adapte à la feuille. Cas de Thierry
 * (28/10) : Action_Micro élargie à l'écran sortait plus étroite que la
 * Description à l'impression.
 */
import { expect, test } from '@playwright/test';
import { menuFichier, ouvrirExemple, projetExemple } from './aide';

test('les colonnes imprimées gardent les proportions réglées dans le projet', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'le document produit ne dépend pas du navigateur');
    await page.setViewportSize({ width: 1600, height: 1000 });
    const projet = projetExemple();
    projet.actionColWidths = { description: 190, micro: 600, abrv: 50 };
    await page.route('**/Carrefour_Exemple.json*', route => route.fulfill({ json: projet }));
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
    const ecran = await page.evaluate(() => [...document.querySelectorAll('.action-table thead tr:first-child th')]
        .map(th => [th.textContent?.replace(/[↕]/g, '').trim(), th.getBoundingClientRect().width] as const));
    const largeurEcran = (nom: string) => ecran.find(([n]) => n === nom)![1];

    await menuFichier(page, 'Imprimer le projet');
    const boite = page.locator('.modal-overlay').last();
    await boite.locator('.dossier-orientation-choix button', { hasText: 'Paysage' }).click();
    await boite.locator('button.btn-confirm', { hasText: 'Imprimer' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __impressions: string[] }).__impressions.length)).toBe(1);
    const html = await page.evaluate(() => (window as unknown as { __impressions: string[] }).__impressions[0]);

    const feuille = await context.newPage();
    await feuille.setViewportSize({ width: 1047, height: 800 });
    await feuille.goto('/');
    await feuille.setContent(html, { waitUntil: 'load' });
    await feuille.emulateMedia({ media: 'print' });
    const imprime = await feuille.evaluate(() => [...document.querySelectorAll('.print-dossier-actions .print-actions-table')[0].querySelectorAll('thead tr:first-child th')]
        .map(th => [th.textContent?.trim(), th.getBoundingClientRect().width] as const));
    const largeurImprimee = (nom: string) => imprime.find(([n]) => n === nom)![1];

    // Même rapport entre Action_Micro et Action qu'à l'écran, à 3 % près.
    const rapportEcran = largeurEcran('Action_Micro') / largeurEcran('Action');
    const rapportImprime = largeurImprimee('Action_Micro') / largeurImprimee('Action');
    expect(Math.abs(rapportImprime / rapportEcran - 1)).toBeLessThan(0.03);
    // Action_Micro reste la colonne la plus large, nettement devant la Description.
    expect(largeurImprimee('Action_Micro')).toBeGreaterThan(2.5 * largeurImprimee('Description'));
    // Le tableau tient dans la feuille.
    expect(await feuille.evaluate(() => document.querySelector('.print-dossier-actions .print-actions-table')!.getBoundingClientRect().right)).toBeLessThanOrEqual(1047);
});
