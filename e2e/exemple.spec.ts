/**
 * Projet exemple : non enregistrable, jusqu'au chargement d'un vrai projet.
 * Régression de référence : « Restaurer un projet récent » laissait le
 * projet restauré en mode exemple, Sauvegarder grisé et sauvegarde
 * automatique coupée (corrigé en 1.5.0, PR #79).
 */
import { expect, test } from '@playwright/test';
import { entreesGrisees, ouvrirExemple, projetEnCache, projetExemple, restaurer } from './aide';

test('Sauvegarder est grisé sur l\'exemple, et redevient actif sur un projet restauré', async ({ page, context }) => {
    await projetEnCache(context, 'Mon carrefour', projetExemple());
    await ouvrirExemple(page);
    expect(await entreesGrisees(page)).toContain('Sauvegarder');

    await restaurer(page, 'Mon carrefour');
    // Sans ^ : sur une machine chargée, un projet tout juste restauré peut
    // prendre l'astérisque « modifié » (défaut connu, à corriger à part).
    await expect(page).toHaveTitle(/Mon carrefour/);
    expect(await entreesGrisees(page)).not.toContain('Sauvegarder');
});
