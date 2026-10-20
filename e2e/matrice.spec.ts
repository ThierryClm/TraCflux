/**
 * Couleurs d'écart de la matrice : rouge au-dessus, vert en dessous de la
 * valeur du plan de référence, le premier onglet.
 * Régression de référence : un PF1 supprimé puis réimporté en tête laissait
 * tous les plans sans couleur (corrigé en 1.5.1, PR #82).
 * Les nombres attendus sont ceux du carrefour exemple (public/Carrefour_Exemple.json).
 */
import { expect, test } from '@playwright/test';
import { ecartsMatrice, ongletsPlans, ouvrirExemple, projetEnCache, projetPf1Reimporte, restaurer } from './aide';

const ATTENDUS = [
    { hausse: 0, baisse: 0 },   // plan de référence
    { hausse: 1, baisse: 21 },  // PF_90
    { hausse: 2, baisse: 18 },  // PF_80
    { hausse: 0, baisse: 23 },  // ACTUEL
    { hausse: 0, baisse: 26 },  // PF_Aiguillage
];

const lireTousLesPlans = async (page: import('@playwright/test').Page) => {
    const releves = [];
    for (let i = 0; i < ATTENDUS.length; i++) {
        await ongletsPlans(page).nth(i).click();
        await expect(ongletsPlans(page).nth(i)).toHaveClass(/active/);
        releves.push(await ecartsMatrice(page));
    }
    return releves;
};

test('carrefour exemple : écarts colorés sur chaque plan', async ({ page }) => {
    await ouvrirExemple(page);
    expect(await lireTousLesPlans(page)).toEqual(ATTENDUS);
});

test('PF1 réimporté sous un autre identifiant et placé en tête : mêmes couleurs', async ({ page, context }) => {
    await projetEnCache(context, 'PF1 reimporte', projetPf1Reimporte());
    await ouvrirExemple(page);
    await restaurer(page, 'PF1 reimporte');
    await expect(ongletsPlans(page).first()).toHaveText(/PF1_reimporte/);
    expect(await lireTousLesPlans(page)).toEqual(ATTENDUS);
});
