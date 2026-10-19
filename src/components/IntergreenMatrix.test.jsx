import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import IntergreenMatrix from './IntergreenMatrix';

// Cycle de 60 s : GF1 vert de 0 à 20, GF2 vert de 25 à 45.
// Délai réel GF1 → GF2 = 5 s, GF2 → GF1 = 15 s.
const groupe = (id, name, offset, green) => ({
    id, name, type: 'VL', minGreen: 5, offset,
    durations: { green, orange: 3, red: 60 - green - 3 }
});
const GROUPES = [groupe(1, 'Nord', 0, 20), groupe(2, 'Sud', 25, 20)];

const matrice = (m12, m21) => [['', m12], [m21, '']];

const renderMatrix = (props = {}) => {
    const setMatrixValue = props.setMatrixValue || vi.fn();
    const utils = render(
        <IntergreenMatrix
            conflictMatrix={matrice(5, 15)}
            setMatrixValue={setMatrixValue}
            groups={GROUPES}
            cycleLength={60}
            actionData={[]}
            {...props}
        />
    );
    return { ...utils, setMatrixValue };
};

// Case de la ligne `de`, colonne `vers` (numéros de groupe, à partir de 1).
// Avec les noms affichés, chaque ligne commence par le numéro puis le nom.
const caseMatrice = (de, vers, { avecNoms = true } = {}) => {
    const lignes = document.querySelectorAll('tbody tr');
    return lignes[de - 1].querySelectorAll('td')[(avecNoms ? 2 : 1) + vers - 1];
};
const saisie = (de, vers) => within(caseMatrice(de, vers)).getByRole('textbox');

afterEach(() => {
    vi.useRealTimers();
});

describe('IntergreenMatrix — affichage', () => {
    it('affiche le titre, les noms de groupes, les valeurs et la diagonale', () => {
        renderMatrix();
        expect(screen.getByRole('heading', { name: /Matrice des temps interverts/ })).toBeInTheDocument();
        expect(screen.getByText('Nord')).toBeInTheDocument();
        expect(screen.getByText('Sud')).toBeInTheDocument();
        expect(saisie(1, 2)).toHaveValue('5');
        expect(saisie(2, 1)).toHaveValue('15');
        expect(caseMatrice(1, 1)).toHaveClass('diagonal-cell');
        expect(within(caseMatrice(1, 1)).queryByRole('textbox')).toBeNull();
    });

    it('masque la colonne des noms sur demande', () => {
        renderMatrix({ showGroupNames: false });
        expect(screen.queryByText('Nom')).toBeNull();
        expect(screen.queryByText('Nord')).toBeNull();
        expect(within(caseMatrice(1, 2, { avecNoms: false })).getByRole('textbox')).toHaveValue('5');
    });

    it('invite à saisir la matrice quand elle est vide', () => {
        renderMatrix({ conflictMatrix: matrice('', '') });
        expect(screen.getByText(/Saisissez les temps interverts/)).toBeInTheDocument();
    });

    it("n'affiche pas l'invite dès qu'une case est renseignée", () => {
        renderMatrix({ conflictMatrix: matrice(5, '') });
        expect(screen.queryByText(/Saisissez les temps interverts/)).toBeNull();
    });

    it("retire l'en-tête en fenêtre détachée (le bandeau le porte déjà)", () => {
        renderMatrix({ titreEnBandeau: true, onDetach: vi.fn() });
        expect(screen.queryByRole('heading')).toBeNull();
        expect(screen.queryByText('Détacher')).toBeNull();
    });

    it('le bouton Détacher appelle onDetach', () => {
        const onDetach = vi.fn();
        renderMatrix({ onDetach });
        fireEvent.click(screen.getByText('Détacher'));
        expect(onDetach).toHaveBeenCalledTimes(1);
    });

    it('trace la séparation bi-carrefour après le groupe désigné', () => {
        renderMatrix({ biCarrefourSeparator: 1 });
        expect(caseMatrice(1, 2)).toHaveClass('matrix-bi-sep-bottom');
        expect(caseMatrice(2, 1)).toHaveClass('matrix-bi-sep-right');
        expect(caseMatrice(2, 2)).not.toHaveClass('matrix-bi-sep-bottom');
    });

    it('surligne la ligne et la colonne du groupe survolé ailleurs', () => {
        renderMatrix({ hoveredGroupId: 2 });
        const lignes = document.querySelectorAll('tbody tr');
        expect(lignes[1]).toHaveClass('matrix-hovered-row');
        expect(lignes[0]).not.toHaveClass('matrix-hovered-row');
        expect(caseMatrice(1, 2)).toHaveClass('matrix-hovered-col');
    });
});

describe('IntergreenMatrix — saisie', () => {
    it('valide la valeur à la sortie du champ, avec les numéros de groupe', () => {
        const { setMatrixValue } = renderMatrix();
        const champ = saisie(1, 2);
        fireEvent.focus(champ);
        fireEvent.change(champ, { target: { value: '7' } });
        expect(setMatrixValue).not.toHaveBeenCalled();
        fireEvent.blur(champ);
        expect(setMatrixValue).toHaveBeenCalledWith(1, 2, '7');
    });

    it('valide aussi avec Entrée', () => {
        const { setMatrixValue } = renderMatrix();
        const champ = saisie(2, 1);
        fireEvent.focus(champ);
        fireEvent.change(champ, { target: { value: '12' } });
        fireEvent.keyDown(champ, { key: 'Enter' });
        expect(setMatrixValue).toHaveBeenCalledWith(2, 1, '12');
    });

    it('ne garde que les chiffres et signale le caractère refusé', () => {
        renderMatrix();
        const champ = saisie(1, 2);
        fireEvent.focus(champ);
        fireEvent.change(champ, { target: { value: '8s' } });
        expect(champ).toHaveValue('8');
        expect(champ).toHaveClass('numeric-input-rejected');
    });

    it("une touche refusée n'efface pas une case déjà remplie", () => {
        const { setMatrixValue } = renderMatrix();
        const champ = saisie(1, 2);
        fireEvent.focus(champ);
        fireEvent.change(champ, { target: { value: 'x' } });
        expect(champ).toHaveValue('5');
        fireEvent.blur(champ);
        expect(setMatrixValue).toHaveBeenCalledWith(1, 2, '5');
    });

    it('accepte de vider une case', () => {
        const { setMatrixValue } = renderMatrix();
        const champ = saisie(1, 2);
        fireEvent.focus(champ);
        fireEvent.change(champ, { target: { value: '' } });
        fireEvent.blur(champ);
        expect(setMatrixValue).toHaveBeenCalledWith(1, 2, '');
    });

    it('reprend la valeur du projet quand elle change hors saisie', () => {
        const { rerender, setMatrixValue } = renderMatrix();
        rerender(
            <IntergreenMatrix
                conflictMatrix={matrice(9, 15)}
                setMatrixValue={setMatrixValue}
                groups={GROUPES}
                cycleLength={60}
                actionData={[]}
            />
        );
        expect(saisie(1, 2)).toHaveValue('9');
    });

    it('verrouillée : valeurs en lecture seule et mention « Verrouillé »', () => {
        renderMatrix({ locked: true });
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        expect(screen.getByText('(Verrouillé)')).toBeInTheDocument();
        expect(caseMatrice(1, 2)).toHaveTextContent('5');
    });
});

describe('IntergreenMatrix — contrôles', () => {
    it("ne signale rien quand l'intervert est exactement respecté", () => {
        renderMatrix({ conflictMatrix: matrice(5, 15) });
        expect(caseMatrice(1, 2)).not.toHaveClass('matrix-conflict-cell');
        expect(caseMatrice(2, 1)).not.toHaveClass('matrix-conflict-cell');
    });

    it("signale un intervert supérieur au délai réel", () => {
        renderMatrix({ conflictMatrix: matrice(6, 15) });
        expect(caseMatrice(1, 2)).toHaveClass('matrix-conflict-cell');
        expect(saisie(1, 2)).toHaveClass('matrix-conflict-input');
        expect(caseMatrice(2, 1)).not.toHaveClass('matrix-conflict-cell');
    });

    it('mesure le délai à travers la fin du cycle', () => {
        // GF2 finit à 45, GF1 repart à 0 (= 60) : 15 s réels.
        renderMatrix({ conflictMatrix: matrice(5, 16) });
        expect(caseMatrice(2, 1)).toHaveClass('matrix-conflict-cell');
    });

    it('signale des verts qui se recouvrent, quelle que soit la valeur', () => {
        const groupes = [groupe(1, 'Nord', 0, 30), groupe(2, 'Sud', 25, 20)];
        renderMatrix({ groups: groupes, conflictMatrix: matrice(0, 15) });
        expect(caseMatrice(1, 2)).toHaveClass('matrix-conflict-cell');
    });

    it("prend les instants de la flèche d'anticipation à la place du vert", () => {
        const fleche = { id: 1, action: "Flèche d'anticipation", gf: '1', deb: '0', fin: '22' };
        renderMatrix({ actionData: [fleche] });
        // Fin de la flèche à 22, début de GF2 à 25 : 3 s < 5 s.
        expect(caseMatrice(1, 2)).toHaveClass('matrix-conflict-cell');
    });

    it("ignore une flèche d'anticipation incomplète", () => {
        const fleche = { id: 1, action: "Flèche d'anticipation", gf: '1', deb: '0', fin: '' };
        renderMatrix({ actionData: [fleche] });
        expect(caseMatrice(1, 2)).not.toHaveClass('matrix-conflict-cell');
    });

    it('signale une matrice non symétrique et la case manquante', () => {
        renderMatrix({ conflictMatrix: matrice(5, '') });
        expect(screen.getByText(/Matrice non symétrique : 1 valeur\(s\) manquante\(s\)/)).toBeInTheDocument();
        expect(screen.getByText('1→2')).toBeInTheDocument();
        expect(caseMatrice(2, 1)).toHaveClass('matrix-asymmetric-cell');
        expect(saisie(2, 1)).toHaveClass('matrix-error-input');
    });

    it('prévient la liste des conflits au survol puis à la sortie', () => {
        const onCellHover = vi.fn();
        renderMatrix({ conflictMatrix: matrice(6, 15), onCellHover });
        fireEvent.mouseEnter(caseMatrice(1, 2));
        expect(onCellHover).toHaveBeenLastCalledWith({ from: 1, to: 2, isConflict: true });
        fireEvent.mouseLeave(caseMatrice(1, 2));
        expect(onCellHover).toHaveBeenLastCalledWith(null);
        fireEvent.mouseEnter(caseMatrice(2, 1));
        expect(onCellHover).toHaveBeenLastCalledWith({ from: 2, to: 1, isConflict: false });
    });

    it('la diagonale ne réagit pas au survol', () => {
        const onCellHover = vi.fn();
        renderMatrix({ onCellHover });
        fireEvent.mouseEnter(caseMatrice(1, 1));
        expect(onCellHover).not.toHaveBeenCalled();
    });
});

describe('IntergreenMatrix — infobulle des cases', () => {
    it('explique le conflit après un court délai, et disparaît à la sortie', () => {
        vi.useFakeTimers();
        renderMatrix({ conflictMatrix: matrice(6, 15) });
        fireEvent.mouseEnter(caseMatrice(1, 2), { clientX: 10, clientY: 10 });
        expect(screen.queryByText(/Conflit/)).toBeNull();
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.getByText(
            'Conflit : intervert demandé 6 s > délai réel 5 s entre fin vert GF1 et début vert GF2.'
        )).toBeInTheDocument();
        fireEvent.mouseLeave(caseMatrice(1, 2));
        expect(screen.queryByText(/Conflit/)).toBeNull();
    });

    it('nomme le recouvrement des verts', () => {
        vi.useFakeTimers();
        const groupes = [groupe(1, 'Nord', 0, 30), groupe(2, 'Sud', 25, 20)];
        renderMatrix({ groups: groupes, conflictMatrix: matrice(3, 15) });
        fireEvent.mouseEnter(caseMatrice(1, 2));
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.getByText('Conflit : les verts de GF1 et GF2 se recouvrent.')).toBeInTheDocument();
    });

    it("ne s'affiche pas quand les infobulles sont désactivées", () => {
        vi.useFakeTimers();
        renderMatrix({ conflictMatrix: matrice(6, 15), tooltipsEnabled: false });
        fireEvent.mouseEnter(caseMatrice(1, 2));
        act(() => { vi.advanceTimersByTime(1000); });
        expect(screen.queryByText(/Conflit/)).toBeNull();
    });

    it("ne s'affiche pas pour une case sans remarque", () => {
        vi.useFakeTimers();
        renderMatrix();
        fireEvent.mouseEnter(caseMatrice(1, 2));
        act(() => { vi.advanceTimersByTime(1000); });
        expect(document.querySelector('.action-hover-tooltip')).toBeNull();
    });
});

describe('IntergreenMatrix — comparaison avec le PF1', () => {
    const pfTabs = [
        { id: 1, name: 'PF1', data: [], diagram: [], conflictMatrix: matrice(5, 15) },
        { id: 2, name: 'PF2', data: [], diagram: [], conflictMatrix: matrice(3, 17) }
    ];

    it('colore les valeurs plus fortes et plus faibles que le PF1', () => {
        renderMatrix({ conflictMatrix: matrice(3, 17), pfTabs, activePFId: 2 });
        expect(saisie(1, 2)).toHaveClass('matrix-compare-lower');
        expect(saisie(2, 1)).toHaveClass('matrix-compare-higher');
    });

    it("ne compare pas quand le PF1 lui-même est affiché", () => {
        renderMatrix({ conflictMatrix: matrice(5, 15), pfTabs, activePFId: 1 });
        expect(saisie(1, 2)).not.toHaveClass('matrix-compare-lower');
        expect(saisie(1, 2)).not.toHaveClass('matrix-compare-higher');
    });

    it("indique l'écart avec le PF1 dans l'infobulle", () => {
        vi.useFakeTimers();
        renderMatrix({ conflictMatrix: matrice(3, 17), pfTabs, activePFId: 2 });
        fireEvent.mouseEnter(caseMatrice(2, 1));
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.getByText('Augmentée de 2 s vs PF de base (PF1) : 15 s → 17 s')).toBeInTheDocument();
    });

    // Cas de Thierry (19/10) : PF1 d'origine supprimé, plan réimporté puis
    // placé en premier onglet. La référence est le premier onglet.
    it('le PF1 supprimé : le premier onglet devient la référence', () => {
        const onglets = [
            { id: 4, name: 'PF_base', data: [], diagram: [], conflictMatrix: matrice(5, 15) },
            { id: 2, name: 'PF2', data: [], diagram: [], conflictMatrix: matrice(3, 17) }
        ];
        renderMatrix({ conflictMatrix: matrice(3, 17), pfTabs: onglets, activePFId: 2 });
        expect(saisie(1, 2)).toHaveClass('matrix-compare-lower');
        expect(saisie(2, 1)).toHaveClass('matrix-compare-higher');
    });

    it("un plan déplacé en tête devient la référence, et l'ancien PF1 est comparé à lui", () => {
        const onglets = [
            { id: 3, name: 'PF_base', data: [], diagram: [], conflictMatrix: matrice(3, 17) },
            { id: 1, name: 'PF1', data: [], diagram: [], conflictMatrix: matrice(5, 15) }
        ];
        const { unmount } = renderMatrix({ conflictMatrix: matrice(5, 15), pfTabs: onglets, activePFId: 1 });
        expect(saisie(1, 2)).toHaveClass('matrix-compare-higher');
        expect(saisie(2, 1)).toHaveClass('matrix-compare-lower');
        unmount();
        // Le plan de tête lui-même n'est comparé à rien.
        renderMatrix({ conflictMatrix: matrice(3, 17), pfTabs: onglets, activePFId: 3 });
        expect(document.querySelectorAll('.matrix-compare-higher, .matrix-compare-lower').length).toBe(0);
    });

    it("nomme le plan de référence dans l'infobulle", () => {
        vi.useFakeTimers();
        const onglets = [
            { id: 4, name: 'PF_base', data: [], diagram: [], conflictMatrix: matrice(5, 15) },
            { id: 2, name: 'PF2', data: [], diagram: [], conflictMatrix: matrice(3, 17) }
        ];
        renderMatrix({ conflictMatrix: matrice(3, 17), pfTabs: onglets, activePFId: 2 });
        fireEvent.mouseEnter(caseMatrice(2, 1));
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.getByText('Augmentée de 2 s vs PF de base (PF_base) : 15 s → 17 s')).toBeInTheDocument();
    });
});

describe('IntergreenMatrix — secondes lucarnes', () => {
    const lucarne = (deb, fin) => ({ id: 7, action: 'Seconde lucarne', gf: '1', deb: String(deb), fin: String(fin) });

    it("signale une seconde lucarne trop proche du vert d'un antagoniste", () => {
        // Lucarne de GF1 finie à 24, GF2 démarre à 25 : 1 s < 5 s.
        renderMatrix({ actionData: [lucarne(22, 24)] });
        expect(screen.getByText(/Conflits Secondes Lucarnes : 1 problème\(s\)/)).toBeInTheDocument();
        expect(screen.getByText('SL 1 → 2 : 1s < 5s requis')).toBeInTheDocument();
    });

    it("signale un antagoniste qui finit trop tard avant la lucarne", () => {
        // GF2 finit à 45, lucarne de GF1 de 50 à 55 : 5 s < 15 s.
        renderMatrix({ actionData: [lucarne(50, 55)] });
        expect(screen.getByText('2 → SL 1 : 5s < 15s requis')).toBeInTheDocument();
    });

    it('signale une lucarne qui chevauche le vert principal de son groupe', () => {
        renderMatrix({ actionData: [lucarne(10, 15)] });
        expect(screen.getByText('SL 1 chevauche le vert principal')).toBeInTheDocument();
    });

    it("signale deux lucarnes antagonistes trop rapprochées", () => {
        const actions = [
            lucarne(48, 50),
            { id: 8, action: 'Seconde lucarne', gf: '2', deb: '52', fin: '55' }
        ];
        renderMatrix({ actionData: actions, conflictMatrix: matrice(5, 0) });
        expect(screen.getByText('SL 1 → SL 2 : 2s < 5s requis')).toBeInTheDocument();
    });

    it('ne dit rien pour une lucarne bien placée', () => {
        renderMatrix({ actionData: [lucarne(21, 22)], conflictMatrix: matrice(3, 15) });
        expect(screen.queryByText(/Conflits Secondes Lucarnes/)).toBeNull();
    });
});
