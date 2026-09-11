/**
 * Clarté du fond d'un plan de carrefour.
 *
 * Le halo de survol des flèches ne peut pas avoir une couleur unique : un halo
 * blanc disparaît sur un plan de bureau d'études (trait noir sur fond blanc),
 * un halo coloré est moins franc sur une photo aérienne sombre. Le critère
 * utile n'est pas « est-ce une photo » — une photo de jour peut être très
 * claire — mais la luminance moyenne de l'image.
 */

/**
 * Au-dessus de ce seuil, le fond est considéré comme clair.
 *
 * Les deux familles sont très séparées en pratique : un plan au trait tourne
 * autour de 240, une vue aérienne entre 90 et 150. Le seuil est posé dans le
 * creux entre les deux, loin de l'une comme de l'autre.
 */
export const SEUIL_FOND_CLAIR = 170;

/**
 * Luminance moyenne d'un tableau de pixels RGBA, sur l'échelle 0–255.
 *
 * Pondération Rec. 601 : l'œil ne reçoit pas les trois canaux à parité, et une
 * moyenne arithmétique jugerait trop clair un plan à dominante bleue.
 * Les pixels transparents sont ignorés : une image à fond alpha se lirait
 * sinon comme un fond noir, alors qu'elle s'affiche sur le fond de la page.
 */
export const luminanceMoyenne = (pixels) => {
    let somme = 0;
    let comptes = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha === 0) continue;
        somme += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        comptes += 1;
    }
    if (comptes === 0) return SEUIL_FOND_CLAIR + 1; // tout transparent : on traite en fond clair
    return somme / comptes;
};

export const fondEstClair = (luminance) => luminance >= SEUIL_FOND_CLAIR;

/**
 * Mesure une image déjà décodée en la réduisant à `taille` × `taille`.
 *
 * La réduction fait le moyennage à notre place, et borne le coût quelle que
 * soit la définition de l'original. En cas d'échec — canvas indisponible, ou
 * image d'une autre origine qui souille le canvas — on rend `true` : le fond
 * clair est le cas courant, et son halo coloré reste visible sur fond sombre,
 * alors que l'inverse serait invisible.
 */
export const mesurerFondClair = (img, taille = 32) => {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = taille;
        canvas.height = taille;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return true;
        ctx.drawImage(img, 0, 0, taille, taille);
        return fondEstClair(luminanceMoyenne(ctx.getImageData(0, 0, taille, taille).data));
    } catch {
        return true;
    }
};
