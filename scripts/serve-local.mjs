// Boucle de test locale (npm run serve).
//
// Remplace le double-clic sur Lancer-preview.vbs pour la mise à jour de
// l'application déjà installée en PWA sur http://localhost:4173 :
//
//   1. reconstruit dist/ ;
//   2. démarre le serveur d'aperçu SEULEMENT s'il ne tourne pas déjà.
//
// Le second point est le cœur du script. `vite preview` sert dist/ avec sirv
// en mode `dev: true` : chaque requête relit le disque, donc un serveur déjà
// lancé sert le nouveau build sans redémarrage. Le relancer serait non
// seulement inutile mais impossible — `preview.strictPort` (vite.config.js)
// fait échouer franchement le second serveur sur un port occupé.
//
// Le serveur est détaché du processus courant : il survit à la fermeture du
// terminal (ou de la session Claude Code) qui l'a lancé, comme le faisait la
// cmd cachée du lanceur VBS.

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = 4173;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Sonde TCP plutôt que HTTP : on ne veut savoir qu'une chose, si le port est
// pris. Un GET distinguerait mal « pas de serveur » d'une réponse 404.
//
// Les deux boucles sont testées : Vite écoute sur « localhost », que Windows
// résout en ::1. Ne sonder que 127.0.0.1 faisait conclure à tort qu'aucun
// serveur ne tournait — et relancer un serveur que strictPort refusait.
function tryConnect(host, port) {
    return new Promise(resolve => {
        const socket = net.connect({ host, port });
        const done = (busy) => { socket.destroy(); resolve(busy); };
        socket.setTimeout(1000);
        socket.on('connect', () => done(true));
        socket.on('timeout', () => done(false));
        socket.on('error', () => done(false));
    });
}

async function portBusy(port) {
    for (const host of ['127.0.0.1', '::1']) {
        if (await tryConnect(host, port)) return true;
    }
    return false;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const alreadyServing = await portBusy(PORT);

console.log('→ Construction du bundle de production…');
const build = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true });
if (build.status !== 0) {
    console.error('\n✗ Build en échec : le serveur garde l\'ancien bundle, rien n\'a changé côté application.');
    process.exit(build.status ?? 1);
}

if (alreadyServing) {
    console.log(`\n✓ Serveur déjà en écoute sur http://localhost:${PORT} — il sert le nouveau build.`);
} else {
    console.log(`\n→ Démarrage du serveur d'aperçu sur le port ${PORT}…`);
    const child = spawn('npm run preview', {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        shell: true,
        windowsHide: true
    });
    child.unref();

    // On attend qu'il réponde vraiment avant d'annoncer que c'est prêt : un
    // port encore occupé par un node.exe fantôme ferait échouer strictPort, et
    // mieux vaut le dire que laisser l'utilisateur devant une page morte.
    let up = false;
    for (let i = 0; i < 30 && !up; i++) {
        await wait(500);
        up = await portBusy(PORT);
    }
    if (!up) {
        console.error(`\n✗ Le serveur n'a pas répondu sur le port ${PORT}.`);
        console.error('  Port occupé par un processus node résiduel ? « npm run clean » puis relancer.');
        process.exit(1);
    }
    console.log(`\n✓ Serveur prêt sur http://localhost:${PORT}`);
}

console.log('\nDans la fenêtre TraCflux : Ctrl+R, puis clic sur « Recharger » quand le bandeau apparaît.');
