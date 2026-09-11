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
// Le serveur est lancé HORS de l'arbre de processus courant. `detached: true`
// ne suffit pas sous Windows : le processus devient bien orphelin de son
// lanceur, mais il reste dans le job object du terminal, et Windows tue d'un
// bloc tous les processus d'un job quand celui-ci se referme. Le 2026-09-11 le
// serveur a ainsi disparu en pleine session, sans que rien ne l'arrête.
//
// Le contournement passe par WMI : un processus créé par Win32_Process.Create
// a pour parent WmiPrvSE.exe, un hôte de service, et n'appartient donc à aucun
// job du terminal. Vérifié sur un processus témoin avant d'être retenu.
//
// Lancer node directement, sans cmd ni npm intermédiaires, retire au passage
// trois processus de la chaîne.

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
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

// Lance `vite preview` hors du job object courant, via WMI. Rend false si la
// voie n'est pas praticable (autre système, PowerShell absent, WMI refusé) :
// l'appelant se rabat alors sur un spawn détaché ordinaire.
function lancerHorsJob() {
    if (process.platform !== 'win32') return false;
    const ps = (t) => `'${String(t).replace(/'/g, "''")}'`;
    const ligne = `"${process.execPath}" "${path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')}" preview`;
    const script = [
        '$ErrorActionPreference = "Stop"',
        'try {',
        '  $si = New-CimInstance -Namespace root/cimv2 -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }',
        `  $r = Invoke-CimMethod -Namespace root/cimv2 -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${ps(ligne)}; CurrentDirectory = ${ps(root)}; ProcessStartupInformation = $si }`,
        '  exit $r.ReturnValue',
        '} catch { exit 1 }'
    ].join(String.fromCharCode(10));
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore' });
    return r.status === 0;
}

// Le serveur écoute-t-il, ET sert-il bien le bundle qu'on vient de construire ?
// La sonde TCP ne dit que la première moitié : un node résiduel tenant le port
// répondrait « occupé » sans rien servir d'utile. C'est le seul contrôle qui
// protège de l'erreur coûteuse — annoncer « c'est prêt » quand la PWA
// continuera en réalité de servir son cache.
async function sertLeBundleCourant() {
    let attendu;
    try {
        attendu = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
    } catch {
        return { ok: false, raison: 'dist/index.html est introuvable' };
    }
    try {
        const rep = await fetch(`http://localhost:${PORT}/index.html`, { cache: 'no-store' });
        if (!rep.ok) return { ok: false, raison: `le serveur répond ${rep.status}` };
        if ((await rep.text()).trim() !== attendu.trim()) {
            return { ok: false, raison: 'le serveur sert un autre bundle que dist/' };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, raison: `aucune réponse sur le port ${PORT} (${e.code || e.message})` };
    }
}

const alreadyServing = await portBusy(PORT);

console.log('→ Construction du bundle de production…');
const build = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true });
if (build.status !== 0) {
    console.error('\n✗ Build en échec : le serveur garde l\'ancien bundle, rien n\'a changé côté application.');
    process.exit(build.status ?? 1);
}

if (alreadyServing) {
    console.log(`\n→ Un serveur écoute déjà sur http://localhost:${PORT}.`);
    // Qu'il serve bien le nouveau build reste à prouver : c'est la
    // vérification finale qui tranche, pas cette sonde de port.
} else {
    console.log(`\n→ Démarrage du serveur d'aperçu sur le port ${PORT}…`);
    if (!lancerHorsJob()) {
        // Repli : mieux vaut un serveur dans le job que pas de serveur du tout.
        const child = spawn('npm run preview', {
            cwd: root,
            detached: true,
            stdio: 'ignore',
            shell: true,
            windowsHide: true
        });
        child.unref();
    }

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

const verdict = await sertLeBundleCourant();
if (!verdict.ok) {
    console.error(`\n✗ Le serveur ne sert PAS le bundle qui vient d'être construit : ${verdict.raison}.`);
    console.error('  Inutile de recharger la PWA : elle continuerait de servir son cache.');
    console.error('  Libérer le port 4173 (processus node résiduel ?) puis relancer « npm run serve ».');
    process.exit(1);
}

console.log("\n✓ Vérifié : le serveur sert bien le bundle construit à l'instant.");
console.log('\nDans la fenêtre TraCflux : Ctrl+R, puis clic sur « Recharger » quand le bandeau apparaît.');
