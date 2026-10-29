import { useCallback, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';
import HelpContentDiffere from '../components/HelpContentDiffere';
import { ECRAN_MOBILE } from '../utils/ecranMobile';

const chargerAide = () => import('../components/HelpContent');

/**
 * Aide en ligne dans une fenêtre détachée, non modale et déplaçable sur un
 * autre écran comme les autres panneaux : on la consulte en travaillant.
 * Dans la page sur un téléphone, qui n'a qu'un écran, ou si le navigateur
 * bloque la fenêtre.
 */
const useAideDetachee = (helpModal: boolean, setHelpModal: (ouverte: boolean) => void, helpAnchor: string | null,
    /** Case « Page principale » de Mise en page → Infobulles. */
    tooltipsEnabled = true) => {
    const aideDansLaPage = !!window.matchMedia?.(ECRAN_MOBILE).matches;
    const aidePopup = usePopupWindow({
        geometryKey: 'aide',
        isOpen: helpModal && !aideDansLaPage,
        onClose: () => setHelpModal(false),
        title: 'Aide - TraCflux',
        width: 960,
        height: 820
    });

    const { renderToPopup, retryOpen } = aidePopup;
    useEffect(() => {
        if (!helpModal || aideDansLaPage) return;
        renderToPopup(
            <div className="modal-content modal-wide aide-detachee">
                <div className="modal-body">
                    <HelpContentDiffere initialAnchor={helpAnchor} tooltipsEnabled={tooltipsEnabled} />
                </div>
            </div>
        );
    }, [helpModal, aideDansLaPage, helpAnchor, tooltipsEnabled, renderToPopup]);

    // Le module de l'aide (et sa feuille de style) est chargé avant d'ouvrir
    // la fenêtre, qui recopie les styles de l'application à son ouverture.
    // Redemander l'aide déjà ouverte la ramène au premier plan.
    const ouvrirAide = useCallback(() => {
        void chargerAide().finally(() => {
            if (helpModal && !aideDansLaPage) retryOpen();
            else setHelpModal(true);
        });
    }, [helpModal, aideDansLaPage, retryOpen, setHelpModal]);

    return { ouvrirAide, aideEnModale: helpModal && (aideDansLaPage || aidePopup.bloquee) };
};

export default useAideDetachee;
