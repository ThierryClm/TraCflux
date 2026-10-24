/**
 * Parcours réels dans de vrais navigateurs (Chrome, Edge, Firefox, Safari/WebKit, Brave),
 * sur la version compilée servie par `vite preview` : celle que reçoivent les
 * utilisateurs. Les tests unitaires (Vitest, src/) vérifient des morceaux de
 * code ; ceux-ci rejouent ce que fait l'utilisateur, y compris les cas de
 * données qui ont produit des régressions.
 *
 *   npm run e2e            tous les navigateurs (Chrome, Edge, Firefox, Safari)
 *   npm run e2e -- --project=firefox
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Brave n'est pas fourni par Playwright : on prend celui du poste, ou celui
// que désigne BRAVE_PATH (la CI l'installe et le désigne ainsi).
const BRAVE = process.env.BRAVE_PATH
    || ['/usr/bin/brave-browser', '/opt/brave.com/brave/brave', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'].find(existsSync);

// 4190 est un port réservé (ManageSieve) : Firefox et WebKit refusent d'y aller.
const PORT = 4321;

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: true,
    // En local, 4 navigateurs à la fois au plus : au-delà, WebKit plante sur
    // une machine chargée (« Target crashed »). La CI garde son réglage.
    workers: process.env.CI ? undefined : 4,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        viewport: { width: 1600, height: 900 },
        trace: 'retain-on-failure',
        // Les parcours n'ont pas besoin du mode hors ligne : sans service
        // worker, chaque test part d'une page servie par le réseau.
        serviceWorkers: 'block',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } } },
        // Edge, le vrai navigateur de Microsoft (et non son moteur Chromium
        // seul) : c'est celui de Thierry au quotidien.
        { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1600, height: 900 } } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1600, height: 900 } } },
        { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1600, height: 900 } } },
        // Brave : moteur de Chrome, mais sans les fenêtres natives Ouvrir /
        // Enregistrer, qu'il masque pour protéger la vie privée.
        ...(BRAVE ? [{ name: 'brave', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 }, launchOptions: { executablePath: BRAVE } } }] : []),
    ],
    webServer: {
        command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
