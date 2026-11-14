import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ConfirmProvider from './ConfirmProvider';
import DetecteursTable from './DetecteursTable';
import { basculerVerrou, definirPrefsVerrou } from '../utils/verrouSaisie';
import type { Detecteur, Groupe } from '../types/projet';

const groupes: Groupe[] = [
    { id: 1, name: 'Nord', type: 'V', minGreen: 6, offset: 0, durations: { green: 30, orange: 3, red: 57 } },
    { id: 2, name: 'Sud', type: 'V', minGreen: 6, offset: 0, durations: { green: 30, orange: 3, red: 57 } }
];

const detecteur = (overrides: Partial<Detecteur> = {}): Detecteur => ({
    id: 1,
    nom: 'Boucle entrée',
    categorie: 'bouclePiedFeu',
    gf: 1,
    dimension: 8,
    position: null,
    orientation: 0,
    note: '',
    ...overrides
});

const Table = ({ initial = [detecteur()] }: { initial?: Detecteur[] }) => {
    const [detecteurs, setDetecteurs] = useState(initial);
    return (
        <DetecteursTable
            detecteurs={detecteurs}
            groups={groupes}
            onChange={setDetecteurs}
        />
    );
};

const rendre = (initial?: Detecteur[]) => render(
    <ConfirmProvider>
        <Table initial={initial} />
    </ConfirmProvider>
);

const nom = (i = 0) => screen.getAllByLabelText('Nom du détecteur')[i];
const type = (i = 0) => screen.getAllByLabelText('Type du détecteur')[i];
const gf = (i = 0) => screen.getAllByLabelText('Groupe de feu du détecteur')[i];
const dimension = (i = 0) => screen.getAllByLabelText('Dimension du détecteur')[i];
const lignes = () => document.querySelectorAll('.detecteurs-table tbody tr');

afterEach(() => { act(() => definirPrefsVerrou()); });

describe('DetecteursTable — affichage', () => {
    it('affiche les quatre colonnes et la ligne enregistrée', () => {
        rendre();
        expect(screen.getByText('Dim. (m)')).toBeInTheDocument();
        expect(nom()).toHaveValue('Boucle entrée');
        expect(type()).toHaveValue('bouclePiedFeu');
        expect(gf()).toHaveValue('1');
        expect(dimension()).toHaveValue('8');
    });

    it('liste les groupes de feu, avec une entrée « Aucun »', () => {
        rendre();
        expect(screen.getByRole('option', { name: '— Aucun —' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'G1 — Nord' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'G2 — Sud' })).toBeInTheDocument();
    });

    it('affiche le message d’accueil quand la liste est vide', () => {
        rendre([]);
        expect(lignes()).toHaveLength(0);
        expect(screen.getByText(/Aucun détecteur/)).toBeInTheDocument();
    });
});

describe('DetecteursTable — saisie', () => {
    it('ajoute un détecteur neuf', () => {
        rendre([]);
        fireEvent.click(screen.getByRole('button', { name: /Ajouter un détecteur/ }));
        expect(lignes()).toHaveLength(1);
        expect(nom()).toHaveValue('Détecteur 1');
        expect(type()).toHaveValue('bouclePiedFeu');
        expect(gf()).toHaveValue('');
        expect(dimension()).toHaveValue('2');
    });

    it('enregistre le nom et le groupe de feu au changement', () => {
        rendre();
        fireEvent.change(nom(), { target: { value: 'Boucle sortie' } });
        fireEvent.blur(nom());
        expect(nom()).toHaveValue('Boucle sortie');

        fireEvent.change(gf(), { target: { value: '2' } });
        expect(gf()).toHaveValue('2');
    });

    it('grise et vide la dimension d’un bouton poussoir', () => {
        rendre();
        fireEvent.change(type(), { target: { value: 'boutonPoussoir' } });
        expect(dimension()).toBeDisabled();
        expect(dimension()).toHaveValue('');
        expect(screen.getAllByTitle(/Un bouton poussoir n’a pas de dimension/)[0]).toBeInTheDocument();
    });

    it('suit la longueur par défaut quand on change de type de boucle', () => {
        rendre([]);
        fireEvent.click(screen.getByRole('button', { name: /Ajouter un détecteur/ }));
        expect(dimension()).toHaveValue('2');
        fireEvent.change(type(), { target: { value: 'boucleEloignee' } });
        expect(dimension()).toBeEnabled();
        expect(dimension()).toHaveValue('10');
        fireEvent.change(type(), { target: { value: 'boucleComptage' } });
        expect(dimension()).toHaveValue('2');
    });

    it('lit une longueur décimale à la virgule', () => {
        rendre();
        fireEvent.change(dimension(), { target: { value: '7,5' } });
        fireEvent.blur(dimension());
        expect(dimension()).toHaveValue('7.5');
    });
});

describe('DetecteursTable — duplication et suppression', () => {
    it('duplique la ligne juste en dessous', () => {
        rendre();
        fireEvent.click(screen.getByTitle('Dupliquer ce détecteur'));
        expect(lignes()).toHaveLength(2);
        expect(nom(0)).toHaveValue('Boucle entrée');
        expect(nom(1)).toHaveValue('Boucle entrée (copie)');
        expect(dimension(1)).toHaveValue('8');
    });

    it('demande confirmation avant de supprimer', async () => {
        rendre();
        fireEvent.click(screen.getByTitle('Supprimer ce détecteur'));
        expect(screen.getByText(/Supprimer « Boucle entrée »/)).toBeInTheDocument();
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
        });
        expect(lignes()).toHaveLength(0);
    });
});

describe('DetecteursTable — dimension', () => {
    it('grise et vide la dimension d’un radar', () => {
        rendre([detecteur({ categorie: 'radar', dimension: 25 })]);
        expect(dimension()).toBeDisabled();
        expect(dimension()).toHaveValue('');
        expect(screen.getAllByTitle(/Un radar n’a pas de dimension/)[0]).toBeInTheDocument();
    });
});

describe('DetecteursTable — verrouillage de la saisie', () => {
    it('verrouille champs, listes et boutons de la section', async () => {
        rendre();
        await act(async () => { basculerVerrou('detecteurs'); });
        expect(nom()).toHaveAttribute('readonly');
        expect(type()).toBeDisabled();
        expect(gf()).toBeDisabled();
        expect(screen.getByRole('button', { name: /Ajouter un détecteur/ })).toBeDisabled();
        expect(screen.getByTitle('Dupliquer ce détecteur')).toBeDisabled();

        await act(async () => { basculerVerrou('detecteurs'); });
        expect(nom()).not.toHaveAttribute('readonly');
        expect(type()).toBeEnabled();
        expect(screen.getByRole('button', { name: /Ajouter un détecteur/ })).toBeEnabled();
    });
});
