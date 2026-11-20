import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useFloatingImageRenderer from './useFloatingImageRenderer';
import { definirPrefsVerrou } from '../utils/verrouSaisie';

// Fenêtre des réglages : simulée, pour lire ce qui lui est envoyé.
const reglages = vi.hoisted(() => ({ renderToPopup: vi.fn(), popupOpen: true, bloquee: false, isOpen: false }));
vi.mock('./usePopupWindow', () => ({
    default: (options) => {
        reglages.isOpen = options.isOpen;
        return { renderToPopup: reglages.renderToPopup, popupOpen: reglages.popupOpen, bloquee: reglages.bloquee, retryOpen: vi.fn(), popupWindow: { current: null } };
    }
}));

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
const contenu = (options = {}, { document: doc } = {}) => {
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
    const rendu = doc
        ? render(renderToPopup.mock.lastCall[0], { container: doc.body.appendChild(doc.createElement('div')) })
        : render(renderToPopup.mock.lastCall[0]);
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

/** Contenu envoyé à la fenêtre des réglages. */
const panneau = () => render(reglages.renderToPopup.mock.lastCall[0]);

afterEach(() => {
    definirPrefsVerrou();
    reglages.renderToPopup.mockReset();
    reglages.popupOpen = true;
    reglages.bloquee = false;
});

describe('useFloatingImageRenderer — mode correction', () => {
    it('reste un miroir tant que le mode correction n’est pas activé', () => {
        const { container } = contenu();
        fireEvent.click(container.querySelector('.floating-arrow-marker'));
        expect(screen.queryByText('Modifier la flèche')).toBeNull();
        expect(container.querySelector('.floating-correction-panneau')).toBeNull();
    });

    it('ouvre la fenêtre des réglages avec le mode correction', () => {
        const contexte = contenu();
        expect(reglages.isOpen).toBe(false);
        activerCorrection(contexte);
        expect(reglages.isOpen).toBe(true);
        const { getByText } = panneau();
        expect(getByText('Aucun élément sélectionné.')).toBeInTheDocument();
    });

    it('règle la flèche cliquée dans la fenêtre des réglages, pas dans l’image', () => {
        const contexte = contenu();
        activerCorrection(contexte);
        expect(screen.getByRole('button', { name: /Corriger/ })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(contexte.container.querySelector('.floating-arrow-marker'));
        contexte.maj();
        expect(contexte.container.querySelector('.floating-correction-panneau')).toBeNull();
        expect(contexte.container.querySelector('.floating-arrow-marker')).toHaveClass('selectionnee');
        const { getByText } = panneau();
        expect(getByText('Modifier la flèche')).toBeInTheDocument();
    });

    it('replace le panneau à droite de l’image si la fenêtre des réglages est bloquée', () => {
        reglages.popupOpen = false;
        reglages.bloquee = true;
        const contexte = contenu();
        activerCorrection(contexte);
        fireEvent.click(contexte.container.querySelector('.floating-arrow-marker'));
        contexte.maj();
        expect(contexte.container.querySelector('.floating-correction-panneau')).not.toBeNull();
        expect(screen.getByText('Modifier la flèche')).toBeInTheDocument();
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

    it('suit la souris dans le document de la fenêtre détachée', () => {
        // L'image vit dans une autre fenêtre : les mouvements arrivent sur SON
        // document, jamais sur celui de la page principale.
        const iframe = document.body.appendChild(document.createElement('iframe'));
        const doc = iframe.contentDocument;
        const contexte = contenu({}, { document: doc });
        fireEvent.click(doc.querySelector('.floating-correction-btn'));
        contexte.maj();
        const inner = doc.querySelector('.floating-image-inner');
        inner.getBoundingClientRect = () => ({ left: 0, top: 0, width: 750, height: 530, right: 750, bottom: 530, x: 0, y: 0, toJSON: () => ({}) });
        const marqueur = doc.querySelector('.detecteur-marker');
        fireEvent.mouseDown(marqueur, { clientX: 300, clientY: 318, button: 0 });
        fireEvent.mouseMove(document, { clientX: 375, clientY: 371 });
        expect(contexte.onDetecteursChange).not.toHaveBeenCalled();
        fireEvent.mouseMove(doc, { clientX: 375, clientY: 371 });
        fireEvent.mouseUp(doc);
        const position = contexte.onDetecteursChange.mock.calls.at(-1)[0][0].position;
        expect(position.x).toBeCloseTo(50, 0);
        expect(position.y).toBeCloseTo(70, 0);
        iframe.remove();
    });

    it('ouvre le panneau du détecteur cliqué', () => {
        const contexte = contenu();
        activerCorrection(contexte);
        fireEvent.click(contexte.container.querySelector('.detecteur-marker'));
        contexte.maj();
        const { getByText } = panneau();
        expect(getByText('Modifier le détecteur')).toBeInTheDocument();
    });

    it('grise le bouton Corriger quand l’image est verrouillée', () => {
        definirPrefsVerrou({ image: true });
        contenu();
        const bouton = screen.getByRole('button', { name: /Corriger/ });
        expect(bouton).toBeDisabled();
    });
});
