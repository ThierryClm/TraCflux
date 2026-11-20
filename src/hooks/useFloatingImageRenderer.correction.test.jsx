import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useFloatingImageRenderer from './useFloatingImageRenderer';
import { definirPrefsVerrou } from '../utils/verrouSaisie';

const GROUPES = [
    { id: 1, name: 'Nord', type: 'V', courant: 'TD', minGreen: 6, offset: 0, durations: { green: 30, orange: 3, red: 27 } }
];
const FLECHE = { id: 11, groupId: 1, x: 20, y: 20, rotation: 0, scale: 1 };
const DETECTEUR = {
    id: 7,
    nom: 'Boucle nord',
    categorie: 'bouclePiedFeu',
    gf: 1,
    dimension: 5,
    position: { x: 40, y: 60 },
    orientation: 0,
    note: ''
};

/** Contenu envoyé à la fenêtre détachée, rendu dans la page ; `maj` le rafraîchit. */
const contenu = (options = {}) => {
    const renderToPopup = vi.fn();
    const onArrowsChange = vi.fn();
    const onDetecteursChange = vi.fn();
    renderHook(() => useFloatingImageRenderer({
        showFloatingImage: true,
        intersectionImage: 'data:image/png;base64,AA==',
        floatingCrop: { top: 0, bottom: 0, left: 0, right: 0 },
        setFloatingCrop: vi.fn(),
        floatingZoom: 1,
        setFloatingZoom: vi.fn(),
        showCropControls: false,
        setShowCropControls: vi.fn(),
        intersectionArrows: [FLECHE],
        setIntersectionArrows: onArrowsChange,
        detecteurs: [DETECTEUR],
        setDetecteurs: onDetecteursChange,
        detecteurModule: true,
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
        intersectionDisplay: { showCurrents: true, showGroupNumbers: true, showGroupNames: true, showArrows: false, showSignals: false, showDetecteurs: true, showDetecteurNames: true },
        floatingImagePopup: { renderToPopup },
        ...options
    }));
    const rendu = render(renderToPopup.mock.lastCall[0]);
    const maj = () => rendu.rerender(renderToPopup.mock.lastCall[0]);
    const inner = () => rendu.container.querySelector('.floating-image-inner');
    if (inner()) {
        inner().getBoundingClientRect = () => ({ left: 0, top: 0, width: 750, height: 530, right: 750, bottom: 530, x: 0, y: 0, toJSON: () => ({}) });
    }
    return { container: rendu.container, maj, inner, onArrowsChange, onDetecteursChange };
};

const activerCorrection = ({ maj }) => {
    fireEvent.click(screen.getByRole('button', { name: /Corriger/ }));
    maj();
};

afterEach(() => {
    definirPrefsVerrou();
});

describe('useFloatingImageRenderer — mode correction', () => {
    it('reste un miroir tant que le mode correction n’est pas activé', () => {
        const { container } = contenu();
        fireEvent.click(container.querySelector('.floating-arrow-marker'));
        expect(screen.queryByText('Modifier la flèche')).toBeNull();
        expect(container.querySelector('.floating-correction-panneau')).toBeNull();
    });

    it('ouvre le panneau de la flèche cliquée', () => {
        const contexte = contenu();
        activerCorrection(contexte);
        expect(screen.getByRole('button', { name: /Corriger/ })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(contexte.container.querySelector('.floating-arrow-marker'));
        contexte.maj();
        expect(screen.getByText('Modifier la flèche')).toBeInTheDocument();
        expect(contexte.container.querySelector('.floating-arrow-marker')).toHaveClass('selectionnee');
    });

    it('tourne la flèche au double-clic', () => {
        const contexte = contenu();
        activerCorrection(contexte);
        fireEvent.doubleClick(contexte.container.querySelector('.floating-arrow-marker'));
        expect(contexte.onArrowsChange).toHaveBeenCalled();
        expect(contexte.onArrowsChange.mock.calls.at(-1)[0][0].rotation).toBe(45);
    });

    it('déplace la flèche à la souris', () => {
        const contexte = contenu();
        activerCorrection(contexte);
        const marqueur = contexte.container.querySelector('.floating-arrow-marker');
        fireEvent.mouseDown(marqueur, { clientX: 150, clientY: 150 });
        fireEvent.mouseMove(document, { clientX: 225, clientY: 212 });
        fireEvent.mouseUp(document);
        const fleches = contexte.onArrowsChange.mock.calls.at(-1)[0];
        expect(fleches[0].x).toBeGreaterThan(20);
        expect(fleches[0].y).toBeGreaterThan(20);
    });

    it('ouvre le panneau du détecteur cliqué', () => {
        const contexte = contenu();
        activerCorrection(contexte);
        fireEvent.click(contexte.container.querySelector('.detecteur-marker'));
        contexte.maj();
        expect(screen.getByText('Modifier le détecteur')).toBeInTheDocument();
    });

    it('grise le bouton Corriger quand l’image est verrouillée', () => {
        definirPrefsVerrou({ image: true });
        contenu();
        const bouton = screen.getByRole('button', { name: /Corriger/ });
        expect(bouton).toBeDisabled();
    });
});
