import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupTable from './GroupTable';

const groupe = (id, name, type) => ({ id, name, type, courant: '', minGreen: 6, offset: 0, durations: { green: 10, orange: 3, red: 57 } });
const groups = [groupe(1, 'V1', 'V'), groupe(2, 'P6', 'P'), groupe(3, 'C1', 'CY')];

describe('formulaire : infobulles des colonnes Mini et Jaune (ISR, 6e partie)', () => {
    it('le jaune d\'un piéton est son temps de dégagement ; celui d\'un véhicule, 3 s ou 5 s', () => {
        render(<GroupTable groups={groups} updateGroupParams={vi.fn()} cycleLength={70} />);
        const jaunes = document.querySelectorAll('.input-yellow');
        expect(jaunes[0].getAttribute('title')).toMatch(/3 s en agglomération, 5 s hors agglomération/);
        expect(jaunes[1].getAttribute('title')).toMatch(/Temps de dégagement piéton.*R12 n'ont pas de jaune/);
        expect(jaunes[2].getAttribute('title')).toMatch(/dégagement du cycle/);
        expect(screen.getByText('Jaune').getAttribute('title')).toMatch(/Piétons : temps de dégagement/);
        expect(screen.getByText('Mini').getAttribute('title')).toMatch(/6 s au moins/);
    });

    it('infobulles coupées : aucun title', () => {
        render(<GroupTable groups={groups} updateGroupParams={vi.fn()} cycleLength={70} tooltipsEnabled={false} />);
        expect(document.querySelector('.input-yellow').getAttribute('title')).toBeNull();
    });
});
