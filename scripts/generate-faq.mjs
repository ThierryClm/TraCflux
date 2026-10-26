// La FAQ publiée et la FAQ GitHub partagent une seule source.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { marked } from 'marked';

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const slug = text => text.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s/g, '-');
const headings = [];
const renderer = new marked.Renderer();
renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const id = slug(tokens.map(token => token.text ?? token.raw).join(''));
    if (depth === 2) headings.push({ id, text });
    const alias = id.replace(/-+$/, '');
    return `<h${depth} id="${escape(id)}">${alias !== id ? `<span id="${escape(alias)}"></span>` : ''}${text}</h${depth}>\n`;
};
for (const [source, destination, title, canonical] of [
    ['FAQ.md', '../public/faq/index.html', 'Questions fréquentes', 'faq/'],
    ['README.md', '../public/presentation/details.html', 'Présentation détaillée', 'presentation/details.html'],
]) {
headings.length = 0;
let content = marked.parse(readFileSync(new URL('../' + source, import.meta.url), 'utf8'), { renderer });
// Les liens de documents restent locaux ; seuls le code et les contributions vont sur GitHub.
content = content.replace(/href="README\.md([^\"]*)"/g, 'href="../presentation/details.html$1"')
    .replace(/src="docs\/screenshots\/diagramme-principal.png"/g, 'src="../presentation/diagramme-de-feux.jpg"')
    .replace(/src="docs\/screenshots\/Onde-verte.png"/g, 'src="../presentation/onde-verte.jpg"')
    .replace(/src="docs\/logo.svg"/g, 'src="../logo.svg"')
    .replace(/href="public\//g, 'href="../')
    .replace(/href="LICENSE"/g, 'href="https://github.com/ThierryClm/TraCflux/blob/master/LICENSE"')
    .replace(/href="FAQ\.md([^\"]*)"/g, 'href="../faq/$1"')
    .replace(/href="((?:SECURITY|CONTRIBUTING|VERSIONING)\.md)([^\"]*)"/g,
        'href="https://github.com/ThierryClm/TraCflux/blob/master/$1$2"');
content = content.replace(/href="(?!https?:|#|\.\.\/)([^"]+)"/g,
    (_, path) => `href="https://github.com/ThierryClm/TraCflux/${path.endsWith('/') ? 'tree' : 'blob'}/master/${path}"`);
const nav = headings.map(({ id, text }) => `<li><a href="#${escape(id)}">${text}</a></li>`).join('');
mkdirSync(new URL('../public/faq/', import.meta.url), { recursive: true });
writeFileSync(new URL(destination, import.meta.url), `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — TraCflux</title>
<meta name="description" content="Les réponses à vos questions sur TraCflux : premiers pas, fichiers, confidentialité, simulation et utilisation des plans de feux.">
<link rel="canonical" href="https://tracflux.com/${canonical}"><link rel="icon" href="../icon.svg">
<meta property="og:title" content="${title} — TraCflux"><meta property="og:description" content="Retrouvez les réponses à vos questions sur TraCflux, librement et sans compte."><meta property="og:type" content="website"><meta property="og:url" content="https://tracflux.com/${canonical}"><meta property="og:image" content="https://tracflux.com/social-preview.png">
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#1e1e1e;color:#e6e6e6;font:17px/1.7 system-ui,sans-serif}header,main,footer{max-width:960px;margin:auto;padding:24px}nav{display:flex;gap:20px;flex-wrap:wrap;align-items:center}a{color:#71ddd5;text-underline-offset:3px}nav a{font-weight:600}header img{width:40px;height:40px}h1{font-size:clamp(2rem,6vw,3rem);line-height:1.2;color:#71ddd5}h2{margin-top:56px;padding-top:16px;border-top:1px solid #555}h3{margin-top:32px;line-height:1.4;color:#fff}h2,h3{scroll-margin-top:20px}p,li{overflow-wrap:anywhere}table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse}th,td{padding:10px;border:1px solid #666;text-align:left}pre{overflow-x:auto;padding:16px;background:#292929}code{font-size:.9em}img{max-width:100%;height:auto}blockquote{border-left:3px solid #71ddd5;margin-left:0;padding-left:18px}.sommaire{background:#292929;border-radius:12px;padding:20px 28px}.sommaire ul{columns:2; padding-left:20px}footer{border-top:1px solid #555;margin-top:48px}:focus-visible{outline:3px solid #ffcf66;outline-offset:4px}.skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:8px;background:#1e1e1e;padding:8px}@media(max-width:600px){header,main,footer{padding:20px}.sommaire ul{columns:1}}@media print{body{background:#fff;color:#000}a,h1,h3{color:#000}nav,.sommaire{display:none}}
</style></head><body><a class="skip" href="#contenu">Aller au contenu</a>
<header><nav aria-label="Navigation principale"><a href="../"><img src="../logo.svg" alt="TraCflux"></a><a href="../presentation/">Présentation</a><a href="../faq/">FAQ</a><a href="../?example=carrefour">Essayer TraCflux</a></nav></header>
<main id="contenu">${content.replace('</h1>', '</h1><p>Documentation en accès libre, sans compte.</p><nav class="sommaire" aria-label="Sommaire"><ul>' + nav + '</ul></nav>')}</main>
<footer><a href="../presentation/">Découvrir l’application</a> · <a href="../">Ouvrir TraCflux</a> · <a href="#contenu">Retour en haut</a></footer></body></html>`);
console.log(`${destination} généré depuis ${source}`);
}
