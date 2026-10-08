import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from './ConfirmProvider';
import RelinkDossierDialog from './RelinkDossierDialog';

const intersection = {
    projectName: 'Car 1 ancien',
    distance: 400,
    cycleLength: 100,
    selectedPfId: 1,
    selectedGroup1: 1,
    selectedGroup2: 5,
    pfTabs: [{ id: 1, name: 'HPM' }],
    groups: [{ id: 1, name: 'Nord' }, { id: 5, name: 'Sud' }]
};

const renderDialog = (props = {}) => {
    const onConfirm = vi.fn();
    render(
        <ConfirmProvider>
            <RelinkDossierDialog
                intersection={intersection}
                onClose={vi.fn()}
                onConfirm={onConfirm}
                listProjects={() => ['Car 1 ancien', 'Car 1 v2']}
                loadProjectData={() => ({ cycleLength: 90, groups: [{ id: 1, name: 'Nord' }, { id: 7, name: 'Sud' }], pfTabs: [{ id: 3, name: 'HPM', cycleLength: 90 }] })}
                {...props}
            />
        </ConfirmProvider>
    );
    return { onConfirm };
};

describe('RelinkDossierDialog', () => {
    it('relie le carrefour au dossier choisi après un récapitulatif', () => {
        const { onConfirm } = renderDialog();
        expect(screen.getByText('Car 1 ancien (actuel)')).toBeTruthy();

        fireEvent.click(screen.getByText('Car 1 v2'));
        fireEvent.click(screen.getByText('Suivant'));

        expect(screen.getByText(/Dossier : Car 1 ancien → Car 1 v2/)).toBeTruthy();
        expect(screen.getByText(/Cycle : 100 s → 90 s/)).toBeTruthy();
        expect(screen.getByText(/G5 - Sud → G7 - Sud \(retrouvé par son nom\)/)).toBeTruthy();

        fireEvent.click(screen.getByText('Relier ce dossier'));
        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            projectName: 'Car 1 v2', distance: 400, selectedPfId: 3, selectedGroup1: 1, selectedGroup2: 7, cycleLength: 90
        }));
    });

    it("ne s'affiche pas sans carrefour", () => {
        renderDialog({ intersection: null });
        expect(screen.queryByText('Suivant')).toBeNull();
    });
});
