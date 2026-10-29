import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from './ConfirmProvider';
import TrafficTable from './TrafficTable';

const group = { id: 1, name: 'Rue test', type: 'VL', laneCoef: 1, offset: 0, durations: { green: 30, orange: 3, red: 27 } };

const rendre = (trafficVol) => render(
    <ConfirmProvider>
        <TrafficTable groups={[group]} cycleLength={60} activeTrafficDataset="HPM" setActiveTrafficDataset={vi.fn()}
            updateTrafficData={vi.fn()} getTrafficData={() => ({ trafficVol })} updateGroupParams={vi.fn()}
            trafficDatasetNames={['HPM']} trafficDatasetSourceNames={[]} copyTrafficDataset={vi.fn()} addCustomTrafficDataset={vi.fn()} />
    </ConfirmProvider>
);

describe('TrafficTable — trafic coordonné', () => {
    it('l’infobulle de la touche « c » s’affiche après 2,5 s de survol', () => {
        vi.useFakeTimers();
        const { container } = rendre(350);
        fireEvent.mouseEnter(container.querySelector('.trafic-input-wrapper'));
        act(() => { vi.advanceTimersByTime(2400); });
        expect(container.querySelector('.trafic-custom-tooltip')).toBeNull();
        act(() => { vi.advanceTimersByTime(200); });
        expect(container.querySelector('.trafic-custom-tooltip').textContent).toMatch(/Touche « c » : trafic coordonné/);
        vi.useRealTimers();
    });

    it('« 350c » : le « c » s’affiche, retard et file d’attente à 0, capacité calculée sur 350', () => {
        const { container } = rendre('350c');
        expect(container.querySelector('.trafic-coordinated-c')).not.toBeNull();
        expect(container.querySelector('.trafic-input-wrapper input').value).toBe('350');
        expect(container.textContent).toMatch(/0''/);
        expect(container.textContent).toMatch(/0m/);
    });
});
