import { render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useFloatingImageRenderer from './useFloatingImageRenderer';

const GROUPES = [
    { id: 1, name: 'Nord', courant: 'TàG', signal: 'R11j', offset: 0, durations: { green: 30, orange: 3, red: 27 } },
    { id: 2, name: 'Sud', courant: 'TD', offset: 30, durations: { green: 20, orange: 3, red: 37 } }
];

/** Contenu que le hook envoie à la fenêtre détachée, rendu dans la page. */
const contenuDetache = ({ showSignals, ...options }) => {
    const renderToPopup = vi.fn();
    renderHook(() => useFloatingImageRenderer({
        showFloatingImage: true,
        intersectionImage: 'data:image/png;base64,AA==',
        floatingCrop: { top: 0, bottom: 0, left: 0, right: 0 },
        setFloatingCrop: vi.fn(),
        floatingZoom: 1,
        setFloatingZoom: vi.fn(),
        showCropControls: false,
        setShowCropControls: vi.fn(),
        intersectionArrows: [
            { id: 1, groupId: 1, x: 20, y: 20, rotation: 90, scale: 2 },
            { id: 2, groupId: 2, x: 60, y: 60, rotation: 45 }
        ],
        groups: GROUPES,
        imageNaturalDims: { width: 750, height: 530 },
        selectedActions: [],
        conflictMatrix: [],
        hoveredArrowGroupId: null,
        isPlayingSimulation: false,
        simulationCurrentTime: 0,
        actionData: [],
        cycleLength: 60,
        imageBrightness: 100,
        imageContrast: 100,
        intersectionDisplay: { showGroupNumbers: true, showGroupNames: true, showArrows: false, showSignals },
        floatingImagePopup: { renderToPopup },
        ...options
    }));
    return render(renderToPopup.mock.lastCall[0]).container;
};

describe('useFloatingImageRenderer — case Signal', () => {
    it('garde les flèches si la case est décochée', () => {
        expect(contenuDetache({ showSignals: false }).querySelector('[role="img"]')).toBeNull();
    });

    it('montre le signal du groupe renseigné, à l’endroit, et garde la flèche des autres', () => {
        const fenetre = contenuDetache({ showSignals: true });
        const [avecSignal, sansSignal] = fenetre.querySelectorAll('.floating-arrow-marker');
        expect(avecSignal.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Signal R11j');
        expect(avecSignal.querySelector('.arrow-symbol').style.transform).toBe('scale(1)');
        expect(sansSignal.querySelector('[role="img"]')).toBeNull();
        expect(sansSignal.querySelector('.arrow-symbol').style.transform).toContain('rotate(45deg)');
    });

    it('masque les noms des groupes tant que la case est cochée', () => {
        expect(contenuDetache({ showSignals: true }).querySelector('.arrow-label')).toBeNull();
        expect(contenuDetache({ showSignals: false }).querySelector('.arrow-label')).not.toBeNull();
    });

    it('ignore la case si aucun groupe n’a de signal', () => {
        const groups = GROUPES.map(g => ({ ...g, signal: '' }));
        const fenetre = contenuDetache({ showSignals: true, groups });
        expect(fenetre.querySelector('[role="img"]')).toBeNull();
        expect(fenetre.querySelector('.arrow-label')).not.toBeNull();
    });

    it('fait clignoter le jaune pendant la lecture, et seulement alors', () => {
        const disque = fenetre => fenetre.querySelector('[role="img"]').innerHTML;
        expect(disque(contenuDetache({ showSignals: true, simulationCurrentTime: 5 }))).toContain('rgb(255, 255, 0)');
        expect(disque(contenuDetache({ showSignals: true, simulationCurrentTime: 5, isPlayingSimulation: true }))).toContain('rgb(120, 120, 120)');
    });
});
