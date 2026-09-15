import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup de la matrice flottante.
 */
const useFloatingMatrix = (groupCount, activePFName = '', verrouillee = false) => {
    const [showFloatingMatrix, setShowFloatingMatrix] = useState(() => {
        return localStorage.getItem('floating_matrix_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_matrix_visible', showFloatingMatrix.toString());
    }, [showFloatingMatrix]);

    // Le bandeau de la fenêtre porte désormais ce que l'en-tête en page
    // affichait : le nom complet, le plan de feu, et le verrou. L'en-tête a
    // disparu de la fenêtre détachée, il ne disait rien de plus.
    const pf = (activePFName || '').trim();
    const contexte = [pf, verrouillee ? 'Verrouillé' : ''].filter(Boolean).join(' · ');
    const popupTitle = contexte ? `Matrice intervert — ${contexte}` : 'Matrice intervert';

    const matrixPopup = usePopupWindow({
        geometryKey: 'matrix',
        isOpen: showFloatingMatrix,
        onClose: () => setShowFloatingMatrix(false),
        title: popupTitle,
        width: Math.min(620, -10 + groupCount * 42),
        height: Math.min(520, -10 + groupCount * 42)
    });

    return {
        showFloatingMatrix,
        setShowFloatingMatrix,
        matrixPopup
    };
};

export default useFloatingMatrix;
