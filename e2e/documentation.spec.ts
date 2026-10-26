import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
    test(`documentation accessible sans compte à ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ['faq/', 'presentation/', 'presentation/details.html']) {
            await page.goto(`/${path}`);
            await expect(page.locator('h1')).toBeVisible();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            const links = await page.locator('main a').evaluateAll(elements => elements.map(element => (element as HTMLAnchorElement).href));
            for (const href of [...new Set(links)]) {
                const url = new URL(href);
                if (url.origin !== new URL(page.url()).origin) continue;
                const response = await page.request.get(href);
                expect(response.ok(), href).toBe(true);
                if (url.hash) {
                    const html = await response.text();
                    expect(html, href).toContain(`id="${decodeURIComponent(url.hash.slice(1))}"`);
                }
            }
        }
        await page.goto('/presentation/');
        await page.getByRole('link', { name: 'Questions fréquentes', exact: true }).last().click();
        await expect(page).toHaveURL(/\/faq\/$/);
    });
}
