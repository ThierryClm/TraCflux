import { act, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { ZoneVerrouSaisie, basculerVerrou, definirPrefsVerrou, lirePrefsVerrou, prefsVerrouAEnregistrer } from './verrouSaisie';

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

afterEach(() => { act(() => definirPrefsVerrou()); });

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

    it('réglage du projet : seules les sections verrouillées sont enregistrées, relues à l\'ouverture', () => {
        expect(prefsVerrouAEnregistrer()).toBeUndefined();
        act(() => basculerVerrou('variables'));
        act(() => basculerVerrou('conditions'));
        expect(prefsVerrouAEnregistrer()).toEqual({ conditions: true, variables: true });
        // Ouverture d'un autre projet : son verrouillage remplace le précédent.
        act(() => definirPrefsVerrou({ matrice: true, inconnu: true, trafic: 'oui' }));
        expect(lirePrefsVerrou()).toMatchObject({ matrice: true, trafic: false, conditions: false, variables: false });
        // Nouveau projet : rien de verrouillé.
        act(() => definirPrefsVerrou());
        expect(prefsVerrouAEnregistrer()).toBeUndefined();
        expect(localStorage.getItem('tracflux.verrouSaisie')).toBeNull();
    });
});


it('verrouille les interactions de l’image dans plusieurs fenêtres, en gardant le survol et le détachement', () => {
    const modifier = vi.fn(), survoler = vi.fn(), detacher = vi.fn();
    const image = nom => <ZoneVerrouSaisie section="image">
        <input type="checkbox" aria-label={nom} />
        <button onClick={modifier}>Zoom {nom}</button>
        <button data-verrou-autorise onClick={detacher}>Détacher {nom}</button>
        <svg aria-label={`flèche ${nom}`} onMouseDown={modifier} onDoubleClick={modifier} onMouseEnter={survoler} />
    </ZoneVerrouSaisie>;
    render(image('principale'));
    render(image('détachée'));
    act(() => basculerVerrou('image'));
    for (const nom of ['principale', 'détachée']) {
        expect(screen.getByLabelText(nom)).toBeDisabled();
        expect(screen.getByText(`Zoom ${nom}`)).toBeDisabled();
        fireEvent.mouseDown(screen.getByLabelText(`flèche ${nom}`));
        fireEvent.doubleClick(screen.getByLabelText(`flèche ${nom}`));
        fireEvent.mouseEnter(screen.getByLabelText(`flèche ${nom}`));
    }
    fireEvent.click(screen.getByText('Détacher principale'));
    expect(detacher).toHaveBeenCalledOnce();
    expect(modifier).not.toHaveBeenCalled();
    expect(survoler).toHaveBeenCalledTimes(2);
    expect(prefsVerrouAEnregistrer()).toEqual({ image: true });
    act(() => basculerVerrou('image'));
    expect(screen.getByText('Zoom détachée')).toBeEnabled();
    fireEvent.mouseDown(screen.getByLabelText('flèche principale'));
    expect(modifier).toHaveBeenCalledOnce();
});
