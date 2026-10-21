/** Gestes et jeux de données partagés par les parcours. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';

const EXEMPLE = fileURLToPath(new URL('../public/Carrefour_Exemple.json', import.meta.url));

/** Le carrefour exemple (13 groupes, 5 plans de feu), en objet neuf à chaque appel. */
export const projetExemple = (): Record<string, any> => JSON.parse(readFileSync(EXEMPLE, 'utf8'));

/**
 * Cas de Thierry (19/10) : le PF1 d'origine supprimé, réimporté depuis un
 * autre projet (il reçoit un autre identifiant) et replacé en premier onglet.
 */
export const projetPf1Reimporte = () => {
    const projet = projetExemple();
    const pf1 = projet.pfTabs.find((pf: { id: number }) => pf.id === 1);
    projet.pfTabs = [
        { ...structuredClone(pf1), id: 9, name: 'PF1_reimporte' },
        ...projet.pfTabs.filter((pf: { id: number }) => pf.id !== 1),
    ];
    projet.activePFId = 9;
    return projet;
};

/** Place un projet dans le cache du navigateur, comme s'il avait été enregistré sur ce poste. */
export const projetEnCache = async (context: BrowserContext, nom: string, projet: object) => {
    await context.addInitScript(([cle, contenu, nomProjet]) => {
        if (!localStorage.getItem(cle)) {
            localStorage.setItem(cle, contenu);
            localStorage.setItem('traffic_project_order', JSON.stringify([nomProjet]));
        }
    }, [`traffic_project_${nom}`, JSON.stringify({ ...projet, projectName: nom }), nom]);
};

/** Ouvre le carrefour exemple et attend ses onglets de plans. */
export const ouvrirExemple = async (page: Page) => {
    await page.goto('/?example=carrefour');
    await page.locator('.pf-tab').first().waitFor({ timeout: 30_000 });
};

/**
 * Ouvre le menu Fichier jusqu'à voir `item`. Le menu s'ouvre au survol et un
 * clic le bascule : selon le navigateur et la charge, un clic seul pouvait le
 * refermer aussitôt (WebKit en CI). À chaque essai, survol franc (la souris
 * revient de l'extérieur), puis clic si le menu reste fermé.
 */
export const ouvrirMenuFichier = (page: Page, item: Locator) => ouvrirMenu(page, 'Fichier', item);

/** Ouvre le menu `menu` de la barre jusqu'à voir `item` (voir ouvrirMenuFichier). */
export const ouvrirMenu = async (page: Page, menu: string, item: Locator) => {
    const bouton = page.locator('.menu-bar').getByText(menu, { exact: true });
    for (let i = 0; i < 6 && !(await item.isVisible()); i++) {
        // La souris quitte d'abord la barre : un survol qui ne change pas de
        // cible ne déclenche rien, et le menu restait fermé (WebKit chargé).
        await page.mouse.move(5, 400);
        await bouton.hover();
        if (await item.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) break;
        await bouton.click();
        await item.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
    }
};

/** Clique une entrée du menu Fichier. */
export const menuFichier = async (page: Page, entree: string | RegExp) => {
    const item = page.locator('.menu-bar').getByText(entree).first();
    await ouvrirMenuFichier(page, item);
    await item.click();
};

/** Entrées du menu Fichier grisées. */
export const entreesGrisees = async (page: Page) => {
    await ouvrirMenuFichier(page, page.locator('.menu-bar').getByText('Nouveau projet').first());
    const grises = await page.evaluate(() => [...document.querySelectorAll('.menu-item.disabled, .menu-item[aria-disabled=true], .menu-item:disabled')]
        .map(e => (e.textContent || '').trim()));
    await page.keyboard.press('Escape');
    await page.mouse.click(800, 880);
    return grises;
};

/** Restaure un projet du cache par Fichier > Restaurer un projet récent. */
export const restaurer = async (page: Page, nom: string) => {
    await menuFichier(page, 'Restaurer un projet récent');
    const fenetre = page.locator('.modal-overlay').last();
    await fenetre.getByText(nom).first().click();
    await fenetre.locator('button', { hasText: /^Ouvrir$/ }).click();
    // Si le projet affiché passe pour modifié (cf. l'astérisque sous charge),
    // une confirmation s'ouvre, parfois avec retard : on attend qu'elle
    // apparaisse ou que la fenêtre de restauration se ferme.
    const continuer = page.locator('.modal-overlay button', { hasText: 'Continuer' });
    await expect.poll(async () => (await continuer.isVisible()) || !(await fenetre.isVisible()), { timeout: 15_000 }).toBe(true);
    if (await continuer.isVisible()) await continuer.click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
};

/** Onglets des plans de feu (sans Simulation ni Phasage). */
export const ongletsPlans = (page: Page) => page.locator('.pf-tab:not(.simulation-tab):not(.phasage-tab)');

/** Cases de la matrice colorées : plus grandes (rouge) et plus petites (vert) que le plan de référence. */
export const ecartsMatrice = (page: Page) => page.evaluate(() => ({
    hausse: document.querySelectorAll('.matrix-grid .matrix-compare-higher').length,
    baisse: document.querySelectorAll('.matrix-grid .matrix-compare-lower').length,
}));

/** Numéros de GF du tableau des conditions, ligne de saisie vide comprise (« · »). */
export const lignesConditions = (page: Page) => page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement>('.action-table .input-gf')].map(i => i.value || '·'));

/** Mise en page > Description des conditions micro > Afficher / Masquer / Automatique. */
export const modeDescription = async (page: Page, choix: 'Afficher' | 'Masquer' | 'Automatique') => {
    const sousMenu = page.locator('.menu-item-with-submenu', { hasText: 'Description des conditions micro' });
    const miseEnPage = page.locator('.menu-bar').getByText('Mise en page', { exact: true });
    for (let i = 0; i < 6 && !(await sousMenu.isVisible()); i++) {
        await page.mouse.move(5, 400);
        await miseEnPage.hover();
        if (await sousMenu.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) break;
        await miseEnPage.click();
        await sousMenu.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
    }
    await sousMenu.hover();
    await sousMenu.locator('.submenu-dropdown').getByText(new RegExp(`^${choix}`)).click();
    await page.keyboard.press('Escape');
    await page.mouse.click(900, 1050);
};
