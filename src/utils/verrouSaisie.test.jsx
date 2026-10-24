import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { ZoneVerrouSaisie, basculerVerrou, lirePrefsVerrou } from './verrouSaisie';

const Section = () => {
    const [lignes, setLignes] = useState(1);
    return (
        <ZoneVerrouSaisie section="configuration">
            <input aria-label="nom" defaultValue="V1" />
            <select aria-label="type" defaultValue="V"><option value="V">V</option></select>
            <input aria-label="coche" type="checkbox" />
            <select aria-label="fige" disabled defaultValue="V"><option value="V">V</option></select>
            {Array.from({ length: lignes }, (_, i) => <input key={i} aria-label={`ligne ${i}`} />)}
            <button onClick={() => setLignes(n => n + 1)}>ajouter</button>
        </ZoneVerrouSaisie>
    );
};

afterEach(() => { if (lirePrefsVerrou().configuration) act(() => basculerVerrou('configuration')); });

describe('verrouillage de la saisie par section', () => {
    it('verrouille les champs, listes et cases, puis rend exactement ce qu\'il a pris', async () => {
        render(<Section />);
        expect(screen.getByLabelText('nom')).not.toHaveAttribute('readonly');
        act(() => basculerVerrou('configuration'));
        expect(screen.getByLabelText('nom')).toHaveAttribute('readonly');
        expect(screen.getByLabelText('type')).toBeDisabled();
        expect(screen.getByLabelText('coche')).toBeDisabled();
        // Une ligne ajoutée par React pendant le verrouillage est verrouillée aussi.
        await act(async () => { screen.getByText('ajouter').click(); });
        await act(async () => { await new Promise(r => setTimeout(r, 0)); });
        expect(screen.getByLabelText('ligne 1')).toHaveAttribute('readonly');
        act(() => basculerVerrou('configuration'));
        expect(screen.getByLabelText('nom')).not.toHaveAttribute('readonly');
        expect(screen.getByLabelText('type')).toBeEnabled();
        expect(screen.getByLabelText('ligne 1')).not.toHaveAttribute('readonly');
        // Un champ déjà désactivé par l'application le reste.
        expect(screen.getByLabelText('fige')).toBeDisabled();
    });

    it('préférence du poste, mémorisée dans le navigateur', () => {
        act(() => basculerVerrou('configuration'));
        expect(JSON.parse(localStorage.getItem('tracflux.verrouSaisie')).configuration).toBe(true);
    });
});
