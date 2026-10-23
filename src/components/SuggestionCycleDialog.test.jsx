import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SuggestionCycleDialog from './SuggestionCycleDialog';

// TD « carrefour en croix avec couloir bus d'approche ».
const g = (id, name, minGreen) => ({ id, name, type: 'V', minGreen, offset: 0, laneCoef: 1, durations: { green: 10, orange: 3, red: 57 } });
const groups = [g(1, 'V1', 8), g(2, 'V2', 8), g(3, 'B3', 6), g(4, 'V4', 8), g(5, 'V5', 8)];
const trafic = { 1: 600, 2: 500, 3: 24, 4: 380, 5: 300 };
const matrice = Array.from({ length: 5 }, () => Array(5).fill(''));
matrice[1][2] = 4; matrice[2][3] = 6; matrice[3][0] = 6;

const ouvrir = (props = {}) => {
    const f = { setCycleLength: vi.fn(), setPhasageCycle: vi.fn(), setPhasageBulleCount: vi.fn(), setPhasageBulleTimes: vi.fn(), updateGroupParams: vi.fn() };
    render(<SuggestionCycleDialog isOpen onClose={() => {}} planName="PF1" groups={groups} conflictMatrix={matrice}
        cycleLength={70} getTrafficData={id => ({ trafficVol: trafic[id] })} trafficDatasetName="HPM"
        phasageCycle={null} {...f} {...props} />);
    return f;
};

describe('suggestion de durée du cycle', () => {
    it('saisie des groupes déterminants, dégagement à préciser, cycle de Webster appliqué', () => {
        const { setCycleLength, setPhasageCycle, setPhasageBulleCount, setPhasageBulleTimes, updateGroupParams } = ouvrir();
        fireEvent.change(screen.getByLabelText('Nombre de phases'), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText('Groupe déterminant de la phase 1'), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText('Groupe déterminant de la phase 2'), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText('Groupe déterminant de la phase 3'), { target: { value: '4' } });
        // V1 → B3 est vide dans la matrice : le dégagement est à préciser.
        expect(screen.getByLabelText('Dégagement de la phase 1 vers la phase 2')).toHaveValue(null);
        expect(screen.getByText(/Précisez le dégagement après la phase 1/)).toBeInTheDocument();
        expect(screen.getByLabelText('Dégagement de la phase 2 vers la phase 3')).toHaveValue(6);
        expect(screen.getByLabelText('Dégagement de la phase 3 vers la phase 1')).toHaveValue(6);
        fireEvent.change(screen.getByLabelText('Dégagement de la phase 1 vers la phase 2'), { target: { value: '4' } });
        expect(screen.getByText(/temps perdu L =/).textContent).toContain('16 s');
        expect(screen.getByText(/Cycle optimal de Webster/).textContent).toMatch(/65,6 s.*cycle proposé de 70 s/);
        // Les groupes ont déjà un vert : le diagramme n'est pas touché.
        expect(updateGroupParams).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Appliquer le cycle (70 s)' }));
        expect(setCycleLength).not.toHaveBeenCalled(); // le plan est déjà à 70 s
        expect(setPhasageCycle).toHaveBeenCalledWith({ determinants: [1, 3, 4], degagements: [4, 6, 6], tauxVise: 85 });
        // Phasage bulle : une bulle par phase, au milieu du vert de chaque déterminant (lu dans le diagramme).
        expect(setPhasageBulleCount).toHaveBeenCalledWith(3);
        expect(setPhasageBulleTimes).toHaveBeenCalledWith([5, 5, 5, 0, 0, 0]);
    });

    it('reprend le phasage enregistré avec le plan', () => {
        ouvrir({ phasageCycle: { determinants: [1, 3, 4], degagements: [4, 6, 6], tauxVise: 80 } });
        expect(screen.getByLabelText('Groupe déterminant de la phase 2')).toHaveValue('3');
        expect(screen.getByLabelText('Taux de saturation visé')).toHaveValue(80);
        expect(screen.getByText(/Cycle optimal de Webster/).textContent).toContain('70 s');
    });

    it('sans trafic pour les déterminants, le dit', () => {
        ouvrir({ getTrafficData: () => ({ trafficVol: 0 }), phasageCycle: { determinants: [1, 4], degagements: [6, 6] } });
        expect(screen.getByText(/Aucun trafic pour ces groupes/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Appliquer le cycle/ })).toBeDisabled();
    });

    it('déterminants sans vert (Déb/Fin vides) : diagramme pré-rempli à la position proposée', () => {
        const vides = groups.map(gr => ({ ...gr, durations: { green: 0, orange: 3, red: 0 } }));
        const { updateGroupParams } = ouvrir({ groups: vides, phasageCycle: { determinants: [1, 3, 4], degagements: [4, 6, 6] } });
        // Cycle proposé 70 s : V1 0 → 29 s, B3 33 → 39 s, V4 45 → 64 s.
        expect(updateGroupParams).toHaveBeenCalledWith(1, { offset: 0, durations: { green: 29 } });
        expect(updateGroupParams).toHaveBeenCalledWith(3, { offset: 33, durations: { green: 6 } });
        expect(updateGroupParams).toHaveBeenCalledWith(4, { offset: 45, durations: { green: 19 } });
        expect(screen.getByText(/Diagramme pré-rempli/)).toBeInTheDocument();
    });

    it('case décochée : le phasage bulle n\'est pas modifié', () => {
        const { setPhasageBulleCount } = ouvrir({ phasageCycle: { determinants: [1, 3, 4], degagements: [4, 6, 6] } });
        fireEvent.click(screen.getByRole('checkbox', { name: /phasage bulle/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le phasage' }));
        expect(setPhasageBulleCount).not.toHaveBeenCalled();
    });

    it('diagramme renseigné : chemin critique pré-rempli (plus forte capacité utilisée)', () => {
        const pos = { 1: [0, 28], 2: [0, 28], 3: [32, 6], 4: [44, 20], 5: [44, 20] };
        const remplis = groups.map(gr => ({ ...gr, offset: pos[gr.id][0], durations: { green: pos[gr.id][1], orange: 3, red: 70 - pos[gr.id][1] - 3 } }));
        ouvrir({ groups: remplis });
        expect(screen.getByText(/Proposition lue sur le diagramme/)).toBeInTheDocument();
        expect(screen.getByLabelText('Groupe déterminant de la phase 1')).toHaveValue('1');
        expect(screen.getByLabelText('Groupe déterminant de la phase 2')).toHaveValue('3');
        expect(screen.getByLabelText('Groupe déterminant de la phase 3')).toHaveValue('4');
        expect(screen.getByLabelText('Dégagement de la phase 1 vers la phase 2')).toHaveValue(4);
        expect(within(document.querySelector('.sc-table')).getByText('83 %')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Relire le diagramme' })).toBeInTheDocument();
    });

    it('groupes associés : placement déduit de la matrice, avec sa source', () => {
        const vides = groups.map(gr => ({ ...gr, durations: { green: 0, orange: 3, red: 0 } }));
        const m = matrice.map(r => [...r]);
        m[1][3] = 5; m[3][1] = 5; m[4][0] = 6; m[0][4] = 5; m[4][2] = 5; m[2][4] = 5; m[1][4] = 6; m[4][1] = 5;
        const { updateGroupParams } = ouvrir({ groups: vides, conflictMatrix: m, phasageCycle: { determinants: [1, 3, 4], degagements: [4, 6, 6] } });
        const tableau = screen.getByLabelText('Groupes associés');
        expect(within(tableau).getByText(/GF2 V2/)).toBeInTheDocument();
        expect(within(tableau).getAllByText('Matrice').length).toBeGreaterThan(0);
        updateGroupParams.mockClear();
        expect(screen.queryByRole('button', { name: /Placer/ })).toBeNull();
        expect(within(tableau).queryByRole('checkbox')).toBeNull();
        expect(within(tableau).getAllByText('avec le cycle').length).toBeGreaterThan(0);
        // Rien n'est placé avant « Appliquer le cycle », qui règle d'abord le cycle.
        expect(updateGroupParams).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /Appliquer le cycle/ }));
        expect(updateGroupParams).toHaveBeenCalledWith(2, expect.objectContaining({ offset: 0 }));
        expect(updateGroupParams).toHaveBeenCalledWith(5, expect.objectContaining({ offset: 45 }));
    });

    it('groupes associés : calés sur le cycle proposé, pas sur le cycle actuel du plan', () => {
        // Déterminants déjà posés aux positions proposées pour 70 s, plan encore à 100 s :
        // la fermeture du piéton P6 dépend du rebouclage sur V1 (P6→V1 8 s).
        const pose = { 1: [0, 29], 3: [33, 6], 4: [45, 19] };
        const avecP6 = [...groups, { id: 6, name: 'P6', type: 'P', minGreen: 7, offset: 0, laneCoef: 1, durations: { green: 0, orange: 8, red: 0 } }]
            .map(gr => ({ ...gr, offset: pose[gr.id]?.[0] ?? 0, durations: { ...gr.durations, green: pose[gr.id]?.[1] ?? 0 } }));
        const m = Array.from({ length: 6 }, (_, i) => [...(matrice[i] ?? Array(5).fill('')), '']);
        m[1][3] = 5; m[3][1] = 5; m[4][0] = 6; m[0][4] = 5; m[4][2] = 5; m[2][4] = 5; m[1][4] = 6; m[4][1] = 5;
        m[0][5] = 4; m[1][5] = 6; m[2][5] = 7; m[5][0] = 8; m[5][1] = 6; m[5][2] = 6;
        const { updateGroupParams } = ouvrir({ groups: avecP6, conflictMatrix: m, cycleLength: 100,
            getTrafficData: id => ({ trafficVol: trafic[id] ?? 0 }), phasageCycle: { determinants: [1, 3, 4], degagements: [4, 6, 6] } });
        expect(screen.getByText(/calés sur le cycle proposé de 70 s/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Appliquer le cycle/ }));
        // Sur 70 s, P6 doit fermer 8 s avant le retour de V1 (fin à 62 s), et non avec V4 à 64 s.
        expect(updateGroupParams).toHaveBeenCalledWith(6, { offset: 46, durations: { green: 16 } });
    });

    it('adaptatifs verticaux : proposés par phase, inscrits par « Appliquer le cycle » en remplaçant les AV précédents', () => {
        const pose = { 1: [0, 29], 2: [0, 29], 3: [33, 6], 4: [45, 19], 5: [45, 19] };
        const places = groups.map(gr => ({ ...gr, offset: pose[gr.id][0], durations: { ...gr.durations, green: pose[gr.id][1] } }));
        const ajouterActions = vi.fn(lignes => lignes.length);
        ouvrir({ groups: places, ajouterActions, phasageCycle: { determinants: [1, 3, 4], degagements: [4, 6, 6] } });
        const bloc = screen.getByLabelText('Adaptatifs verticaux');
        // Taux visé des zones : 90 % par défaut (85 % pour le cycle).
        expect(within(bloc).getByLabelText('Taux visé des adaptatifs')).toHaveValue(90);
        expect(within(bloc).getByText('22 – 29 s')).toBeInTheDocument();
        expect(within(bloc).getByText('59 – 64 s')).toBeInTheDocument();
        expect(within(bloc).getByText(/vert mini de B3/)).toBeInTheDocument();
        expect(within(bloc).getByText(/58 s avec toutes les zones contractées/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Contraction de phase' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Appliquer le cycle/ }));
        const [lignes, remplacer] = ajouterActions.mock.calls[0];
        expect(lignes).toEqual([
            { gf: '1', action: 'Adaptatif vertical', deb: '22', fin: '29', abrv: 'AV1', description: 'Contraction théorique', micro: 'Contraction si absence de demande sur V1' },
            { gf: '4', action: 'Adaptatif vertical', deb: '59', fin: '64', abrv: 'AV3', description: 'Contraction théorique', micro: 'Contraction si absence de demande sur V4' },
        ]);
        // Remplacés : les AVn de l'assistant ; conservés : les autres adaptatifs et conditions.
        expect(remplacer({ action: 'Adaptatif vertical', abrv: 'AV2' })).toBe(true);
        expect(remplacer({ action: 'Adaptatif vertical', abrv: 'DA1' })).toBe(false);
        expect(remplacer({ action: 'Point de repos', abrv: 'AV1' })).toBe(false);
        expect(within(bloc).getByText(/Inscrits : AV1, AV3/)).toBeInTheDocument();
    });

    it('adaptatifs verticaux : mode prudent, chaque zone calculée seule', () => {
        const pose = { 1: [0, 29], 2: [0, 29], 3: [33, 6], 4: [45, 19], 5: [45, 19] };
        const places = groups.map(gr => ({ ...gr, offset: pose[gr.id][0], durations: { ...gr.durations, green: pose[gr.id][1] } }));
        ouvrir({ groups: places, ajouterActions: vi.fn(), phasageCycle: { determinants: [1, 3, 4], degagements: [4, 6, 6] } });
        const bloc = screen.getByLabelText('Adaptatifs verticaux');
        fireEvent.change(within(bloc).getByLabelText('Mode de calcul des adaptatifs'), { target: { value: 'prudent' } });
        expect(within(bloc).getByText('25 – 29 s')).toBeInTheDocument();
        expect(within(bloc).getByText('61 – 64 s')).toBeInTheDocument();
        expect(within(bloc).getByText(/63 s avec toutes les zones contractées/)).toBeInTheDocument();
        // Taux des zones ramené à 85 % : zones plus courtes.
        fireEvent.change(within(bloc).getByLabelText('Taux visé des adaptatifs'), { target: { value: '85' } });
        expect(within(bloc).getByText('27 – 29 s')).toBeInTheDocument();
    });

    it('fenêtre détachée : le contenu seul, sans voile ni cadre de modale', () => {
        const { onClose } = { onClose: vi.fn() };
        ouvrir({ detachee: true, onClose });
        expect(document.querySelector('.modal-overlay')).toBeNull();
        expect(document.querySelector('.suggestion-cycle.sc-detachee')).not.toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
        expect(onClose).toHaveBeenCalled();
    });
});
