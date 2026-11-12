import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IntersectionImage from './IntersectionImage';

const GROUPES = [
    { id: 1, name: 'Nord', courant: 'TàG', signal: 'R14tg', offset: 0, durations: { green: 30, orange: 3, red: 27 } },
    { id: 2, name: 'Sud', courant: 'TD', signal: '', offset: 0, durations: { green: 30, orange: 3, red: 27 } }
];
const FLECHES = [
    { id: 1, groupId: 1, x: 20, y: 20, rotation: 90, scale: 2 },
    { id: 2, groupId: 2, x: 60, y: 60, rotation: 45 }
];

const renderImage = ({ showSignals, onDisplayOptionChange = vi.fn(), onArrowsChange = vi.fn(), isPlaying = false }) => render(
    <IntersectionImage
        groups={GROUPES}
        imageData="data:image/png;base64,AA=="
        onImageChange={vi.fn()}
        arrows={FLECHES}
        onArrowsChange={onArrowsChange}
        cycleLength={60}
        isPlaying={isPlaying}
        currentTime={0}
        actionData={[]}
        selectedActions={[]}
        conflictMatrix={[]}
        displayOptions={{ showGroupNumbers: true, showGroupNames: true, showArrows: false, showSignals }}
        onDisplayOptionChange={onDisplayOptionChange}
    />
);

const marqueur = (container, index) => container.querySelectorAll('.arrow-marker')[index];

describe('IntersectionImage — case Signal', () => {
    it('garde les flèches tant que la case est décochée', () => {
        renderImage({ showSignals: false });
        expect(screen.queryByRole('img', { name: /^Signal/ })).toBeNull();
    });

    it('remplace la flèche du groupe qui a un signal, et de lui seul', () => {
        const { container } = renderImage({ showSignals: true });
        const signal = screen.getByRole('img', { name: 'Signal R14tg' });
        expect(marqueur(container, 0).contains(signal)).toBe(true);
        expect(signal.dataset.forme).toBe('tg');
        expect(marqueur(container, 1).querySelector('[role="img"]')).toBeNull();
        expect(marqueur(container, 1).querySelector('svg')).not.toBeNull();
    });

    it("suit l'échelle de la flèche, réduite de moitié, mais jamais sa rotation", () => {
        const { container } = renderImage({ showSignals: true });
        expect(marqueur(container, 0).querySelector('.arrow-symbol').style.transform).toBe('scale(1)');
        expect(marqueur(container, 1).querySelector('.arrow-symbol').style.transform).toContain('rotate(45deg)');
    });

    it('prend la couleur de l’état du groupe', () => {
        renderImage({ showSignals: true });
        expect(screen.getByRole('img', { name: 'Signal R14tg' }).innerHTML).toContain('rgb(0, 255, 0)');
    });

    it('masque les noms des groupes et grise leur case tant que Signal est cochée', () => {
        const { container } = renderImage({ showSignals: true });
        expect(container.querySelector('.arrow-label')).toBeNull();
        const caseNoms = screen.getByRole('checkbox', { name: 'Nom GF' });
        expect(caseNoms.disabled).toBe(true);
        expect(caseNoms.checked).toBe(false);
    });

    it('rend les noms et leur case quand Signal est décochée', () => {
        const { container } = renderImage({ showSignals: false });
        expect(container.querySelector('.arrow-label')).not.toBeNull();
        const caseNoms = screen.getByRole('checkbox', { name: 'Nom GF' });
        expect(caseNoms.disabled).toBe(false);
        expect(caseNoms.checked).toBe(true);
    });

    it('grise la case et explique pourquoi quand aucun signal n’est renseigné', () => {
        const groupes = GROUPES.map(g => ({ ...g, signal: '' }));
        const { container } = render(
            <IntersectionImage
                groups={groupes} imageData="data:image/png;base64,AA==" onImageChange={vi.fn()} arrows={FLECHES}
                onArrowsChange={vi.fn()} cycleLength={60} currentTime={0} actionData={[]} selectedActions={[]} conflictMatrix={[]}
                displayOptions={{ showGroupNumbers: true, showGroupNames: true, showArrows: false, showSignals: true }}
            />
        );
        const caseSignal = screen.getByRole('checkbox', { name: 'Signaux' });
        expect(caseSignal.disabled).toBe(true);
        expect(caseSignal.checked).toBe(false);
        expect(caseSignal.closest('label').title).toMatch(/Aucun signal renseigné/);
        // Le choix mémorisé ne doit griser ni les noms ni les réglages.
        expect(screen.getByRole('checkbox', { name: 'Nom GF' }).disabled).toBe(false);
        expect(container.querySelector('.arrow-label')).not.toBeNull();
        fireEvent.click(marqueur(container, 0));
        expect(container.querySelector('.arrow-editor').disabled).toBe(false);
    });

    it('fait avancer le curseur pendant la lecture, une seconde par intervalle', () => {
        vi.useFakeTimers();
        const setCurrentTime = vi.fn();
        render(
            <IntersectionImage
                groups={GROUPES} imageData="data:image/png;base64,AA==" onImageChange={vi.fn()} arrows={FLECHES}
                onArrowsChange={vi.fn()} cycleLength={60} currentTime={59} setCurrentTime={setCurrentTime} isPlaying playbackSpeed={2}
                actionData={[]} selectedActions={[]} conflictMatrix={[]}
            />
        );
        vi.advanceTimersByTime(1000);
        vi.useRealTimers();
        expect(setCurrentTime).toHaveBeenCalledTimes(2);
        const avancer = setCurrentTime.mock.calls[0][0];
        expect(avancer(10)).toBe(11);
        expect(avancer(59)).toBe(0);
    });

    it('dessine les signaux de traversée à une taille fixe', () => {
        const groupes = [{ ...GROUPES[0], courant: 'Piéton', signal: 'R12' }, { ...GROUPES[1], courant: 'Cycle', signal: 'R13c' }];
        const fleches = [{ ...FLECHES[0], scale: 1.8 }, { ...FLECHES[1], scale: 1.4 }];
        const { container } = render(
            <IntersectionImage
                groups={groupes} imageData="data:image/png;base64,AA==" onImageChange={vi.fn()} arrows={fleches}
                onArrowsChange={vi.fn()} cycleLength={60} currentTime={0} actionData={[]} selectedActions={[]} conflictMatrix={[]}
                displayOptions={{ showGroupNumbers: false, showGroupNames: true, showArrows: false, showSignals: true }}
            />
        );
        expect(marqueur(container, 0).querySelector('.arrow-symbol').style.transform).toBe('scale(0.4)');
        expect(marqueur(container, 1).querySelector('.arrow-symbol').style.transform).toBe('scale(0.4)');
    });

    it('la case enregistre le choix', () => {
        const onDisplayOptionChange = vi.fn();
        renderImage({ showSignals: false, onDisplayOptionChange });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Signaux' }));
        expect(onDisplayOptionChange).toHaveBeenCalledWith('showSignals', true);
    });

    it('écarte le numéro de groupe du pictogramme', () => {
        const { container } = renderImage({ showSignals: true });
        const numeros = container.querySelectorAll('.group-number-centroid');
        expect(numeros[0].textContent).toBe('1');
        expect(parseFloat(numeros[0].style.left)).toBeGreaterThan(20);
        expect(parseFloat(numeros[0].style.top)).toBeLessThan(20);
        expect(numeros[1].style.left).toBe('60%');
    });

    it('le double-clic ne tourne rien tant que la case est cochée', () => {
        const onArrowsChange = vi.fn();
        const { container } = renderImage({ showSignals: true, onArrowsChange });
        fireEvent.doubleClick(marqueur(container, 0));
        fireEvent.doubleClick(marqueur(container, 1));
        expect(onArrowsChange).not.toHaveBeenCalled();
    });

    it('grise tous les réglages tant que la case est cochée, flèche sans signal comprise', () => {
        const { container } = renderImage({ showSignals: true });
        for (const index of [0, 1]) {
            fireEvent.click(marqueur(container, index));
            const reglages = container.querySelector('.arrow-editor');
            expect(reglages.disabled).toBe(true);
            expect(screen.getByText('Rotation:')).toBeTruthy();
            expect(screen.getByText('Zoom:')).toBeTruthy();
            for (const champ of reglages.querySelectorAll('input, select, button')) {
                expect(champ.matches(':disabled')).toBe(true);
            }
        }
        expect(screen.getByText(/Réglages inactifs/)).toBeTruthy();
    });

    it('rend les réglages quand la case est décochée', () => {
        const { container } = renderImage({ showSignals: false });
        fireEvent.click(marqueur(container, 0));
        expect(container.querySelector('.arrow-editor').disabled).toBe(false);
        expect(screen.queryByText(/Réglages inactifs/)).toBeNull();
    });

    it('la case cochée laisse le signal déplaçable', () => {
        const onArrowsChange = vi.fn();
        const { container } = renderImage({ showSignals: true, onArrowsChange });
        fireEvent.click(marqueur(container, 0));
        fireEvent.keyDown(container.querySelector('.intersection-image-area'), { key: 'ArrowRight' });
        expect(onArrowsChange).toHaveBeenCalled();
    });
});
