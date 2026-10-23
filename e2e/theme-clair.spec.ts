/**
 * Thème clair : le texte des conditions de micro-régulation reste lisible.
 * Régression de référence (22/10) : une description sans mot-clé coloré
 * gardait le gris clair du thème sombre (#ddd) sur fond clair.
 */
import { expect, test } from '@playwright/test';
import { modeDescription, ongletsPlans, ouvrirExemple } from './aide';

/** Luminance relative (0 = noir, 1 = blanc) d'une couleur CSS rgb(). */
const luminance = (rgb: string) => {
    const [r, g, b] = (rgb.match(/\d+/g) || []).slice(0, 3).map(Number).map(v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

for (const theme of ['light', 'dark'] as const) {
    test(`descriptions lisibles en thème ${theme === 'light' ? 'clair' : 'sombre'}`, async ({ page, context }) => {
        await context.addInitScript((t) => localStorage.setItem('colorTheme', t), theme);
        await ouvrirExemple(page);
        await ongletsPlans(page).filter({ hasText: 'PF_90' }).click();
        await modeDescription(page, 'Afficher');
        await expect(page.locator('.action-table textarea.input-desc').first()).toBeVisible();
        // Une description sans mot-clé coloré : c'est le champ lui-même qui porte le texte.
        const couleurs = await page.evaluate(() => {
            const el = [...document.querySelectorAll<HTMLTextAreaElement>('.action-table textarea.input-desc:not(.micro-has-backdrop)')].find(t => t.value)!;
            let fond = 'rgba(0, 0, 0, 0)';
            for (let e: Element | null = el; e && fond === 'rgba(0, 0, 0, 0)'; e = e.parentElement) fond = getComputedStyle(e).backgroundColor;
            return { texte: getComputedStyle(el).color, fond };
        });
        // Contraste WCAG d'au moins 4,5:1 entre le texte et son fond.
        const [a, b] = [luminance(couleurs.texte), luminance(couleurs.fond)].sort((x, y) => y - x);
        expect((a + 0.05) / (b + 0.05)).toBeGreaterThan(4.5);
    });
}
