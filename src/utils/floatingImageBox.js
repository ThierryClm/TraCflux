/**
 * Géométrie partagée de l'image du carrefour détachée.
 *
 * Les flèches sont positionnées en pourcentage d'une boîte de référence fixe
 * de 750×530 (le même cadre que le panneau intégré, .intersection-image-area).
 * L'image y est inscrite en « contain » : selon son format, des bandes vides
 * l'encadrent. Ces bandes n'ont pas de sens dans une fenêtre dédiée — elles
 * l'agrandissent inutilement — d'où ce calcul du cadre utile, réutilisé pour
 * dimensionner la fenêtre ET pour la décaler au rendu.
 */
export const BOX_W = 750;
export const BOX_H = 530;

/**
 * Référentiel du rognage enregistré dans un projet.
 *
 * Historiquement le rognage se comptait depuis le bord de la boîte 750×530 :
 * il fallait donc « dépenser » les bandes vides avant d'entamer l'image, et un
 * projet enregistrait souvent un rognage qui ne faisait que masquer ces bandes.
 * Depuis, les bandes sont retirées d'office et le rognage se compte depuis le
 * bord de l'IMAGE. Ce repère distingue les deux référentiels : sans lui, un
 * projet ancien rognerait une deuxième fois, en pleine image cette fois.
 */
export const CROP_BASIS = 'image';

/**
 * Convertit un rognage exprimé depuis le bord de la boîte vers un rognage
 * exprimé depuis le bord de l'image : on lui retire les bandes vides.
 */
export const cropFromBoxToImage = (crop, naturalDims) => {
    const { padX, padY } = fitImageBox(naturalDims);
    return {
        top: Math.max(0, (crop?.top || 0) - padY),
        bottom: Math.max(0, (crop?.bottom || 0) - padY),
        left: Math.max(0, (crop?.left || 0) - padX),
        right: Math.max(0, (crop?.right || 0) - padX)
    };
};

/** Cadrage neutre : tout projet démarre sans rognage ni zoom. */
export const DEFAULT_CROP = { top: 0, bottom: 0, left: 0, right: 0 };
export const DEFAULT_ZOOM = 1;

/**
 * Cadre utile de l'image dans la boîte de référence.
 *
 * @param {{width: number, height: number}} naturalDims - Dimensions natives de l'image
 * @returns {{dispW: number, dispH: number, padX: number, padY: number}}
 *          Taille affichée et bandes vides (gauche/droite, haut/bas)
 */
export const fitImageBox = (naturalDims) => {
    const natW = naturalDims?.width || 1;
    const natH = naturalDims?.height || 1;
    // Dimensions natives pas encore chargées (l'image se décode en asynchrone,
    // parfois après l'ouverture de la fenêtre) : on reste sur la boîte pleine,
    // puis le cadre se resserre dès que les vraies dimensions arrivent.
    if (natW <= 1 && natH <= 1) {
        return { dispW: BOX_W, dispH: BOX_H, padX: 0, padY: 0 };
    }
    const fit = Math.min(BOX_W / natW, BOX_H / natH);
    const dispW = Math.max(1, Math.round(natW * fit));
    const dispH = Math.max(1, Math.round(natH * fit));
    return {
        dispW,
        dispH,
        padX: Math.round((BOX_W - dispW) / 2),
        padY: Math.round((BOX_H - dispH) / 2)
    };
};
