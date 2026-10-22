/**
 * Un projet enregistré avec une fenêtre détachée la rouvre au chargement.
 * Régression de référence (22/10, projet réel) : sous Firefox et Safari,
 * cette réouverture levait l'erreur React n° 327 (« Should not already be
 * working ») : window.open s'exécutait au milieu d'un rendu de React.
 */
import { expect, test } from '@playwright/test';
import { ongletsPlans, ouvrirExemple, projetEnCache, projetExemple, restaurer } from './aide';

test('restaurer un projet dont la fenêtre trafic était détachée : elle se rouvre, sans erreur', async ({ page, context }) => {
    const projet = projetExemple();
    projet.layoutOptions = { ...projet.layoutOptions, showFloatingTraffic: true };
    await projetEnCache(context, 'Trafic détaché', projet);
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await ouvrirExemple(page);
    const fenetre = context.waitForEvent('page');
    await restaurer(page, 'Trafic détaché');
    await expect(ongletsPlans(page)).toHaveCount(5);
    const trafic = await fenetre;
    await expect(trafic).toHaveTitle(/Données trafic/);
    await expect(trafic.locator('tr').first()).toBeVisible();
    await page.waitForTimeout(500);
    expect(erreurs).toEqual([]);
});
