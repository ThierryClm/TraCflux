import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';
import { fitImageBox, cropFromBoxToImage, DEFAULT_CROP, DEFAULT_ZOOM } from '../utils/floatingImageBox';

// Barre d'outils zoom/rognage en tête de la fenêtre détachée : 6px de marge
// haut et bas, le contenu (~22px), et 1px de filet inférieur.
const HEADER_HEIGHT = 36;
// Battement en bas et à droite. La boîte est mise à l'échelle par une
// transformation : à 120 % sa taille de mise en page tombe volontiers sur une
// fraction de pixel, et une demi-décimale suffit à déclencher un ascenseur —
// qui vole alors 17px à l'autre axe et en déclenche un second.
const SAFETY_PX = 6;
// Estimation du chrome du navigateur (barre de titre + barre d'adresse),
// corrigée après ouverture via contentSize. La marge latérale couvre le cas où
// le navigateur refuserait le redimensionnement.
const CHROME_GUESS_H = 80;
const CHROME_GUESS_W = 16;

/**
 * Gère l'état de l'image du carrefour flottante :
 * visibilité, recadrage, zoom, dimensions naturelles et popup détachée.
 *
 * @param {string|null} intersectionImage - Data URL de l'image courante
 * @param {string} [intersectionName] - Nom du carrefour, repris dans le titre du popup
 * @param {string} [activePFName] - Nom du PF actif, repris dans le titre du popup
 */
const useFloatingImage = (intersectionImage, intersectionName = '', activePFName = '') => {
    const [showFloatingImage, setShowFloatingImage] = useState(() => {
        const saved = localStorage.getItem('floating_image_visible');
        return saved === 'true';
    });

    // Recadrage et zoom appartiennent au projet (ils sont sérialisés dans le
    // .json et restaurés à l'ouverture), pas aux préférences du navigateur.
    // Les lire dans localStorage faisait hériter un nouveau projet du cadrage
    // du précédent : les curseurs n'étaient jamais à zéro au premier
    // détachement. Le rognage redevient une action volontaire, par projet.
    const [floatingCrop, setFloatingCrop] = useState({ ...DEFAULT_CROP });

    const [showCropControls, setShowCropControls] = useState(false);

    const [floatingZoom, setFloatingZoom] = useState(DEFAULT_ZOOM);

    const [imageNaturalDims, setImageNaturalDims] = useState({ width: 1, height: 1 });

    // Rognage hérité d'un projet antérieur au retrait automatique des bandes :
    // il est encore compté depuis le bord de la boîte. La conversion réclame
    // les dimensions natives de l'image, qui arrivent en asynchrone — elle est
    // donc différée jusqu'à leur décodage.
    const [legacyCropPending, setLegacyCropPending] = useState(false);

    useEffect(() => {
        if (!legacyCropPending) return;
        if (imageNaturalDims.width <= 1 && imageNaturalDims.height <= 1) return;
        setFloatingCrop(prev => cropFromBoxToImage(prev, imageNaturalDims));
        setLegacyCropPending(false);
    }, [legacyCropPending, imageNaturalDims]);

    // Compute natural dimensions of intersection image (for print scaling)
    useEffect(() => {
        if (intersectionImage) {
            const img = new Image();
            img.onload = () => setImageNaturalDims({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
            img.src = intersectionImage;
        }
    }, [intersectionImage]);

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem('floating_image_visible', showFloatingImage.toString());
    }, [showFloatingImage]);

    // Titre dynamique : « <Carrefour> — <PF> » selon ce qui est disponible.
    const trimmedName = (intersectionName || '').trim();
    const trimmedPF = (activePFName || '').trim();
    const popupTitle = trimmedName && trimmedPF
        ? `${trimmedName} — ${trimmedPF}`
        : (trimmedName || 'Carrefour');

    // La fenêtre se cale sur le cadre utile (l'image inscrite dans la boîte de
    // référence), bandes vides exclues : sinon elle s'ouvrait au gabarit
    // 750×530 quel que soit le format de la photo, très au-delà de l'image.
    const { dispW, dispH } = fitImageBox(imageNaturalDims);
    const contentWidth = Math.ceil(Math.max(1, dispW - floatingCrop.left - floatingCrop.right) * floatingZoom) + SAFETY_PX;
    const contentHeight = Math.ceil(Math.max(1, dispH - floatingCrop.top - floatingCrop.bottom) * floatingZoom) + HEADER_HEIGHT + SAFETY_PX;

    // Popup window for floating image
    const floatingImagePopup = usePopupWindow({
        geometryKey: 'image',
        isOpen: showFloatingImage && !!intersectionImage,
        onClose: () => setShowFloatingImage(false),
        title: popupTitle,
        width: contentWidth + CHROME_GUESS_W,
        height: contentHeight + CHROME_GUESS_H,
        // Le gabarit passé à window.open est une estimation : la hauteur réelle
        // du chrome du navigateur varie. On la corrige à l'ouverture pour que
        // la zone utile tienne pile — c'est ce qui faisait apparaître des
        // ascenseurs sur une fenêtre pourtant plus grande que l'image.
        //
        // Recadrage en cours : on suspend l'ajustement. Les curseurs sont DANS
        // la fenêtre ; la voir se redimensionner sous le pointeur pendant qu'on
        // tire un curseur casserait le geste. Elle se recale à la fermeture du
        // panneau de rognage.
        contentSize: showCropControls ? null : { width: contentWidth, height: contentHeight }
    });

    return {
        showFloatingImage, setShowFloatingImage,
        floatingCrop, setFloatingCrop,
        markLegacyCrop: setLegacyCropPending,
        showCropControls, setShowCropControls,
        floatingZoom, setFloatingZoom,
        imageNaturalDims,
        floatingImagePopup
    };
};

export default useFloatingImage;
