/**
 * Recherche dans l'aide : un mot saisi est surligné partout, on passe d'une
 * occurrence à l'autre, et la liste des chapitres mène à la section voulue.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ouvrirMenu } from './aide';

/** Ouvre l'aide, qui s'affiche dans sa fenêtre détachée, et rend cette fenêtre. */
const ouvrirAide = async (page: Page): Promise<Page> => {
    await page.goto('/');
    const item = page.locator('.menu-bar').getByText('Aide', { exact: true });
    await ouvrirMenu(page, 'A propos', item);
    const nouvelle = page.context().waitForEvent('page');
    await item.click();
    const aide = await nouvelle;
    await expect(aide.getByRole('searchbox', { name: "Rechercher dans l'aide" })).toBeVisible({ timeout: 15_000 });
    return aide;
};

/** Surlignages posés, et position de l'occurrence courante dans la fenêtre d'aide. */
const etat = (page: Page) => page.evaluate(() => {
    const reg = (CSS as any).highlights;
    const courante = reg?.get('aide-recherche-courante');
    const [plage] = courante ? [...courante] as Range[] : [];
    const corps = document.querySelector('.modal-body')!.getBoundingClientRect();
    const barre = document.querySelector('.help-recherche')!.getBoundingClientRect();
    const r = plage?.getBoundingClientRect();
    return {
        tous: reg?.get('aide-recherche')?.size ?? 0,
        texte: plage?.toString() ?? '',
        section: plage?.startContainer.parentElement?.closest('section')?.querySelector('h4')?.textContent ?? '',
        visible: !!r && r.top >= barre.bottom - 1 && r.bottom <= corps.bottom + 1,
        barreEnHaut: Math.abs(barre.top - corps.top) < 2,
        defilement: document.querySelector('.modal-body')!.scrollTop,
    };
});

test("chercher un mot dans l'aide : surlignage, suivant / précédent, chapitres", async ({ page: appli }) => {
    const page = await ouvrirAide(appli);
    const champ = page.getByRole('searchbox', { name: "Rechercher dans l'aide" });
    // Le curseur attend dans le champ dès l'ouverture : on tape directement.
    await expect(champ).toBeFocused();
    await page.keyboard.type('escamotage');
    const compteur = page.locator('.help-recherche-compteur');
    await expect(compteur).toHaveText(/^1 \/ \d+$/);
    const total = Number((await compteur.textContent())!.split('/ ')[1]);
    expect(total).toBeGreaterThan(10);

    let e = await etat(page);
    expect(e.tous).toBe(total);
    expect(e.texte.toLowerCase()).toBe('escamotage');
    expect(e.visible).toBe(true);
    await expect(page.getByRole('button', { name: 'Occurrence précédente' })).toBeDisabled();

    // Entrée : occurrence suivante, amenée à l'écran sous la barre, qui reste en haut.
    for (let i = 0; i < 5; i++) await champ.press('Enter');
    await expect(compteur).toHaveText(`6 / ${total}`);
    e = await etat(page);
    expect(e.visible).toBe(true);
    expect(e.barreEnHaut).toBe(true);
    expect(e.defilement).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Occurrence précédente' }).click();
    await expect(compteur).toHaveText(`5 / ${total}`);

    // La liste des chapitres mène à la section choisie.
    await page.getByRole('button', { name: /^Chapitres \(\d+\)/ }).click();
    const liste = page.getByRole('listbox', { name: 'Chapitres qui contiennent ce mot' });
    await expect(liste.getByText('Chapitre 2 — Onde verte')).toHaveCount(0);
    await liste.getByRole('button', { name: /^Simulation\s*\d+$/ }).click();
    await expect(liste).toBeHidden();
    e = await etat(page);
    expect(e.section).toBe('Simulation');
    expect(e.visible).toBe(true);

    // Dernière occurrence : la flèche du bas se grise.
    for (let i = 0; i < total; i++) await champ.press('Enter');
    await expect(compteur).toHaveText(`${total} / ${total}`);
    await expect(page.getByRole('button', { name: 'Occurrence suivante' })).toBeDisabled();

    // Sans accent ni majuscule ; Échap efface tout.
    await champ.fill('ecran');
    await expect(compteur).toHaveText(/^1 \/ \d+$/);
    expect((await etat(page)).texte).toMatch(/^[ÉéEe]cran$/);
    await champ.press('Escape');
    await expect(champ).toHaveValue('');
    expect((await etat(page)).tous).toBe(0);
});

test("l'aide est une fenêtre détachée : l'application reste utilisable, la rouvrir ne la double pas", async ({ page }) => {
    const aide = await ouvrirAide(page);
    await expect(aide).toHaveTitle(/Aide - TraCflux/);
    // Pas de modale qui recouvre l'application.
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
    // Le sommaire mène à sa section, dans la fenêtre de l'aide.
    await aide.locator('#help-sommaire').getByText('Démarche conseillée sur un nouveau carrefour', { exact: true }).click();
    await expect(aide.locator('#help-demarche')).toBeInViewport();
    // Redemander l'aide la ramène, sans ouvrir une seconde fenêtre.
    const pages = page.context().pages().length;
    const item = page.locator('.menu-bar').getByText('Aide', { exact: true });
    await ouvrirMenu(page, 'A propos', item);
    await item.click();
    await expect.poll(() => page.context().pages().length).toBe(pages);
    await aide.close();
});
