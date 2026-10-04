import React, { useCallback, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from './ConfirmProvider';
import TrafficTable from './TrafficTable';

const group = {
    id: 1,
    name: 'Rue test',
    type: 'VL',
    laneCoef: 1,
    offset: 0,
    durations: { green: 30, orange: 3, red: 27 },
};

function TrafficCopyHarness() {
    const [activeDataset, setActiveDataset] = useState('Cible');
    const [datasets, setDatasets] = useState({
        Cible: { 1: { trafficVol: 0 } },
        Source: { 1: { trafficVol: 420 } },
        Vide: { 1: { trafficVol: 0 } },
    });
    const getTrafficData = useCallback(
        id => datasets[activeDataset]?.[id] || { trafficVol: 0 },
        [datasets, activeDataset]
    );
    const copyTrafficDataset = useCallback((source, target) => {
        setDatasets(previous => ({
            ...previous,
            [target]: Object.fromEntries(
                Object.entries(previous[source]).map(([id, data]) => [id, { ...data }])
            ),
        }));
    }, []);

    return (
        <ConfirmProvider>
            <TrafficTable
                groups={[group]}
                cycleLength={60}
                activeTrafficDataset={activeDataset}
                setActiveTrafficDataset={setActiveDataset}
                updateTrafficData={vi.fn()}
                getTrafficData={getTrafficData}
                updateGroupParams={vi.fn()}
                trafficDatasetNames={['Cible', 'Source', 'Vide']}
                trafficDatasetSourceNames={['Source']}
                copyTrafficDataset={copyTrafficDataset}
                addCustomTrafficDataset={vi.fn()}
            />
        </ConfirmProvider>
    );
}

describe('TrafficTable — copie d’un jeu de trafic', () => {
    it('propose seulement les sources renseignées et rafraîchit le tableau après copie', () => {
        const { container } = render(<TrafficCopyHarness />);

        fireEvent.click(screen.getByRole('button', { name: 'Coller...' }));
        const sourceItem = container.querySelector('.paste-dropdown-item');
        expect(sourceItem).toHaveTextContent('Source');
        expect(container.querySelector('.paste-dropdown')).not.toHaveTextContent('Vide');

        fireEvent.click(sourceItem);

        expect(screen.getByDisplayValue('420')).toBeInTheDocument();
        expect(screen.queryByText('Données trafic non renseignées')).not.toBeInTheDocument();
    });
});
