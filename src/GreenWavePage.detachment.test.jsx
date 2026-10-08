import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GreenWavePage from './GreenWavePage';
import ConfirmProvider from './components/ConfirmProvider';

const { popupHandle } = vi.hoisted(() => ({
    popupHandle: {
        renderToPopup: vi.fn(),
        popupWindow: { current: null },
        popupOpen: false,
        retryOpen: vi.fn()
    }
}));

vi.mock('./hooks/usePopupWindow', () => ({
    default: vi.fn(() => popupHandle),
    setMainModalActive: vi.fn()
}));

const intersection = {
    projectName: 'Carrefour test',
    distance: 0,
    distanceG2: 0,
    cycleLength: 60,
    selectedPfId: 1,
    selectedGroup1: 1,
    selectedGroup2: 1,
    actionData: [],
    pfTabs: [{ id: 1, name: 'PF1', data: [] }],
    groups: [{
        id: 1,
        name: 'Groupe test',
        offset: 0,
        durations: { green: 20, orange: 3, red: 37 }
    }]
};

describe('GreenWavePage — tableau détaché', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        window.history.replaceState(null, '', '/?greenwave&id=test');
        sessionStorage.setItem('greenwave_test', JSON.stringify([intersection]));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("garde le tableau à l'écran si la popup mémorisée n'a pas pu s'ouvrir", async () => {
        localStorage.setItem('greenwave_floating_datatable', 'true');

        render(<ConfirmProvider><GreenWavePage /></ConfirmProvider>);

        expect(await screen.findByRole('heading', { name: /Tableau des données saisies/ })).toBeInTheDocument();
        expect(screen.getByRole('table')).toHaveClass('green-wave-data-table');
        expect(screen.getByRole('button', { name: 'Détacher' })).toBeInTheDocument();
    });
});
