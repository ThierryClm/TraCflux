/**
 * Suggestion de durée du cycle (menu Diagramme) : à partir des groupes
 * déterminants de chaque phase et du trafic du plan, cycle de Webster
 * appliqué au plan, phasage enregistré avec lui.
 */
import { expect, test } from '@playwright/test';
import { ouvrirExemple, ouvrirMenu } from './aide';

test('le cycle de Webster calculé sur les groupes déterminants s\'applique au plan', async ({ page }) => {
    await ouvrirExemple(page);
    const item = page.locator('.menu-bar').getByText('Suggestion de durée du cycle...', { exact: true });
    await ouvrirMenu(page, 'Diagramme', item);
    await item.click();
    const fenetre = page.locator('.modal-content.suggestion-cycle');
    await expect(fenetre).toBeVisible();
    // Fenêtre non modale : le diagramme reste visible et cliquable derrière.
    const sousLaSouris = await page.evaluate(() => {
        const r = document.querySelector('.timeline-row-track')!.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + 20, r.top + r.height / 2);
        return { overlay: !!el?.closest('.modal-overlay'), diagramme: !!el?.closest('.timeline-row-track, .timeline-row') };
    });
    expect(sousLaSouris).toEqual({ overlay: false, diagramme: true });

    // Deux phases : rue Balise nord (GF1), puis rue Pestre (GF8).
    await fenetre.getByLabel('Groupe déterminant de la phase 1').selectOption('1');
    await fenetre.getByLabel('Groupe déterminant de la phase 2').selectOption('8');
    for (const [champ, valeur] of [['Dégagement de la phase 1 vers la phase 2', '6'], ['Dégagement de la phase 2 vers la phase 1', '6']] as const) {
        const c = fenetre.getByLabel(champ);
        if (!(await c.inputValue())) await c.fill(valeur);
    }
    const webster = fenetre.getByText(/Cycle optimal de Webster/);
    await expect(webster).toContainText(/cycle proposé de \d+ s/);
    const cycle = Number(((await webster.textContent()) || '').match(/cycle proposé de (\d+) s/)?.[1]);
    expect(cycle % 10).toBe(0);
    expect(cycle).toBeGreaterThan(20);

    await fenetre.getByRole('button', { name: `Appliquer le cycle (${cycle} s)` }).click();
    await fenetre.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.locator('.cycle-input-label input').first()).toHaveValue(String(cycle));

    // Le phasage est gardé avec le plan : on le retrouve à la réouverture.
    await ouvrirMenu(page, 'Diagramme', item);
    await item.click();
    await expect(fenetre.getByLabel('Groupe déterminant de la phase 2')).toHaveValue('8');
});
