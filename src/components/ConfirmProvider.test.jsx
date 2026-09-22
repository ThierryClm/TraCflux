import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ConfirmProvider, { useAlert, useConfirm } from './ConfirmProvider';

const Consumer = () => {
    const confirm = useConfirm();
    const alert = useAlert();
    const [result, setResult] = useState('aucun');
    return (
        <>
            <button onClick={async () => setResult(String(await confirm({
                title: 'Suppression',
                message: 'Supprimer le plan ?',
                confirmLabel: 'Supprimer',
                cancelLabel: 'Garder',
                danger: true
            })))}>
                demander
            </button>
            <button onClick={async () => {
                await alert({ title: 'Information', message: 'Terminé' });
                setResult('alert-fermee');
            }}>
                informer
            </button>
            <output>{result}</output>
        </>
    );
};

const renderProvider = () => render(<ConfirmProvider><Consumer /></ConfirmProvider>);

beforeEach(() => vi.restoreAllMocks());

describe('ConfirmProvider', () => {
    it('résout true après confirmation et affiche les libellés demandés', async () => {
        renderProvider();
        fireEvent.click(screen.getByText('demander'));
        expect(screen.getByRole('heading', { name: 'Suppression' })).toBeInTheDocument();
        expect(screen.getByText('Supprimer le plan ?')).toBeInTheDocument();
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Supprimer' })));
        expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('résout false après annulation', async () => {
        renderProvider();
        fireEvent.click(screen.getByText('demander'));
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Garder' })));
        expect(screen.getByText('false')).toBeInTheDocument();
    });

    it('ferme une confirmation avec Échap', async () => {
        renderProvider();
        fireEvent.click(screen.getByText('demander'));
        await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
        expect(screen.getByText('false')).toBeInTheDocument();
    });

    it('valide une confirmation avec Entrée', async () => {
        renderProvider();
        fireEvent.click(screen.getByText('demander'));
        await act(async () => fireEvent.keyDown(window, { key: 'Enter' }));
        expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('une alerte ne propose pas d’annulation et se résout à la fermeture', async () => {
        renderProvider();
        fireEvent.click(screen.getByText('informer'));
        expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'OK' })));
        expect(screen.getByText('alert-fermee')).toBeInTheDocument();
    });

    it('le clic sur le fond annule la confirmation', async () => {
        renderProvider();
        fireEvent.click(screen.getByText('demander'));
        await act(async () => fireEvent.click(document.querySelector('.modal-overlay')));
        expect(screen.getByText('false')).toBeInTheDocument();
    });

    it('retombe sur les dialogues natifs hors provider', async () => {
        const confirmNative = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const alertNative = vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<Consumer />);

        await act(async () => fireEvent.click(screen.getByText('demander')));
        expect(confirmNative).toHaveBeenCalledWith('Supprimer le plan ?');
        expect(screen.getByText('true')).toBeInTheDocument();

        await act(async () => fireEvent.click(screen.getByText('informer')));
        expect(alertNative).toHaveBeenCalledWith('Terminé');
        expect(screen.getByText('alert-fermee')).toBeInTheDocument();
    });
});
