import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TrafficTable from './TrafficTable';
import { ConfirmProvider } from './ConfirmProvider';
import { basculerVerrou, definirPrefsVerrou } from '../utils/verrouSaisie';

afterEach(() => act(() => definirPrefsVerrou()));

it('remplace Tous les groupes sans perdre le filtre choisi au déverrouillage', () => {
    const groupes = ['V', 'P'].map((type, i) => ({
        id: i + 1, name: `G${i + 1}`, type, offset: 0,
        durations: { green: 30, orange: 3, red: 27 }
    }));
    const { container } = render(<ConfirmProvider>
        <TrafficTable groups={groupes} cycleLength={60} activeTrafficDataset="HPM"
            setActiveTrafficDataset={vi.fn()} updateTrafficData={vi.fn()}
            getTrafficData={() => ({ trafficVol: 100 })} updateGroupParams={vi.fn()}
            trafficDatasetNames={["HPM"]} trafficDatasetSourceNames={[]} />
    </ConfirmProvider>);
    const filtre = screen.getByRole('checkbox', { name: 'Tous les Grp' });
    fireEvent.click(filtre);
    const lignes = container.querySelectorAll('tbody tr').length;
    act(() => basculerVerrou('trafic'));
    expect(screen.queryByRole('checkbox', { name: 'Tous les Grp' })).toBeNull();
    expect(container.querySelector('.traffic-header .mention-verrou')).toHaveTextContent('(verrouillé)');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(lignes);
    act(() => basculerVerrou('trafic'));
    expect(screen.queryByText('(verrouillé)')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Tous les Grp' })).toBeChecked();
});
