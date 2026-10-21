/**
 * Ajout d'une condition de micro-régulation.
 * Régression de référence : une condition supprimée laisse une ligne vide au
 * milieu ; la saisie s'y faisait et la nouvelle condition remontait entre
 * deux autres (corrigé en 1.5.2, PR #84). Le plan PF_Aiguillage de
 * l'exemple contient un tel trou.
 */
import { expect, test } from '@playwright/test';
import { lignesConditions, ongletsPlans, ouvrirExemple } from './aide';

test('la nouvelle condition reste en bas, sous la dernière', async ({ page }) => {
    await ouvrirExemple(page);
    await ongletsPlans(page).filter({ hasText: 'PF_Aiguillage' }).click();
    const avant = await lignesConditions(page);
    expect(avant.at(-1)).toBe('·');

    await page.locator('.add-condition-btn').first().click();
    await page.keyboard.type('3');

    await expect.poll(() => lignesConditions(page)).toEqual([...avant.slice(0, -1), '3', '·']);
});
