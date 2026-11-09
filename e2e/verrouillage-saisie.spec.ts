/**
 * Mise en page → Verrouillage saisie : une section cochée garde ses valeurs
 * lisibles mais non modifiables (pas de clavier sur smartphone).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ouvrirExemple } from './aide';

const cocher = async (page: Page, section: string) => {
    const sousMenu = page.locator('.menu-item-with-submenu', { hasText: 'Verrouillage saisie' });
    const miseEnPage = page.locator('.menu-bar').getByText('Mise en page', { exact: true });
    for (let i = 0; i < 6 && !(await sousMenu.isVisible()); i++) {
        await page.mouse.move(5, 400);
        await miseEnPage.hover();
        if (await sousMenu.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) break;
        await miseEnPage.click();
        await sousMenu.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
    }
    await sousMenu.hover();
    await sousMenu.locator('.submenu-dropdown').getByText(new RegExp(`^✓?${section}$`)).click();
    await page.keyboard.press('Escape');
    await page.mouse.click(900, 1050);
};

const deplacer = async (page: Page, poignee: Locator) => {
    await poignee.scrollIntoViewIfNeeded();
    const position = await poignee.boundingBox();
    expect(position).not.toBeNull();
    const x = position!.x + position!.width / 2, y = position!.y + position!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 18, y, { steps: 6 });
    await page.mouse.up();
};

test('verrouiller la configuration et le diagramme : champs en lecture seule, le reste modifiable', async ({ page }) => {
    await ouvrirExemple(page);
    const nom = page.locator('.group-table input').first();
    const cycle = page.locator('.cycle-input-label input').first();
    await expect(nom).not.toHaveAttribute('readonly');
    await cocher(page, 'Configuration');
    await cocher(page, 'Diagramme');
    await expect(nom).toHaveAttribute('readonly');
    await expect(page.locator('.group-table-title .mention-verrou')).toHaveText('(verrouillé)');
    await expect(page.locator('.diagram-title .mention-verrou')).toHaveText('(verrouillé)');
    await expect(page.locator('.group-table select').first()).toBeDisabled();
    const ligne = page.locator('.group-table tbody tr').first();
    for (const classe of ['.input-name-cell', '.input-type', '.input-courant', '.input-mini', '.input-yellow', '.signal-select-trigger']) {
        await expect(ligne.locator(classe)).toHaveCSS('cursor', 'not-allowed');
    }
    await expect(ligne.locator('select').first()).toHaveCSS('appearance', 'none');
    await expect(ligne.locator('.signal-select-chevron')).toHaveCount(0);
    await expect(cycle).toHaveAttribute('readonly');
    // La valeur ne change pas à la frappe.
    const avant = await cycle.inputValue();
    await cycle.click();
    await page.keyboard.type('9');
    await expect(cycle).toHaveValue(avant);
    // Conditions de micro-régulation et variables micro.
    await cocher(page, 'Conditions de micro-régulation');
    await cocher(page, 'Variables micro');
    await expect(page.locator('.action-table select').first()).toBeDisabled();
    await expect(page.locator('.action-table select').first()).toHaveCSS('appearance', 'none');
    await expect(page.locator('.action-table textarea').first()).toHaveAttribute('readonly');
    await expect(page.locator('.custom-field-input').first()).toHaveAttribute('readonly');
    // La matrice, non cochée, reste modifiable.
    await expect(page.locator('.matrix-grid input').first()).not.toHaveAttribute('readonly');
    await cocher(page, 'Conditions de micro-régulation');
    await cocher(page, 'Variables micro');
    await expect(page.locator('.action-table select').first()).toBeEnabled();
    await cocher(page, 'Configuration');
    await cocher(page, 'Diagramme');
    await expect(page.locator('.group-table input').first()).not.toHaveAttribute('readonly');
    await expect(ligne.locator('select').first()).not.toHaveCSS('appearance', 'none');
    await expect(ligne.locator('.signal-select-chevron')).toBeVisible();
    await expect(ligne.locator('.input-name-cell')).not.toHaveCSS('cursor', 'not-allowed');
    await expect(page.locator('.cycle-input-label input').first()).not.toHaveAttribute('readonly');
});

test('diagramme verrouillé : les glissements des groupes et des actions ne modifient plus le plan', async ({ page }) => {
    await ouvrirExemple(page);
    const valeurs = () => page.locator('.timeline-sidebar input, .action-table input').evaluateAll(champs =>
        champs.map(champ => (champ as HTMLInputElement).value));
    const avant = await valeurs();
    await cocher(page, 'Diagramme');
    await deplacer(page, page.locator('.timeline-container .drag-handle-end').first());
    await deplacer(page, page.locator('.timeline-container .action-drag-handle').first());
    expect(await valeurs()).toEqual(avant);
    await expect(page.locator('.timeline-container')).not.toHaveClass(/dragging/);
    // La consultation et le détachement du diagramme restent proposés.
    await expect(page.locator('.diagram-detach-btn')).toBeEnabled();
    await cocher(page, 'Diagramme');
    await deplacer(page, page.locator('.timeline-container .drag-handle-end').first());
    await expect.poll(valeurs).not.toEqual(avant);
});


test('Trafic : la mention remplace le filtre et suit le verrou dans une fenêtre déjà détachée', async ({ page, context }) => {
    await ouvrirExemple(page);
    await page.locator('.tab-btn', { hasText: /^Trafic$/ }).click();
    const trafic = page.locator('.traffic-table-container');
    const ouverte = context.waitForEvent('page');
    await trafic.locator('.detach-btn').click();
    const fenetre = await ouverte;
    await expect(fenetre.locator('.traffic-table-container')).toBeVisible();
    await fenetre.getByRole('checkbox', { name: 'Tous les Grp' }).check();
    const largeur = await fenetre.evaluate(() => innerWidth);
    await cocher(page, 'Trafic');
    await expect(fenetre).toHaveTitle(/Données trafic \(verrouillé\)/);
    await expect(fenetre.locator('.traffic-header .mention-verrou')).toHaveText('(verrouillé)');
    await expect(fenetre.getByRole('checkbox', { name: 'Tous les Grp' })).toHaveCount(0);
    await expect(fenetre.locator('select').first()).toHaveCSS('appearance', 'none');
    await expect(fenetre.locator('select').first()).toHaveCSS('cursor', 'not-allowed');
    expect(await fenetre.evaluate(() => innerWidth)).toBe(largeur);
    await cocher(page, 'Trafic');
    await expect(fenetre).not.toHaveTitle(/verrouillé/);
    await expect(fenetre.getByRole('checkbox', { name: 'Tous les Grp' })).toBeChecked();
});


test('Scénarios : le verrou fige le choix, les commandes et les cases sans perdre leur état', async ({ page }) => {
    await ouvrirExemple(page);
    await page.locator('.simulation-tab').click();
    const panneau = page.locator('.simulation-panel');
    const choix = panneau.locator('.simulation-scenario-select');
    const cases = panneau.locator('input[type=checkbox]');
    const etat = () => cases.evaluateAll(elements => elements.map(e => (e as HTMLInputElement).checked));
    const avant = await etat();
    await choix.click();
    await expect(panneau.getByRole('listbox')).toBeVisible();
    await cocher(page, 'Scénarios');
    await expect(panneau.locator('.mention-verrou')).toHaveText('(verrouillé)');
    await expect(panneau.getByRole('listbox')).toHaveCount(0);
    await expect(choix).toBeDisabled();
    await expect(panneau.locator('.simulation-scenario-fleche')).toHaveCount(0);
    await expect(panneau.getByRole('button', { name: 'Enregistrer…' })).toBeDisabled();
    for (let i = 0; i < await cases.count(); i++) await expect(cases.nth(i)).toBeDisabled();
    // Cliquer le libellé d'une action ne contourne pas la case désactivée.
    await panneau.locator('.simulation-item').first().click();
    expect(await etat()).toEqual(avant);
    await cocher(page, 'Scénarios');
    await expect(choix).toBeEnabled();
    await expect(panneau.locator('.simulation-scenario-fleche')).toBeVisible();
    expect(await etat()).toEqual(avant);
    await panneau.locator('.simulation-item input').first().click();
    await expect.poll(etat).not.toEqual(avant);
});

test('Phasages bulles : groupes, phases, instants et curseurs partagent un verrou indépendant', async ({ page }) => {
    await ouvrirExemple(page);
    await cocher(page, 'Phasages bulles');
    await page.locator('.phasage-tab').click();
    const groupes = page.locator('.phasage-bulle-sidebar');
    const panneau = page.locator('.phasage-config-panel');
    const bulles = page.locator('.phasage-bulle-container');
    await expect(bulles.locator('.mention-verrou')).toHaveText('(verrouillé)');
    await expect(groupes.locator('.mention-verrou')).toHaveText('(verrouillé)');
    await expect(groupes.getByRole('button', { name: 'Tout décocher' })).toBeDisabled();
    await expect(groupes.getByRole('checkbox').first()).toBeDisabled();
    await expect(panneau.locator('select')).toBeDisabled();
    await expect(panneau.locator('select')).toHaveCSS('appearance', 'none');
    await expect(panneau.locator('input').first()).toHaveAttribute('readonly');
    await expect(panneau.getByRole('button', { name: 'OK' })).toBeDisabled();
    const curseurs = bulles.getByRole('slider');
    for (let i = 0; i < await curseurs.count(); i++) await expect(curseurs.nth(i)).toBeDisabled();
    const valeur = await curseurs.first().inputValue();
    await cocher(page, 'Phasages bulles');
    await expect(panneau.locator('select')).toBeEnabled();
    await panneau.locator('select').selectOption('3');
    await panneau.locator('input').first().fill('17');
    await panneau.getByRole('button', { name: 'OK' }).click();
    await expect(bulles.locator('.phase-bubble')).toHaveCount(3);
    await expect(bulles.locator('.phase-time-display').first()).toHaveText('Seconde 17');
    await groupes.getByRole('button', { name: 'Tout décocher' }).click();
    await expect(groupes.locator('input:checked')).toHaveCount(0);
    await expect(curseurs.first()).toBeEnabled();
    await curseurs.first().focus();
    await curseurs.first().press('ArrowRight');
    await expect(curseurs.first()).not.toHaveValue(valeur);
    // Le verrou des scénarios reste indépendant de celui du phasage.
    await page.locator('.simulation-tab').click();
    await expect(page.locator('.simulation-scenario-select')).toBeEnabled();
});
