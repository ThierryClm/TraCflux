/**
 * URL du projet exemple, versionnée par le build courant.
 *
 * Les previews Surge réutilisent volontairement la même URL. Chrome et Edge
 * peuvent donc conserver des versions différentes du JSON d'exemple dans leur
 * cache HTTP, indépendamment du service worker. Le paramètre de build évite
 * qu'un navigateur recharge les anciens réglages de cadrage.
 */
export const getExampleProjectAssetUrl = (
    pageUrl = window.location.href,
    buildDate = typeof __BUILD_DATE__ === 'undefined' ? Date.now().toString() : __BUILD_DATE__
) => {
    const url = new URL('./Carrefour_Exemple.json', pageUrl);
    url.searchParams.set('build', String(buildDate));
    return url.toString();
};

export const getExampleProjectFetchOptions = () => ({ cache: 'no-store' });
