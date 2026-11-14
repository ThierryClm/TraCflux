import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup des données trafic flottantes.
 *
 * `rowCount` est le nombre de lignes affichées par le tableau (groupes
 * véhicules), et non le nombre total de groupes de feu : piétons et cyclistes
 * n'y figurent pas et ne doivent pas agrandir la fenêtre.
 */
const useFloatingTraffic = (rowCount: number, activePFName = '') => {
    const [showFloatingTraffic, setShowFloatingTraffic] = useState(() => {
        return localStorage.getItem('floating_traffic_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_traffic_visible', showFloatingTraffic.toString());
    }, [showFloatingTraffic]);

    const pf = activePFName.trim();
    const popupTitle = pf ? `Données trafic — ${pf}` : 'Données trafic';

    const trafficPopup = usePopupWindow({
        geometryKey: 'traffic',
        sectionVerrou: 'trafic',
        isOpen: showFloatingTraffic,
        onClose: () => setShowFloatingTraffic(false),
        title: popupTitle,
        width: 550,
        height: Math.min(580, 180 + rowCount * 32)
    });

    return { showFloatingTraffic, setShowFloatingTraffic, trafficPopup };
};

export default useFloatingTraffic;
