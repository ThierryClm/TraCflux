/**
 * Projet exemple (?example=carrefour) et chargements au démarrage
 * (?duplicate=…), sortis d'App.tsx tels quels.
 *
 * Deux hooks, appelés à deux endroits d'App : useModeExemple là où vivait
 * l'état du mode exemple, useChargementDemarrage là où vivaient les effets de
 * chargement. L'ordre des effets au montage reste donc celui d'avant.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { toast } from '../utils/toast';
import { isInviteVisible, noteWelcomeView, noteProjectSeen } from '../utils/welcomeInvite';
import { isExampleSession, exitExampleSession } from '../utils/exampleMode';
import { CROP_BASIS, DEFAULT_CROP, DEFAULT_ZOOM } from '../utils/floatingImageBox';
import type { FloatingCrop } from './useFloatingImage';
import type { EtatProjet } from './useTrafficLight';

type ChargerEtat = (state: EtatProjet) => unknown;

/** État du mode exemple et chargement de projet qui le quitte. */
export const useModeExemple = (loadFullStateRaw: ChargerEtat) => {
    // Invitation « projet exemple » sur l'écran d'accueil : visible tant que
    // l'utilisateur est un nouvel arrivant (cf. utils/welcomeInvite).
    // Figée au montage pour que la décision ne change pas en cours de rendu.
    const [showExampleInvite] = useState(() => isInviteVisible('diagram'));
    // Projet exemple : modifiable mais non enregistrable (cf. utils/exampleMode).
    const [isExample, setIsExample] = useState(() => isExampleSession());
    const leaveExampleMode = useCallback(() => {
        if (isExampleSession()) { exitExampleSession(); setIsExample(false); }
    }, []);
    // Tout chargement de VRAI projet (Ouvrir, Restaurer, Dupliquer, import…)
    // passe par ce wrapper et quitte le mode exemple. Seul l'effet de
    // chargement de l'exemple appelle loadFullStateRaw et reste en mode
    // exemple.
    const loadFullState = useCallback((state: EtatProjet) => {
        leaveExampleMode();
        return loadFullStateRaw(state);
    }, [loadFullStateRaw, leaveExampleMode]);

    return { showExampleInvite, isExample, leaveExampleMode, loadFullState };
};

export interface ChargementDemarrageOptions {
    loadFullState: ChargerEtat;
    loadFullStateRaw: ChargerEtat;
    setProjectModified: Dispatch<SetStateAction<boolean>>;
    projectModifiedSkip: MutableRefObject<boolean>;
    setHasUnsavedChanges: (value: boolean) => void;
    setFloatingCrop: Dispatch<SetStateAction<FloatingCrop>>;
    setFloatingZoom: Dispatch<SetStateAction<number>>;
    markLegacyCrop: (value: boolean) => void;
    hasActiveProject: boolean;
    setHasActiveProject: Dispatch<SetStateAction<boolean>>;
}

/**
 * Effets de montage : projet dupliqué, projet exemple, et comptage de
 * l'invitation « projet exemple » de l'écran d'accueil.
 */
export const useChargementDemarrage = ({
    loadFullState, loadFullStateRaw,
    setProjectModified, projectModifiedSkip, setHasUnsavedChanges,
    setFloatingCrop, setFloatingZoom, markLegacyCrop,
    hasActiveProject, setHasActiveProject,
}: ChargementDemarrageOptions) => {
    const welcomeViewNoted = useRef(false);
    const projectSeenNoted = useRef(false);

    // Check for duplicated state on load
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const duplicateId = urlParams.get('duplicate');
        if (duplicateId) {
            const savedState = sessionStorage.getItem(`duplicate_${duplicateId}`);
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    loadFullState(state);
                    // Clean up
                    sessionStorage.removeItem(`duplicate_${duplicateId}`);
                    // Remove the URL parameter
                    window.history.replaceState({}, '', window.location.pathname);
                } catch (e) {
                    console.error('Failed to load duplicated state', e);
                }
            }
        }
    }, []);

    // Chargement du projet exemple fourni (?example=carrefour). Ouvert dans
    // une fenêtre neuve (depuis l'écran d'accueil ou la FAQ) : pas de projet
    // courant à écraser, donc pas de garde-fou « modifications non sauvées ».
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('example') !== 'carrefour') return;
        (async () => {
            try {
                const res = await fetch('./Carrefour_Exemple.json');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                // loadFullStateRaw (et non le wrapper) : on RESTE en mode
                // exemple — la sauvegarde et le localStorage restent inhibés.
                loadFullStateRaw({
                    projectName: data.projectName || data.intersectionName || 'Carrefour exemple',
                    ...data
                });
                // L'exemple tout juste ouvert n'a aucune modification : même
                // remise à zéro que la réouverture depuis le cache (cf.
                // openSavedProject). Sans elle, l'installation de ses données
                // comptait comme une modification et l'astérisque apparaissait.
                setProjectModified(true);
                // Référence tenue par useProjectModification, transmise exprès.
                // oxlint-disable-next-line react/immutability
                projectModifiedSkip.current = false;
                setHasUnsavedChanges(false);
                setFloatingCrop(data.floatingCrop !== undefined ? data.floatingCrop : { ...DEFAULT_CROP });
                setFloatingZoom(data.floatingZoom !== undefined ? data.floatingZoom : DEFAULT_ZOOM);
                markLegacyCrop(data.floatingCrop !== undefined && data.floatingCropBasis !== CROP_BASIS);
                setHasActiveProject?.(true);
                // Retire le paramètre de l'URL (rafraîchir ne recharge pas l'exemple).
                window.history.replaceState({}, '', window.location.pathname);
                toast.info('Projet exemple chargé — modifiable pour explorer, mais non enregistrable.');
            } catch (e) {
                console.error('Échec du chargement du projet exemple', e);
                toast.error('Impossible de charger le projet exemple.');
            }
        })();
    }, []);

    // Comptage pour l'auto-effacement de l'invitation « projet exemple ».
    // Vue d'accueil : seulement si aucun projet n'est auto-chargé (ni
    // ?example, ni ?duplicate) — sinon ce n'est pas une vraie visite d'accueil.
    useEffect(() => {
        if (welcomeViewNoted.current) return;
        const p = new URLSearchParams(window.location.search);
        if (p.has('example') || p.has('duplicate')) return;
        welcomeViewNoted.current = true;
        noteWelcomeView('diagram');
    }, []);

    // Projet vu : à la première activation d'un projet dans ce montage
    // (ouvrir, nouveau, restaurer, exemple…). L'exemple compte volontairement.
    useEffect(() => {
        if (hasActiveProject && !projectSeenNoted.current) {
            projectSeenNoted.current = true;
            noteProjectSeen('diagram');
        }
    }, [hasActiveProject]);
};
