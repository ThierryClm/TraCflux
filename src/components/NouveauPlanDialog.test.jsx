import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NouveauPlanDialog from './NouveauPlanDialog';

const ouvrir = (props) => {
    const f = { onClose: vi.fn(), onAssocier: vi.fn(), onSuggererCycle: vi.fn(), onOuvrirTrafic: vi.fn() };
    render(<NouveauPlanDialog isOpen planName="Nouveau PF" jeuActif="HPS" {...f} {...props} />);
    return f;
};

describe('nouveau plan de feu', () => {
    it('trafic déjà saisi : choix du jeu, puis suggestion du cycle', () => {
        const f = ouvrir({ jeuxAvecDonnees: ['HPM', 'HPS'] });
        expect(screen.getByLabelText('Jeu de trafic du nouveau plan')).toHaveValue('HPS');
        fireEvent.change(screen.getByLabelText('Jeu de trafic du nouveau plan'), { target: { value: 'HPM' } });
        fireEvent.click(screen.getByRole('button', { name: 'Associer et suggérer le cycle…' }));
        expect(f.onAssocier).toHaveBeenCalledWith('HPM');
        expect(f.onSuggererCycle).toHaveBeenCalled();
    });

    it('aucun trafic : invite à le saisir dans l\'onglet Trafic', () => {
        const f = ouvrir({ jeuxAvecDonnees: [] });
        expect(screen.getByText(/Aucune donnée de trafic/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: "Ouvrir l'onglet Trafic" }));
        expect(f.onOuvrirTrafic).toHaveBeenCalled();
    });
});
