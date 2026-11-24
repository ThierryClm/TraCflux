import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ReglageSeuilsDialog from './ReglageSeuilsDialog';
import { SEUILS_ANALYSE_DEFAUT } from '../utils/seuilsAnalyse';

describe('ReglageSeuilsDialog', () => {
    it('enregistre un seuil modifié', () => {
        const onEnregistrer = vi.fn();
        render(<ReglageSeuilsDialog isOpen onClose={() => {}} seuils={SEUILS_ANALYSE_DEFAUT} onEnregistrer={onEnregistrer} />);
        const champ = screen.getByLabelText('Retard moyen piéton signalé');
        expect(champ).toHaveValue(20);
        fireEvent.change(champ, { target: { value: '25' } });
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        expect(onEnregistrer).toHaveBeenCalledWith(expect.objectContaining({ retardPietonMaxi: 25 }));
    });

    it('rétablit les valeurs par défaut dans le brouillon', () => {
        const onEnregistrer = vi.fn();
        render(<ReglageSeuilsDialog isOpen onClose={() => {}} seuils={{ ...SEUILS_ANALYSE_DEFAUT, attentePietonMaxi: 35 }} onEnregistrer={onEnregistrer} />);
        fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        expect(onEnregistrer).toHaveBeenCalledWith(expect.objectContaining({ attentePietonMaxi: 50 }));
    });

    it('refuse d\'enregistrer des seuils incohérents', () => {
        const onEnregistrer = vi.fn();
        render(<ReglageSeuilsDialog isOpen onClose={() => {}} seuils={SEUILS_ANALYSE_DEFAUT} onEnregistrer={onEnregistrer} />);
        fireEvent.change(screen.getByLabelText('Vert de confort'), { target: { value: '2' } });
        expect(screen.getByRole('alert')).toHaveTextContent(/vert de confort/);
        const bouton = screen.getByRole('button', { name: 'Enregistrer' });
        expect(bouton).toBeDisabled();
        fireEvent.click(bouton);
        expect(onEnregistrer).not.toHaveBeenCalled();
    });
});
