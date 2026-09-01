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

/**
 * Taille de base d'un symbole de flèche dans la boîte de référence, en pixels
 * (cf. `.floating-arrow-marker .arrow-symbol svg` dans IntersectionImage.css).
 * Le symbole est CENTRÉ sur le point de la flèche : il en déborde de moitié
 * dans chaque direction.
 */
export const ARROW_SIZE = 96;

/**
 * Cadre utile de la fenêtre détachée : l'image ET ce qui est dessiné dessus.
 *
 * Le cadre s'arrêtait au bord de l'image. Or une flèche posée tout près de ce
 * bord déborde sur la bande vide voisine — le panneau intégré l'y montre, la
 * bande faisant partie de sa boîte. La fenêtre détachée, qui retire les bandes
 * et découpe au cadre, la tronquait alors : sur une image très large, avec plus
 * de cent pixels de bande en haut et en bas, un courant placé en lisière
 * disparaissait purement et simplement, sans rognage ni zoom en cause.
 *
 * Le cadre englobe donc désormais les symboles. Il reste borné par la boîte de
 * référence : au pire, on retrouve le comportement d'avant le retrait des
 * bandes, jamais davantage.
 *
 * Le débordement est majoré sans tenir compte de la rotation — un symbole
 * pivoté déborde dans une autre direction, pas plus loin.
 *
 * @param {{width: number, height: number}} naturalDims - Dimensions natives de l'image
 * @param {Array} arrows - Flèches du carrefour (x, y en % de la boîte)
 * @returns {{x: number, y: number, w: number, h: number}} Cadre dans la boîte de référence
 */
export const fitContentBox = (naturalDims, arrows = []) => {
    const { dispW, dispH, padX, padY } = fitImageBox(naturalDims);
    let gauche = padX;
    let haut = padY;
    let droite = padX + dispW;
    let bas = padY + dispH;

    (Array.isArray(arrows) ? arrows : []).forEach(a => {
        if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return;
        // Les flèches piétonnes et cyclistes s'allongent, les tourne-à-droite et
        // à-gauche ajoutent leur retour : on retient l'allongement le plus grand.
        const allongement = Math.max(1, a.length || 1, a.turnLength || 1);
        const demi = (ARROW_SIZE * (a.scale || 1) * allongement) / 2;
        const cx = (a.x / 100) * BOX_W;
        const cy = (a.y / 100) * BOX_H;
        gauche = Math.min(gauche, cx - demi);
        droite = Math.max(droite, cx + demi);
        haut = Math.min(haut, cy - demi);
        bas = Math.max(bas, cy + demi);
    });

    const x = Math.max(0, Math.floor(gauche));
    const y = Math.max(0, Math.floor(haut));
    return {
        x,
        y,
        w: Math.max(1, Math.min(BOX_W, Math.ceil(droite)) - x),
        h: Math.max(1, Math.min(BOX_H, Math.ceil(bas)) - y)
    };
};
