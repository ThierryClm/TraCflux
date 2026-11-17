import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/** Gère l'état et la fenêtre popup du tableau des Détecteurs détaché. */
const useFloatingDetecteurs = (activePFName = '') => {
    const [showFloatingDetecteurs, setShowFloatingDetecteurs] = useState(() => {
        return localStorage.getItem('floating_detecteurs_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_detecteurs_visible', showFloatingDetecteurs.toString());
    }, [showFloatingDetecteurs]);

    const pf = activePFName.trim();
    const popupTitle = pf ? `Détecteurs — ${pf}` : 'Détecteurs';

    const detecteursPopup = usePopupWindow({
        geometryKey: 'detecteurs',
        sectionVerrou: 'detecteurs',
        isOpen: showFloatingDetecteurs,
        onClose: () => setShowFloatingDetecteurs(false),
        title: popupTitle,
        width: 760,
        height: 480
    });

    return { showFloatingDetecteurs, setShowFloatingDetecteurs, detecteursPopup };
};

export default useFloatingDetecteurs;
