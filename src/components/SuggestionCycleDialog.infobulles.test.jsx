import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SuggestionCycleDialog from './SuggestionCycleDialog';

/** Case « Assistant conception » de Mise en page → Infobulles. */

const g = (id, name) => ({ id, name, type: 'V', minGreen: 8, offset: 0, laneCoef: 1, durations: { green: 10, orange: 3, red: 57 } });
const groups = [g(1, 'V1'), g(2, 'V2')];
const matrice = [['', 4], [4, '']];

const ouvrir = (props = {}) => render(
    <SuggestionCycleDialog isOpen onClose={() => {}} planName="PF1" groups={groups} conflictMatrix={matrice}
        cycleLength={70} getTrafficData={() => ({ trafficVol: 500 })} trafficDatasetName="HPM" phasageCycle={null}
        setCycleLength={vi.fn()} setPhasageCycle={vi.fn()} setPhasageBulleCount={vi.fn()}
        setPhasageBulleTimes={vi.fn()} updateGroupParams={vi.fn()} {...props} />
);

describe('infobulles de l\'assistant conception', () => {
    it('par défaut, les chapitres et la fenêtre portent leurs infobulles', () => {
        const { container } = ouvrir();
        const chapitre = screen.getByRole('button', { name: /Phases et groupes déterminants/ });
        expect(chapitre).toHaveAttribute('title');
        expect(screen.getByRole('button', { name: 'Enregistrer le phasage' })).toHaveAttribute('title');
        expect(container.ownerDocument.querySelector('.modal-header')).toHaveAttribute('title');
    });

    it('case décochée : plus aucune infobulle, le titre de la fenêtre reste affiché', () => {
        ouvrir({ tooltipsEnabled: false });
        expect(screen.getByRole('button', { name: /Phases et groupes déterminants/ })).not.toHaveAttribute('title');
        expect(screen.getByRole('button', { name: 'Enregistrer le phasage' })).not.toHaveAttribute('title');
        expect(screen.getByRole('button', { name: /Appliquer le cycle/ })).not.toHaveAttribute('title');
        expect(document.querySelector('.modal-header')).not.toHaveAttribute('title');
        expect(document.querySelectorAll('.suggestion-cycle [title]')).toHaveLength(0);
        expect(screen.getByRole('heading', { name: /Assistant conception — PF1/ })).toBeInTheDocument();
    });

    it('fenêtre détachée : la case s\'applique aussi', () => {
        const { container } = ouvrir({ tooltipsEnabled: false, detachee: true });
        expect(container.querySelectorAll('[title]')).toHaveLength(0);
    });
});
