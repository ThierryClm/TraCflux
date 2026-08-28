/**
 * Placement des fenêtres détachées : éviter qu'une fenêtre en escamote une autre.
 *
 * Centrer toutes les fenêtres sur l'écran ne les fait pas tomber au même
 * endroit — leurs tailles diffèrent — mais la plus petite peut se retrouver
 * ENTIÈREMENT contenue dans la plus grande, donc invisible sans que rien ne
 * dépasse pour la trahir.
 *
 * Cas rencontré le 2026-08-28 : sur un écran 1920 × 1080, « Variables micro »
 * (510 × 320) se centre en 705→1215 × 380→700, « Conditions micro » (1220 × 420)
 * en 350→1570 × 330→750. Les coins ne coïncident nullement, et pourtant la
 * première disparaît sous la seconde. C'est donc la PART RECOUVERTE qu'il faut
 * mesurer, jamais la coïncidence des positions.
 */

/** Pas de la cascade, en pixels. */
export const PAS_CASCADE = 40;

/** Au-delà de cette part recouverte, la fenêtre est jugée escamotée. */
export const RECOUVREMENT_MAX = 0.5;

/** Nombre maximal de décalages avant d'abandonner. */
const ESSAIS_MAX = 14;

/** Écart au coin de l'écran lorsque la cascade reboucle. */
const MARGE_REBOUCLAGE = 24;

/**
 * Part de `rect` recouverte par `autre`, entre 0 et 1.
 *
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @param {{x: number, y: number, w: number, h: number}} autre
 * @returns {number}
 */
export const partRecouverte = (rect, autre) => {
    if (!rect || !autre || rect.w <= 0 || rect.h <= 0) return 0;
    const ix = Math.min(rect.x + rect.w, autre.x + autre.w) - Math.max(rect.x, autre.x);
    const iy = Math.min(rect.y + rect.h, autre.y + autre.h) - Math.max(rect.y, autre.y);
    if (ix <= 0 || iy <= 0) return 0;
    return (ix * iy) / (rect.w * rect.h);
};

/**
 * Décale `rect` en cascade tant qu'une fenêtre déjà placée l'escamote.
 *
 * La cascade s'arrête dès qu'il n'y a plus assez de place vers le bas à
 * droite : mieux vaut une fenêtre partiellement couverte qu'une fenêtre
 * poussée hors de l'écran, où elle serait tout aussi perdue.
 *
 * @param {{x: number, y: number, w: number, h: number}} rect - Place visée
 * @param {Array<{x: number, y: number, w: number, h: number}>} occupes - Fenêtres déjà placées
 * @param {{left: number, top: number, width: number, height: number}} bornes - Zone utile de l'écran
 * @returns {{x: number, y: number}} Place retenue
 */
export const placerSansEscamotage = (rect, occupes = [], bornes = null) => {
    const pertinents = (occupes || []).filter(o => o && o.w > 0 && o.h > 0);
    if (pertinents.length === 0) return { x: rect.x, y: rect.y };

    // Pire recouvrement subi à une position donnée.
    const score = (x, y) => pertinents.reduce(
        (max, o) => Math.max(max, partRecouverte({ x, y, w: rect.w, h: rect.h }, o)),
        0
    );

    // On retient la MEILLEURE position rencontrée plutôt que de raisonner par
    // cas de sortie : si aucune place ne descend sous le seuil, on rend la
    // moins mauvaise, et jamais une position gratuitement déplacée.
    let x = rect.x;
    let y = rect.y;
    let meilleur = { x, y, score: score(x, y) };
    let reboucle = false;

    for (let essai = 0; essai < ESSAIS_MAX && meilleur.score > RECOUVREMENT_MAX; essai++) {
        const deborde = bornes && (
            x + PAS_CASCADE + rect.w > bornes.left + bornes.width ||
            y + PAS_CASCADE + rect.h > bornes.top + bornes.height
        );

        if (deborde) {
            // La diagonale a atteint le bord. On reboucle une fois vers le coin
            // haut-gauche, comme le fait un gestionnaire de fenêtres, avant de
            // renoncer.
            if (reboucle) break;
            reboucle = true;
            x = bornes.left + MARGE_REBOUCLAGE;
            y = bornes.top + MARGE_REBOUCLAGE;
        } else {
            x += PAS_CASCADE;
            y += PAS_CASCADE;
        }

        const s = score(x, y);
        if (s < meilleur.score) meilleur = { x, y, score: s };
    }

    return { x: meilleur.x, y: meilleur.y };
};
