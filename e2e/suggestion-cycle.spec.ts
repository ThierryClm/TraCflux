/**
 * Suggestion de durée du cycle (menu Diagramme) : à partir des groupes
 * déterminants de chaque phase et du trafic du plan, cycle de Webster
 * appliqué au plan, phasage enregistré avec lui.
 */
import { expect, test, type Locator } from '@playwright/test';
import { ouvrirExemple, ouvrirMenu } from './aide';

/** Chapitres de l'assistant, repliés à l'ouverture : on les déplie tous. */
const toutDeplier = async (fenetre: Locator) => {
    for (let i = 0; i < 4; i++) {
        const replies = fenetre.locator('.sc-chapitre-tete[aria-expanded="false"]');
        const n = await replies.count();
        if (!n) return;
        for (let k = n - 1; k >= 0; k--) await replies.nth(k).click();
    }
};

test('le cycle de Webster calculé sur les groupes déterminants s\'applique au plan', async ({ page, context }) => {
    await ouvrirExemple(page);
    const item = page.locator('.menu-bar').getByText('Suggérer une durée de cycle...', { exact: true });
    await ouvrirMenu(page, 'Diagramme', item);
    // Fenêtre détachée du navigateur, déplaçable sur un autre écran : la page
    // principale garde tout l'espace du diagramme.
    const nouvelle = context.waitForEvent('page');
    await item.click();
    const popup = await nouvelle;
    const fenetre = popup.locator('.suggestion-cycle.sc-detachee');
    await expect(fenetre).toBeVisible();
    await expect(page.locator('.modal-content.suggestion-cycle')).toHaveCount(0);
    // Chapitres repliés à l'ouverture, avec leur résumé.
    await expect(fenetre.locator('.sc-chapitre-tete').first()).toHaveAttribute('aria-expanded', 'false');
    await expect(fenetre.locator('.sc-chapitre-tete').first()).toContainText(/\d phases :/);
    await toutDeplier(fenetre);

    // Diagramme renseigné : le tableau arrive pré-rempli (chemin critique).
    await expect(fenetre.getByText(/Proposition lue sur le diagramme/)).toBeVisible();
    // On le remplace par deux phases : rue Balise nord (GF1), puis rue Pestre (GF8).
    await fenetre.getByLabel('Nombre de phases').selectOption('2');
    await fenetre.getByLabel('Groupe déterminant de la phase 1').selectOption('1');
    await fenetre.getByLabel('Groupe déterminant de la phase 2').selectOption('8');
    for (const [champ, valeur] of [['Dégagement de la phase 1 vers la phase 2', '6'], ['Dégagement de la phase 2 vers la phase 1', '6']] as const) {
        const c = fenetre.getByLabel(champ);
        if (!(await c.inputValue())) await c.fill(valeur);
    }
    await toutDeplier(fenetre);
    const webster = fenetre.getByText(/Cycle optimal de Webster/);
    await expect(webster).toContainText(/cycle proposé de \d+ s/);
    const cycle = Number(((await webster.textContent()) || '').match(/cycle proposé de (\d+) s/)?.[1]);
    expect(cycle % 10).toBe(0);
    expect(cycle).toBeGreaterThan(20);

    await fenetre.getByRole('button', { name: `Appliquer le cycle (${cycle} s)` }).click();
    await expect(page.locator('.cycle-input-label input').first()).toHaveValue(String(cycle));
    const fermee = popup.waitForEvent('close');
    await fenetre.getByRole('button', { name: 'Fermer' }).click();
    await fermee;

    // Le phasage est gardé avec le plan : on le retrouve à la réouverture.
    await ouvrirMenu(page, 'Diagramme', item);
    const rouverte = context.waitForEvent('page');
    await item.click();
    const popup2 = await rouverte;
    await toutDeplier(popup2.locator('.suggestion-cycle'));
    await expect(popup2.locator('.suggestion-cycle').getByLabel('Groupe déterminant de la phase 2')).toHaveValue('8');
});

test('Nouveau plan de feu : plan vierge, choix du jeu de trafic, puis suggestion du cycle', async ({ page, context }) => {
    await ouvrirExemple(page);
    const nbAvant = await page.locator('.pf-tab:not(.simulation-tab):not(.phasage-tab)').count();
    const item = page.locator('.menu-bar').getByText('Nouveau plan de feu...', { exact: true });
    await ouvrirMenu(page, 'Diagramme', item);
    await item.click();
    const onglets = page.locator('.pf-tab:not(.simulation-tab):not(.phasage-tab)');
    await expect(onglets).toHaveCount(nbAvant + 1);
    await expect(page.locator('.pf-tab.active').first()).toContainText('Nouveau PF');
    await page.screenshot({ path: test.info().outputPath('nouveau-pf.png') });
    // Conditions de micro-régulation vides.
    const conditions = await page.evaluate(() => [...document.querySelectorAll<HTMLSelectElement>('.action-table tbody select')].filter(s => s.value).length);
    expect(conditions).toBe(0);

    const fenetre = page.locator('.modal-content.nouveau-plan');
    await expect(fenetre).toBeVisible();
    const jeu = fenetre.getByLabel('Jeu de trafic du nouveau plan');
    await jeu.selectOption('HPS');
    const nouvelle = context.waitForEvent('page');
    await fenetre.getByRole('button', { name: 'Associer et suggérer le cycle…' }).click();
    const popup = await nouvelle;
    await toutDeplier(popup.locator('.suggestion-cycle'));
    await expect(popup.locator('.suggestion-cycle')).toContainText('jeu HPS');
});
