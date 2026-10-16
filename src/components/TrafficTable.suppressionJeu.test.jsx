import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from './ConfirmProvider';
import TrafficTable from './TrafficTable';

/**
 * « − » sur le sélecteur de jeu : propose de supprimer le jeu affiché, en
 * nommant les plans qui l'utilisent et leur nouveau jeu ; rien sans
 * confirmation.
 */

const group = { id: 1, name: 'Rue test', type: 'VL', laneCoef: 1, offset: 0, durations: { green: 30, orange: 3, red: 27 } };

const monter = (info) => {
    const supprimerJeu = vi.fn();
    const { container } = render(
        <ConfirmProvider>
            <TrafficTable
                groups={[group]} cycleLength={60}
                activeTrafficDataset="Soir" setActiveTrafficDataset={vi.fn()}
                updateTrafficData={vi.fn()} getTrafficData={() => ({ trafficVol: 0 })} updateGroupParams={vi.fn()}
                trafficDatasetNames={['Soir', 'Matin']} addCustomTrafficDataset={vi.fn()}
                infoSuppressionJeu={() => info} supprimerJeu={supprimerJeu}
            />
        </ConfirmProvider>
    );
    fireEvent.mouseEnter(container.querySelector('.traffic-dataset-group'));
    fireEvent.keyDown(window, { key: '-' });
    return supprimerJeu;
};

describe('TrafficTable — suppression du jeu affiché', () => {
    it('demande confirmation, en nommant les plans et leur nouveau jeu', async () => {
        const supprimerJeu = monter({ plans: ['PF1', 'PF2'], remplacement: 'Matin' });
        expect(await screen.findByText(/Supprimer le jeu de données « Soir » \?/)).toBeTruthy();
        expect(screen.getByText(/Les plans PF1, PF2 l'utilisent : ils passeront sur « Matin »/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
        await waitFor(() => expect(supprimerJeu).toHaveBeenCalledWith('Soir'));
    });

    it('Annuler ne supprime rien', async () => {
        const supprimerJeu = monter({ plans: [], remplacement: 'Matin' });
        await screen.findByText(/Aucun plan de feux ne l'utilise/);
        fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
        await waitFor(() => expect(screen.queryByText(/Supprimer le jeu de données/)).toBeNull());
        expect(supprimerJeu).not.toHaveBeenCalled();
    });

    it('un refus s\'explique, sans proposer de supprimer', async () => {
        const supprimerJeu = monter({ refus: "« Projection » est un jeu standard", plans: [], remplacement: 'Matin' });
        expect(await screen.findByText(/Projection » est un jeu standard/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull();
        expect(supprimerJeu).not.toHaveBeenCalled();
    });
});
