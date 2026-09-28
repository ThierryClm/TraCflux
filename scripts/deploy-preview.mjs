import { execFileSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function currentBranch() {
  const branch = process.env.GITHUB_HEAD_REF
    || execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' });

  return branch.trim();
}

function previewSlug(branch) {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

const branch = currentBranch();

if (!branch) {
  throw new Error('Impossible de déterminer la branche Git courante.');
}

if (branch === 'master' || branch === 'main') {
  throw new Error(`Déploiement de preview refusé depuis la branche protégée « ${branch} ».`);
}

if (!process.env.SURGE_LOGIN || !process.env.SURGE_TOKEN) {
  throw new Error('SURGE_LOGIN et SURGE_TOKEN doivent être configurées pour déployer une preview.');
}

const slug = previewSlug(branch);

if (!slug) {
  throw new Error(`La branche « ${branch} » ne permet pas de produire un nom de preview valide.`);
}

const domain = (process.env.TRACFLUX_PREVIEW_DOMAIN || `tracflux-${slug}.surge.sh`).trim();

if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.surge\.sh$/.test(domain)) {
  throw new Error(`Domaine Surge invalide : « ${domain} ».`);
}

console.log(`Construction de la preview pour ${branch}…`);
execFileSync(npmCommand, ['run', 'build'], { stdio: 'inherit' });

console.log(`Déploiement sur https://${domain}…`);
execFileSync(
  npxCommand,
  ['--yes', '--package=surge@0.44.3', 'surge', 'dist', domain],
  { stdio: 'inherit' },
);

console.log(`PREVIEW_URL=https://${domain}`);
