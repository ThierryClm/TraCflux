import { expect, test } from '@playwright/test';
import { menuFichier, ongletsPlans } from './aide';

// Projet entièrement fictif : aucun carrefour réel ni schéma source recopié.
const phase = (n: number, ids: string[]) => `<Phase><Durée>${n}</Durée>${ids.map(id => `<IDLigneFeux>${id}</IDLigneFeux>`).join('')}</Phase>`;
const phases = (a: number, b: number) => phase(a, ['Vehicule', 'Bus']) + phase(b, ['Traversee']);
const xml = `<DataSetDiagfeux><Paramétrage Version="3"/><Carrefour>
<Propriétés><Nom>Import fictif DiagFeux</Nom><EnAgglo>true</EnAgglo></Propriétés><Variante>
<LigneDeFeux><ID>Vehicule</ID><Signal strCode="R11"/><RougeDégagement IDAdverse="Traversee">4</RougeDégagement></LigneDeFeux>
<LigneDeFeux><ID>Bus</ID><Signal strCode="R13b"/><RougeDégagement IDAdverse="Traversee">4</RougeDégagement></LigneDeFeux>
<LigneDeFeux><ID>Traversee</ID><Signal strCode="R12"/><RougeDégagement IDAdverse="Vehicule">7</RougeDégagement><RougeDégagement IDAdverse="Bus">7</RougeDégagement></LigneDeFeux>
<PlanFeux ID="Programme" Définitif="true">${phases(15, 15)}</PlanFeux>
<PlanFeux ID="Programme"><NomFonctionnement>Pointe</NomFonctionnement>${phases(45, 35)}</PlanFeux>
<PlanFeux ID="Programme"><NomFonctionnement>Creuse</NomFonctionnement>${phases(30, 30)}</PlanFeux>
</Variante></Carrefour></DataSetDiagfeux>`;

test('l’import DiagFeux affiche les types et signaux, et garde les cycles en changeant de plan', async ({ page }) => {
    await page.goto('/');
    await menuFichier(page, 'Importer');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Projet DiagFeux/ }).click();
    await (await chooser).setFiles({ name: 'carrefour-fictif.dfe', mimeType: 'application/xml', buffer: Buffer.from(xml) });
    await page.getByRole('button', { name: 'Importer', exact: true }).click();
    const points = page.locator('.modal-overlay').filter({ hasText: 'Import DiagFeux — points à vérifier' });
    await expect(points).toBeVisible();
    await points.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(ongletsPlans(page)).toHaveCount(2);
    const rows = page.locator('.group-table tbody tr');
    for (const [i, type, signal] of [[0, 'V', 'R11v'], [1, 'B', 'R13b'], [2, 'P', 'R12']] as const) {
        await expect(rows.nth(i).locator('select').first()).toHaveValue(type);
        await expect(rows.nth(i).locator('select').first().locator('option:checked')).toHaveText(type);
        await expect(page.getByRole('combobox', { name: `Signal du groupe ${i + 1}`, exact: true })).toHaveJSProperty('value', signal);
    }
    const cycle = page.locator('.cycle-input-label input').first();
    await expect(cycle).toHaveValue('80');
    await ongletsPlans(page).filter({ hasText: 'Creuse' }).click();
    await expect(cycle).toHaveValue('60');
    await ongletsPlans(page).filter({ hasText: 'Pointe' }).click();
    await expect(cycle).toHaveValue('80');
    await page.screenshot({ path: test.info().outputPath('import-diagfeux.png') });
});
