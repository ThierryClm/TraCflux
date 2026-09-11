/**
 * URL du logo TraCflux, résolue une fois contre la page de l'application.
 *
 * Le reste du code écrit `./logo.svg`, ce qui convient tant qu'on reste dans
 * la fenêtre principale. Les fenêtres détachées sont ouvertes par
 * `window.open('')`, donc sur `about:blank` : un chemin relatif n'y a pas de
 * base propre et ne peut pas être garanti. On résout donc ici, dans la fenêtre
 * qui a une vraie URL, et on transporte le résultat absolu.
 *
 * Le repli couvre les environnements sans DOM (tests unitaires).
 */
export const LOGO_APP = typeof document !== 'undefined' && document.baseURI
    ? new URL('logo.svg', document.baseURI).href
    : './logo.svg';
