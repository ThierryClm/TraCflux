import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from './ConfirmProvider';
import TrafficTable from './TrafficTable';

const groupe = (id, name, type, green = 30) => ({
    id,
    name,
    type,
    laneCoef: 1,
    offset: 0,
    durations: { green, orange: 3, red: 27 }
});

const rendre = (groups) => render(
    <ConfirmProvider>
        <TrafficTable
            groups={groups}
            cycleLength={60}
            activeTrafficDataset="Cible"
            setActiveTrafficDataset={vi.fn()}
            updateTrafficData={vi.fn()}
            getTrafficData={() => ({ trafficVol: 100 })}
            updateGroupParams={vi.fn()}
            trafficDatasetNames={['Cible']}
            trafficDatasetSourceNames={[]}
            copyTrafficDataset={vi.fn()}
            addCustomTrafficDataset={vi.fn()}
        />
    </ConfirmProvider>
);

describe('TrafficTable — lignes du tableau', () => {
    const groups = [
        groupe(1, 'Automobiles', 'VL'),
        groupe(2, 'Bus de ligne', 'B', 10),
        groupe(3, 'Piétons', 'P', 20)
    ];

    it('garde la ligne du bus quand tous les groupes ne sont pas affichés', () => {
        rendre(groups);
        expect(screen.getByText('Automobiles')).toBeInTheDocument();
        expect(screen.getByText('Bus de ligne')).toBeInTheDocument();
        expect(screen.queryByText('Piétons')).toBeNull();
    });

    it('affiche aussi les piétons avec « Tous les Grp »', () => {
        rendre(groups);
        fireEvent.click(screen.getByRole('checkbox', { name: /Tous les Grp/ }));
        expect(screen.getByText('Piétons')).toBeInTheDocument();
    });
});
