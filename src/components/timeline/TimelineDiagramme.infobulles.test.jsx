import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TimelineSidebar from './TimelineSidebar';

/**
 * Case « Diagramme » de Mise en page → Infobulles : la colonne des groupes du
 * diagramme ne doit plus rien afficher au survol quand elle est décochée.
 */

const group = {
    id: 1, name: 'Avenue Nord', type: 'V', da: 'N1', minGreen: 8, offset: 10,
    phaseFlag: 'a', durations: { green: 20, orange: 3, red: 27 }
};

const renderSidebar = (props = {}) => render(
    <TimelineSidebar
        cycleLength={60}
        effectiveCycleLength={60}
        escamotageGroupIds={new Set()}
        groups={[group]}
        handleEndChange={vi.fn()}
        handleNameMouseEnter={vi.fn()}
        handleNameMouseLeave={vi.fn()}
        handlePhaseFlagKeyDown={vi.fn()}
        handleStartChange={vi.fn()}
        onGroupClick={vi.fn()}
        showGroupNames
        showWrapFlash
        updateGroupParams={vi.fn()}
        phaseFlagTooltipId={1}
        {...props}
    />
);

// Survole un élément et laisse passer le délai de CustomTooltip.
const survoler = (element) => {
    fireEvent.mouseEnter(element, { clientX: 5, clientY: 5 });
    act(() => { vi.advanceTimersByTime(1000); });
};

describe('infobulles « Diagramme » de la colonne des groupes', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('par défaut, la durée nominale et le raccourci Alt+A / Alt+E s\'affichent', () => {
        const { container } = renderSidebar();
        expect(screen.getByText('Alt+A : aiguillage, Alt+E : escamotage')).toBeInTheDocument();
        survoler(container.querySelector('input[readonly]'));
        expect(screen.getByText('Durée nominale dans le cycle')).toBeInTheDocument();
    });

    it('case décochée : aucune bulle, ni maison ni CustomTooltip', () => {
        const { container } = renderSidebar({ tooltipsEnabled: false });
        expect(screen.queryByText('Alt+A : aiguillage, Alt+E : escamotage')).toBeNull();
        survoler(container.querySelector('input[readonly]'));
        survoler(screen.getByText('DA'));
        survoler(container.querySelector('.phase-flag-indicator'));
        expect(screen.queryByText('Durée nominale dans le cycle')).toBeNull();
        expect(screen.queryByText(/Code trajet/)).toBeNull();
        expect(screen.queryByText('Aiguillage')).toBeNull();
        expect(document.querySelector('.custom-tooltip')).toBeNull();
    });
});
