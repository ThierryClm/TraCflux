/** Formulaire : colonne Signal (ISR, livre 1, 6e partie) juste après Type. */
import { expect, test, type Page } from '@playwright/test';
import { ouvrirExemple, ouvrirMenu } from './aide';

const signalDuGroupe = (page: Page, id: number) => page.getByRole('combobox', { name: `Signal du groupe ${id}`, exact: true });

async function choisirSignal(page: Page, id: number, code: string) {
    await signalDuGroupe(page, id).click();
    await page.getByRole('listbox').locator(`[role="option"][data-value="${code}"]`).click();
}

test('choisir le signal ISR d\'un groupe dans le formulaire', async ({ page }) => {
    await ouvrirExemple(page);
    const entetes = await page.locator('.group-table th').allTextContents();
    expect(entetes.indexOf('Signal')).toBe(entetes.indexOf('Type') + 1);
    const signal = signalDuGroupe(page, 1);
    await expect(signal).toHaveJSProperty('value', '');
    await choisirSignal(page, 1, 'R14tg');
    await expect(signal).toHaveJSProperty('value', 'R14tg');
    await expect(signal).toHaveAttribute('title', 'Signal tricolore directionnel, tourne-à-gauche');
    await choisirSignal(page, 4, 'R12');
    await page.locator('.group-table-container').screenshot({ path: test.info().outputPath('formulaire-signal.png') });
    // Annuler revient au choix précédent.
    await page.locator('body').click({ position: { x: 900, y: 5 } });
    await page.keyboard.press('Control+z');
    await expect(signalDuGroupe(page, 4)).toHaveJSProperty('value', '');
    await expect(signal).toHaveJSProperty('value', 'R14tg');
});

test('le type propose signal et courant, et le formulaire tient en entier dans le panneau', async ({ page }) => {
    await ouvrirExemple(page);
    const table = page.locator('.group-table').first();
    const largeurs = await table.evaluate(t => [t.getBoundingClientRect().width, t.closest('.group-table-container')!.clientWidth]);
    expect(largeurs[0]).toBeLessThanOrEqual(largeurs[1]);
    // Groupe 3 : V, courant TD_TàG saisi, signal vide → B propose R13b et garde TD_TàG.
    const ligne = table.locator('tbody tr').nth(2);
    await ligne.locator('.input-type').selectOption('B');
    await expect(signalDuGroupe(page, 3)).toHaveJSProperty('value', 'R13b');
    await expect(ligne.locator('.input-courant')).toHaveValue('TD_TàG');
    // Groupe 1 : V vide de signal → P propose R12 et impose Piéton.
    const premiere = table.locator('tbody tr').first();
    await premiere.locator('.input-type').selectOption('P');
    await expect(signalDuGroupe(page, 1)).toHaveJSProperty('value', 'R12');
    await expect(premiere.locator('.input-courant')).toHaveValue('Piéton');
    // La liste se limite aux signaux du type ; PP propose le panneau A13b.
    await signalDuGroupe(page, 1).click();
    const options = page.getByRole('listbox').getByRole('option');
    await expect(options).toHaveText(['Aucun signal', /^R12\s*✓$/, 'R12m', 'R12pps']);
    expect(await options.evaluateAll(elements => elements.map(element => element.getAttribute('data-value')))).toEqual(['', 'R12', 'R12m', 'R12pps']);
    await expect(options.nth(1)).toHaveAttribute('title', 'Signal piéton');
    await expect(options.nth(2)).toHaveAttribute('title', 'Signal mixte piéton-cycle');
    await expect(options.nth(3)).toHaveAttribute('title', 'Signal piéton pour passage spécifique');
    await page.keyboard.press('Escape');
    await premiere.locator('.input-type').selectOption('PP');
    await expect(signalDuGroupe(page, 1)).toHaveJSProperty('value', 'A13b');
    await signalDuGroupe(page, 1).click();
    await expect(options).toHaveText(['Aucun signal', /^A13b\s*✓$/]);
    expect(await options.evaluateAll(elements => elements.map(element => element.getAttribute('data-value')))).toEqual(['', 'A13b']);
    await expect(options.nth(1)).toHaveAttribute('title', /Panneau A13b lumineux, passage pour piétons/);
    await page.keyboard.press('Escape');
    await page.locator('.group-table-container').first().screenshot({ path: test.info().outputPath('formulaire-elargi.png') });
});

test('les infobulles Formulaire sont cochées par défaut et leur désactivation reste mémorisée', async ({ page }) => {
    await ouvrirExemple(page);
    const signal = signalDuGroupe(page, 1);
    await expect(signal).toHaveAttribute('title', /Signal lumineux de circulation/);
    await signal.click();
    const liste = page.getByRole('listbox');
    const option = liste.getByRole('option', { name: 'R14tg Signal tricolore directionnel, tourne-à-gauche', exact: true });
    await expect(option).toHaveText('R14tg');
    await expect(option).toHaveAttribute('title', 'Signal tricolore directionnel, tourne-à-gauche');
    await page.keyboard.press('Escape');

    const infobulles = page.locator('.menu-item.has-submenu').filter({ hasText: /^Infobulles/ });
    const sousMenu = infobulles.locator('..').locator('.submenu-dropdown');
    const formulaire = sousMenu.getByRole('button', { name: /^(?:✓\s*)?Formulaire$/ });
    const configuration = sousMenu.getByRole('button', { name: /^(?:✓\s*)?Configuration$/ });
    await ouvrirMenu(page, 'Mise en page', infobulles);
    await infobulles.hover();
    await expect(formulaire).toHaveClass(/checked/);
    await expect(configuration).toHaveClass(/checked/);
    await formulaire.click();
    await expect(formulaire).not.toHaveClass(/checked/);
    await expect(configuration).toHaveClass(/checked/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tracflux.tooltips') || '{}')))
        .toMatchObject({ form: false, config: true });
    await page.locator('.group-table th').first().click();
    await signal.click();
    await expect(page.locator('.group-table [title]')).toHaveCount(0);
    await expect(liste.locator('[role="option"][title]')).toHaveCount(0);
    // La désignation reste accessible aux lecteurs d’écran quand l’infobulle est coupée.
    await expect(option).toHaveText('R14tg');
    await page.keyboard.press('Escape');

    // L’exemple ne se restaure pas avec F5 : on recharge son URL, comme dans les autres parcours.
    await ouvrirExemple(page);
    await expect(signal).not.toHaveAttribute('title');
    await ouvrirMenu(page, 'Mise en page', infobulles);
    await infobulles.hover();
    await expect(formulaire).not.toHaveClass(/checked/);
    await expect(configuration).toHaveClass(/checked/);
    await page.locator('.group-table th').first().click();
    await signal.click();
    await expect(page.locator('.group-table [title]')).toHaveCount(0);
    await expect(liste.locator('[role="option"][title]')).toHaveCount(0);
    await expect(option).toHaveText('R14tg');
});

test('sur téléphone, les signaux illustrés restent dans l’écran et le choix est conservé', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ouvrirExemple(page);
    const signal = signalDuGroupe(page, 1);
    // Le tableau garde son défilement horizontal ; le bouton est amené à l’écran.
    await signal.scrollIntoViewIfNeeded();
    await signal.click();
    const liste = page.getByRole('listbox');
    await expect(liste).toBeVisible();
    const cadre = await liste.boundingBox();
    expect(cadre).not.toBeNull();
    expect(cadre!.x).toBeGreaterThanOrEqual(0);
    expect(cadre!.y).toBeGreaterThanOrEqual(0);
    expect(cadre!.x + cadre!.width).toBeLessThanOrEqual(390);
    expect(cadre!.y + cadre!.height).toBeLessThanOrEqual(844);
    // Toutes les propositions renseignées ont le dessin du signal.
    const options = liste.locator('[role="option"][data-value]:not([data-value=""])');
    expect(await options.count()).toBeGreaterThan(0);
    for (const option of await options.all()) {
        await expect(option.locator('svg[data-forme]')).toHaveCount(1);
    }
    await liste.locator('[role="option"][data-value="R14tg"]').click();
    await expect(liste).toHaveCount(0);
    await expect(signal).toHaveJSProperty('value', 'R14tg');
    await expect(signal.locator('svg[data-forme="tg"]')).toBeVisible();
    await signal.click();
    await expect(liste.locator('[role="option"][data-value="R14tg"]')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(signal).toHaveJSProperty('value', 'R14tg');
});

test('les titres des familles de signaux suivent la palette du diagnostic dans les sept thèmes', async ({ page }) => {
    await ouvrirExemple(page);
    await signalDuGroupe(page, 1).click();
    const familles = page.getByRole('listbox').locator('.signal-select-family');
    await expect(familles.first()).toBeVisible();
    // Les couleurs sont celles des titres de DiagnosticPanel, converties en rgb CSS.
    const palettes = [
        { classe: '', couleur: 'rgb(238, 238, 238)' }, // #eee, sombre
        { classe: 'light-mode', couleur: 'rgb(34, 34, 34)' }, // #222
        { classe: 'high-contrast-mode', couleur: 'rgb(255, 221, 0)' }, // #ffdd00
        { classe: 'amber-mode', couleur: 'rgb(255, 179, 0)' }, // #ffb300
        { classe: 'daltonian-mode', couleur: 'rgb(76, 201, 240)' }, // #4cc9f0
        { classe: 'sepia-mode', couleur: 'rgb(139, 69, 19)' }, // #8b4513
        { classe: 'blue-night-mode', couleur: 'rgb(42, 161, 152)' } // #2aa198
    ];
    const classes = palettes.map(p => p.classe).filter(Boolean);
    const nombreFamilles = await familles.count();
    for (const palette of palettes) {
        await test.step(palette.classe || 'sombre', async () => {
            // On ne teste pas le menu de thème : seules les classes CSS du body changent.
            await page.evaluate(({ classes, classe }) => {
                document.body.classList.remove(...classes);
                if (classe) document.body.classList.add(classe);
            }, { classes, classe: palette.classe });
            await expect.poll(() => familles.evaluateAll(elements => elements.map(element => getComputedStyle(element).color)))
                .toEqual(Array(nombreFamilles).fill(palette.couleur));
        });
    }
});
