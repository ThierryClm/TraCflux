import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuggestionCycleDialog from './SuggestionCycleDialog';

// TD « carrefour en croix avec couloir bus d'approche ».
const g = (id, name, minGreen) => ({ id, name, type: 'V', minGreen, offset: 0, laneCoef: 1, durations: { green: 10, orange: 3, red: 57 } });
const groups = [g(1, 'V1', 8), g(2, 'V2', 8), g(3, 'B3', 6), g(4, 'V4', 8), g(5, 'V5', 8)];
const trafic = { 1: 600, 2: 500, 3: 24, 4: 380, 5: 300 };
const matrice = Array.from({ length: 5 }, () => Array(5).fill(''));
matrice[1][2] = 4; matrice[2][3] = 6; matrice[3][0] = 6;

const ouvrir = (props = {}) => {
    const setCycleLength = vi.fn();
    const setPhasageCycle = vi.fn();
    render(<SuggestionCycleDialog isOpen onClose={() => {}} planName="PF1" groups={groups} conflictMatrix={matrice}
        cycleLength={70} getTrafficData={id => ({ trafficVol: trafic[id] })} trafficDatasetName="HPM"
        phasageCycle={null} setPhasageCycle={setPhasageCycle} setCycleLength={setCycleLength} {...props} />);
    return { setCycleLength, setPhasageCycle };
};

describe('suggestion de durée du cycle', () => {
    it('saisie des groupes déterminants, dégagement à préciser, cycle de Webster appliqué', () => {
        const { setCycleLength, setPhasageCycle } = ouvrir();
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
        expect(screen.getByText(/Cycle optimal de Webster/).textContent).toContain('66 s');
        fireEvent.click(screen.getByRole('button', { name: 'Appliquer le cycle (66 s)' }));
        expect(setCycleLength).toHaveBeenCalledWith(66);
        expect(setPhasageCycle).toHaveBeenCalledWith({ determinants: [1, 3, 4], degagements: [4, 6, 6], tauxVise: 85 });
    });

    it('reprend le phasage enregistré avec le plan', () => {
        ouvrir({ phasageCycle: { determinants: [1, 3, 4], degagements: [4, 6, 6], tauxVise: 80 } });
        expect(screen.getByLabelText('Groupe déterminant de la phase 2')).toHaveValue('3');
        expect(screen.getByLabelText('Taux de saturation visé')).toHaveValue(80);
        expect(screen.getByText(/Cycle optimal de Webster/).textContent).toContain('66 s');
    });

    it('sans trafic pour les déterminants, le dit', () => {
        ouvrir({ getTrafficData: () => ({ trafficVol: 0 }), phasageCycle: { determinants: [1, 4], degagements: [6, 6] } });
        expect(screen.getByText(/Aucun trafic pour ces groupes/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Appliquer le cycle/ })).toBeDisabled();
    });
});
