import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ActionTable from './ActionTable';
import ConfirmProvider from './ConfirmProvider';
import { createEmptyActionData } from '../utils/pfHelpers';

// Les fenêtres détachées ne s'ouvrent pas dans jsdom : on vérifie seulement
// que le tableau leur est confié.
const popups = vi.hoisted(() => ({ conditions: vi.fn(), variables: vi.fn() }));
vi.mock('../hooks/usePopupWindow', () => ({
    default: ({ geometryKey }) => ({ renderToPopup: popups[geometryKey] })
}));

const CHAMPS = ['gf', 'action', 'description', 'deb', 'fin', 'abrv', 'micro',
    'plage1', 'plage2', 'actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'];

// Les 30 lignes d'un plan, les premières remplies avec `lignes`.
const donnees = (...lignes) => {
    const data = createEmptyActionData();
    lignes.forEach((ligne, i) => { data[i] = { ...data[i], ...ligne }; });
    return data;
};

const renderTable = (props = {}) => {
    const handlers = {
        updateActionRow: vi.fn(),
        reorderActions: vi.fn(),
        setHoveredActionId: vi.fn(),
        updateMicroCustomField: vi.fn(),
        setShowFloatingConditions: vi.fn(),
        setShowFloatingVariables: vi.fn(),
        setActionColWidths: vi.fn(),
    };
    const allProps = {
        actionData: donnees(),
        cycleLength: 100,
        maxGroup: 8,
        hoveredActionId: null,
        showFloatingConditions: false,
        showFloatingVariables: false,
        microCustomFields: [],
        ...handlers,
        ...props,
    };
    const utils = render(<ConfirmProvider><ActionTable {...allProps} /></ConfirmProvider>);
    return { ...utils, ...allProps };
};

const lignesCorps = () => Array.from(document.querySelectorAll('.action-table tbody tr'));
const ligne = (i) => lignesCorps()[i];
// Colonnes avec Description : GF, Action, Description, Déb, Fin, Abrv,
// Action_Micro, Plage 1, Plage 2, Action GF 1 à 4.
const cellule = (i, col) => ligne(i).querySelectorAll('td')[col];
const champ = (i, col) => cellule(i, col).querySelector('input, select, textarea');
const COL = { gf: 0, action: 1, description: 2, deb: 3, fin: 4, abrv: 5, micro: 6,
    plage1: 7, plage2: 8, actGf1: 9, actGf1Gf2: 10, actGf1Gf3: 11, actGf1Gf4: 12 };

// Applique un « updater » passé à un setter React à une valeur de départ.
const appliquer = (setter, depart) => {
    const arg = setter.mock.calls.at(-1)[0];
    return typeof arg === 'function' ? arg(depart) : arg;
};

beforeEach(() => {
    localStorage.clear();
    popups.conditions.mockClear();
    popups.variables.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ActionTable — lignes affichées', () => {
    it("n'affiche qu'une ligne vide de saisie quand le plan est vide", () => {
        renderTable();
        expect(lignesCorps()).toHaveLength(1);
        expect(champ(0, COL.gf)).toHaveValue(null);
    });

    it('affiche toutes les conditions remplies, puis une seule ligne vide', () => {
        renderTable({ actionData: donnees(
            { gf: '1', action: 'Escamotage' },
            { gf: '2', action: 'Point de repos', deb: '10' }
        ) });
        expect(lignesCorps()).toHaveLength(3);
        expect(champ(0, COL.gf)).toHaveValue(1);
        expect(champ(1, COL.action)).toHaveValue('Point de repos');
        expect(champ(1, COL.deb)).toHaveValue('10');
    });

    // Signalé par Thierry (19/10) : une condition supprimée laisse une ligne
    // vide au milieu ; la saisie s'y faisait, et la nouvelle condition
    // remontait au milieu du tableau dès le premier chiffre.
    it('la ligne de saisie suit la dernière condition, pas le trou laissé par une suppression', () => {
        const actionData = donnees(
            { gf: '7', action: 'Escamotage' },
            {},
            { gf: '3', action: 'Point de repos' }
        );
        const { updateActionRow } = renderTable({ actionData });
        expect(lignesCorps()).toHaveLength(3);
        fireEvent.change(champ(2, COL.gf), { target: { value: '5' } });
        // La 4e ligne (après le 3), et non la 2e (le trou entre 7 et 3).
        expect(updateActionRow).toHaveBeenCalledWith(actionData[3].id, 'gf', '5');
    });

    it('sans ligne libre après la dernière condition, le trou du milieu sert de ligne de saisie', () => {
        const actionData = donnees();
        actionData.forEach((row, i) => { if (i !== 4) { row.gf = '1'; row.action = 'Escamotage'; } });
        const { updateActionRow } = renderTable({ actionData });
        expect(lignesCorps()).toHaveLength(30);
        fireEvent.change(champ(29, COL.gf), { target: { value: '2' } });
        expect(updateActionRow).toHaveBeenCalledWith(actionData[4].id, 'gf', '2');
    });

    it('une ligne avec seulement une description compte comme remplie', () => {
        renderTable({ actionData: donnees({ description: 'note' }) });
        expect(lignesCorps()).toHaveLength(2);
    });

    it('propose toutes les actions de micro-régulation', () => {
        renderTable();
        const options = within(champ(0, COL.action)).getAllByRole('option').map(o => o.value);
        expect(options).toEqual(expect.arrayContaining([
            '', 'Adaptatif vertical', 'Escamotage', 'Escamotage de phase',
            "Flèche d'anticipation", 'Point de repos', 'Seconde lucarne', 'Synchro BTS'
        ]));
        expect(options).toHaveLength(16);
    });

    it('masque la colonne Description sur demande', () => {
        renderTable({ showDescription: false, actionData: donnees({ gf: '1', description: 'x' }) });
        expect(screen.queryByText('Description')).toBeNull();
        expect(ligne(0).querySelectorAll('td')).toHaveLength(12);
    });
});

describe('ActionTable — saisie', () => {
    it('accepte un numéro de groupe entre 0 et le dernier groupe', () => {
        const { updateActionRow } = renderTable();
        fireEvent.change(champ(0, COL.gf), { target: { value: '3' } });
        expect(updateActionRow).toHaveBeenCalledWith(1, 'gf', '3');
        fireEvent.change(champ(0, COL.gf), { target: { value: '0' } });
        expect(updateActionRow).toHaveBeenCalledWith(1, 'gf', '0');
    });

    it('accepte le dernier groupe et refuse au-delà', () => {
        const { updateActionRow } = renderTable({ maxGroup: 8 });
        fireEvent.change(champ(0, COL.gf), { target: { value: '9' } });
        expect(updateActionRow).not.toHaveBeenCalled();
        fireEvent.change(champ(0, COL.gf), { target: { value: '8' } });
        expect(updateActionRow).toHaveBeenCalledWith(1, 'gf', '8');
    });

    it('accepte de vider le numéro de groupe', () => {
        const { updateActionRow } = renderTable({ actionData: donnees({ gf: '2', action: 'Escamotage' }) });
        fireEvent.change(champ(0, COL.gf), { target: { value: '' } });
        expect(updateActionRow).toHaveBeenCalledWith(1, 'gf', '');
    });

    it('applique la même règle aux plages et aux groupes d’action', () => {
        const { updateActionRow } = renderTable({ actionData: donnees({ gf: '1', action: 'Adaptatif vertical' }) });
        fireEvent.change(champ(0, COL.plage1), { target: { value: '4' } });
        fireEvent.change(champ(0, COL.plage2), { target: { value: '12' } });
        expect(updateActionRow).toHaveBeenCalledWith(1, 'plage1', '4');
        expect(updateActionRow).not.toHaveBeenCalledWith(1, 'plage2', '12');
    });

    it('enregistre le début à la sortie du champ', () => {
        const { updateActionRow } = renderTable({ actionData: donnees({ gf: '1', action: 'Escamotage' }) });
        const deb = champ(0, COL.deb);
        fireEvent.focus(deb);
        fireEvent.change(deb, { target: { value: '42' } });
        fireEvent.blur(deb);
        expect(updateActionRow).toHaveBeenCalledWith(1, 'deb', '42');
    });

    it('enregistre la description, l’abréviation et le texte micro', () => {
        const { updateActionRow } = renderTable({ actionData: donnees({ gf: '1', action: 'Escamotage' }) });
        fireEvent.change(champ(0, COL.description), { target: { value: 'Bus' } });
        fireEvent.change(champ(0, COL.abrv), { target: { value: 'ESC' } });
        fireEvent.change(champ(0, COL.micro), { target: { value: 'Si DET1' } });
        expect(updateActionRow).toHaveBeenCalledWith(1, 'description', 'Bus');
        expect(updateActionRow).toHaveBeenCalledWith(1, 'abrv', 'ESC');
        expect(updateActionRow).toHaveBeenCalledWith(1, 'micro', 'Si DET1');
    });
});

describe('ActionTable — champs selon l’action', () => {
    it('Point de repos : pas de fin ni de groupes d’action', () => {
        renderTable({ actionData: donnees({ gf: '1', action: 'Point de repos' }) });
        expect(champ(0, COL.fin)).toBeDisabled();
        expect(champ(0, COL.actGf1)).toBeDisabled();
        expect(champ(0, COL.actGf1Gf4)).toBeDisabled();
        expect(champ(0, COL.plage1)).not.toBeDisabled();
    });

    it('Seconde lucarne : ni plages ni groupes d’action, mais une fin', () => {
        renderTable({ actionData: donnees({ gf: '1', action: 'Seconde lucarne' }) });
        expect(champ(0, COL.fin)).not.toBeDisabled();
        expect(champ(0, COL.plage1)).toBeDisabled();
        expect(champ(0, COL.plage2)).toBeDisabled();
        expect(champ(0, COL.actGf1)).toBeDisabled();
    });

    it('Début de bande passante : seul le premier groupe d’action reste ouvert', () => {
        renderTable({ actionData: donnees({ gf: '1', action: 'Début de bande passante' }) });
        expect(champ(0, COL.actGf1)).not.toBeDisabled();
        expect(champ(0, COL.actGf1Gf2)).toBeDisabled();
        expect(champ(0, COL.actGf1Gf3)).toBeDisabled();
        expect(champ(0, COL.actGf1Gf4)).toBeDisabled();
    });

    it('Escamotage : groupes d’action ouverts, plages fermées', () => {
        renderTable({ actionData: donnees({ gf: '1', action: 'Escamotage' }) });
        expect(champ(0, COL.actGf1Gf4)).not.toBeDisabled();
        expect(champ(0, COL.plage1)).toBeDisabled();
    });

    it('Fermeture anticipée : l’infobulle nomme le groupe glissé', () => {
        renderTable({ actionData: donnees({ gf: '1', action: 'Fermeture anticipée', actGf1: '3' }) });
        expect(champ(0, COL.actGf1)).toHaveAttribute('title', 'Glissement sur GF 3');
    });

    it('choisir Point de repos vide la fin et les groupes d’action, et amorce le texte micro', () => {
        const { updateActionRow } = renderTable({ actionData: donnees({ gf: '1', action: 'Escamotage', fin: '20', actGf1: '2' }) });
        fireEvent.change(champ(0, COL.action), { target: { value: 'Point de repos' } });
        expect(updateActionRow).toHaveBeenCalledWith(1, 'action', 'Point de repos');
        expect(updateActionRow).toHaveBeenCalledWith(1, 'fin', '');
        expect(updateActionRow).toHaveBeenCalledWith(1, 'micro', 'Attente quittée si ');
        ['actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'].forEach(f =>
            expect(updateActionRow).toHaveBeenCalledWith(1, f, ''));
    });

    it('choisir Point de repos garde un texte micro déjà saisi', () => {
        const { updateActionRow } = renderTable({ actionData: donnees({ gf: '1', action: 'Escamotage', micro: 'Si BP' }) });
        fireEvent.change(champ(0, COL.action), { target: { value: 'Point de repos' } });
        expect(updateActionRow).not.toHaveBeenCalledWith(1, 'micro', expect.anything());
    });

    it('choisir Escamotage vide les plages', () => {
        const { updateActionRow } = renderTable({ actionData: donnees({ gf: '1', action: 'Adaptatif vertical', plage1: '1', plage2: '4' }) });
        fireEvent.change(champ(0, COL.action), { target: { value: 'Escamotage' } });
        expect(updateActionRow).toHaveBeenCalledWith(1, 'plage1', '');
        expect(updateActionRow).toHaveBeenCalledWith(1, 'plage2', '');
        expect(updateActionRow).not.toHaveBeenCalledWith(1, 'actGf1', '');
    });

    it('choisir Fin de bande passante ne vide que les groupes d’action 2 à 4', () => {
        const { updateActionRow } = renderTable({ actionData: donnees({ gf: '1', action: 'Escamotage', actGf1: '2', actGf1Gf2: '3' }) });
        fireEvent.change(champ(0, COL.action), { target: { value: 'Fin de bande passante' } });
        expect(updateActionRow).not.toHaveBeenCalledWith(1, 'actGf1', '');
        expect(updateActionRow).toHaveBeenCalledWith(1, 'actGf1Gf2', '');
        expect(updateActionRow).toHaveBeenCalledWith(1, 'actGf1Gf4', '');
    });
});

describe('ActionTable — retrait d’une action', () => {
    const remplie = { gf: '2', action: 'Escamotage', deb: '10', micro: 'Si BP' };

    it('demande confirmation puis efface toute la ligne', async () => {
        const { updateActionRow } = renderTable({ actionData: donnees(remplie) });
        fireEvent.change(champ(0, COL.action), { target: { value: '' } });
        expect(await screen.findByText('Voulez-vous supprimer toute la ligne ?')).toBeInTheDocument();
        expect(updateActionRow).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
        await vi.waitFor(() => expect(updateActionRow).toHaveBeenCalledTimes(CHAMPS.length));
        CHAMPS.forEach(f => expect(updateActionRow).toHaveBeenCalledWith(1, f, ''));
    });

    it('garde la ligne intacte si l’on annule', async () => {
        const { updateActionRow } = renderTable({ actionData: donnees(remplie) });
        fireEvent.change(champ(0, COL.action), { target: { value: '' } });
        fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
        await vi.waitFor(() => expect(screen.queryByText('Voulez-vous supprimer toute la ligne ?')).toBeNull());
        expect(updateActionRow).not.toHaveBeenCalled();
    });

    it('retire directement une action seule, sans autre donnée', async () => {
        const { updateActionRow } = renderTable({ actionData: donnees({ action: 'Escamotage' }) });
        fireEvent.change(champ(0, COL.action), { target: { value: '' } });
        await vi.waitFor(() => expect(updateActionRow).toHaveBeenCalledWith(1, 'action', ''));
        expect(screen.queryByText('Voulez-vous supprimer toute la ligne ?')).toBeNull();
    });
});

describe('ActionTable — tri', () => {
    const plan = () => donnees(
        { gf: '3', action: 'Seconde lucarne', deb: '40' },
        { gf: '1', action: 'Escamotage', deb: '' },
        { gf: '2', action: 'Adaptatif vertical', deb: '5' }
    );
    const ordre = (reorderActions, champTri) =>
        reorderActions.mock.calls.at(-1)[0].slice(0, 3).map(r => r[champTri]);

    it('trie par groupe, et garde les lignes vides à la fin', () => {
        const { reorderActions } = renderTable({ actionData: plan() });
        fireEvent.click(screen.getByText('GF ↕'));
        const rangees = reorderActions.mock.calls[0][0];
        expect(rangees).toHaveLength(30);
        expect(rangees.slice(0, 3).map(r => r.gf)).toEqual(['1', '2', '3']);
        expect(rangees.slice(3).every(r => r.gf === '' && r.action === '')).toBe(true);
    });

    it('trie par action dans l’ordre alphabétique', () => {
        const { reorderActions } = renderTable({ actionData: plan() });
        fireEvent.click(screen.getByText('Action ↕'));
        expect(ordre(reorderActions, 'action')).toEqual(['Adaptatif vertical', 'Escamotage', 'Seconde lucarne']);
    });

    it('trie par début, un début vide passant en dernier', () => {
        const { reorderActions } = renderTable({ actionData: plan() });
        fireEvent.click(screen.getByText('Déb ↕'));
        expect(ordre(reorderActions, 'deb')).toEqual(['5', '40', '']);
    });

    it('sans réordonnancement fourni, le clic sur un en-tête est sans effet', () => {
        renderTable({ actionData: plan(), reorderActions: undefined });
        expect(() => fireEvent.click(screen.getByText('GF ↕'))).not.toThrow();
    });
});

describe('ActionTable — survol', () => {
    it('signale la condition survolée au diagramme', () => {
        const { setHoveredActionId } = renderTable({ actionData: donnees({ gf: '1', action: 'Escamotage' }) });
        fireEvent.mouseEnter(ligne(0));
        expect(setHoveredActionId).toHaveBeenLastCalledWith(1);
        fireEvent.mouseLeave(ligne(0));
        expect(setHoveredActionId).toHaveBeenLastCalledWith(null);
    });

    it('ignore le survol de la ligne vide', () => {
        const { setHoveredActionId } = renderTable();
        fireEvent.mouseEnter(ligne(0));
        expect(setHoveredActionId).not.toHaveBeenCalledWith(expect.any(Number));
    });

    it('met en évidence la condition survolée sur le diagramme', () => {
        renderTable({ actionData: donnees({ gf: '1', action: 'Escamotage' }, { gf: '2', action: 'Escamotage' }), hoveredActionId: 2 });
        expect(ligne(1)).toHaveClass('row-highlighted');
        expect(ligne(0)).not.toHaveClass('row-highlighted');
    });
});

describe('ActionTable — ajout d’une condition', () => {
    it('amène le curseur sur la ligne vide', () => {
        Element.prototype.scrollIntoView = vi.fn();
        renderTable({ actionData: donnees({ gf: '1', action: 'Escamotage' }) });
        fireEvent.click(screen.getByText('+ Ajouter une condition'));
        expect(champ(1, COL.gf)).toHaveFocus();
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('se désactive une fois les 30 conditions remplies', () => {
        const pleines = createEmptyActionData().map(r => ({ ...r, gf: '1', action: 'Escamotage' }));
        renderTable({ actionData: pleines });
        const bouton = screen.getByText('+ Ajouter une condition');
        expect(bouton).toBeDisabled();
        expect(bouton).toHaveAttribute('title', 'Limite de 30 conditions atteinte');
        expect(lignesCorps()).toHaveLength(30);
    });
});

describe('ActionTable — variables micro', () => {
    it('affiche les variables saisies plus une case libre', () => {
        renderTable({ microCustomFields: ['DET1', 'BP2', '', '', ''] });
        const cases = document.querySelectorAll('.custom-field-input');
        expect(cases).toHaveLength(3);
        expect(cases[2]).toHaveAttribute('placeholder', 'Variable 3');
    });

    it('enregistre une variable modifiée', () => {
        const { updateMicroCustomField } = renderTable({ microCustomFields: ['DET1', ''] });
        fireEvent.change(document.querySelectorAll('.custom-field-input')[1], { target: { value: 'BP2' } });
        expect(updateMicroCustomField).toHaveBeenCalledWith(1, 'BP2');
    });

    it('reprend la hauteur mémorisée, bornée à 400 px', () => {
        localStorage.setItem('action_table_variables_height', '900');
        renderTable();
        expect(document.querySelector('.action-table-bottom-section')).toHaveStyle({ height: '400px' });
    });

    it('mémorise la hauteur choisie au glisser du séparateur', () => {
        renderTable();
        fireEvent.mouseDown(document.querySelector('.action-table-separator-horizontal'), { clientY: 300 });
        fireEvent.mouseMove(document, { clientY: 250 });
        fireEvent.mouseUp(document);
        expect(localStorage.getItem('action_table_variables_height')).toBe('180');
    });
});

describe('ActionTable — fenêtres détachées', () => {
    it('les boutons Détacher basculent les deux fenêtres', () => {
        const { setShowFloatingConditions, setShowFloatingVariables } = renderTable();
        const [conditions, variables] = screen.getAllByText('Détacher');
        fireEvent.click(conditions);
        expect(appliquer(setShowFloatingConditions, false)).toBe(true);
        fireEvent.click(variables);
        expect(appliquer(setShowFloatingVariables, false)).toBe(true);
    });

    it('confie le tableau à la fenêtre détachée et le retire de la page', () => {
        renderTable({ showFloatingConditions: true, actionData: donnees({ gf: '1', action: 'Escamotage' }) });
        expect(screen.queryByText('Conditions de micro-régulation')).toBeNull();
        expect(document.querySelector('.action-table')).toBeNull();
        expect(popups.conditions).toHaveBeenCalled();
        expect(popups.variables).not.toHaveBeenCalled();
        expect(document.querySelector('.col-resize-handle')).toBeNull();
    });

    it('confie les variables micro à leur fenêtre', () => {
        renderTable({ showFloatingVariables: true });
        expect(screen.queryByText('Variables micro')).toBeNull();
        expect(popups.variables).toHaveBeenCalled();
    });
});

describe('ActionTable — largeur des colonnes', () => {
    const poignee = (i) => document.querySelectorAll('.col-resize-handle')[i];

    it('applique les largeurs du projet', () => {
        renderTable({ actionColWidths: { description: 200, micro: 500, abrv: 50 } });
        const table = document.querySelector('.action-table');
        expect(table.style.getPropertyValue('--col-desc-w')).toBe('200px');
        expect(table.style.getPropertyValue('--col-micro-w')).toBe('500px');
        expect(table.style.getPropertyValue('--col-abrv-w')).toBe('50px');
    });

    it('élargit une colonne au glisser, dans ses bornes', () => {
        const { setActionColWidths } = renderTable({ actionColWidths: { description: 160 } });
        fireEvent.mouseDown(poignee(0), { clientX: 100 });
        fireEvent.mouseMove(window, { clientX: 500 });
        fireEvent.mouseUp(window);
        expect(appliquer(setActionColWidths, { description: 160 })).toEqual({ description: 350 });
    });

    it('revient à la largeur par défaut au double-clic', () => {
        const { setActionColWidths } = renderTable({ actionColWidths: { micro: 650 } });
        fireEvent.doubleClick(poignee(2));
        expect(appliquer(setActionColWidths, { micro: 650 })).toEqual({ micro: 420 });
    });
});
