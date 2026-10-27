import { fireEvent, render, screen } from '@testing-library/react';
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

describe('formulaire : colonne Signal (ISR, 6e partie)', () => {
    it('placée juste après Type, elle propose sans type tous les signaux par famille', () => {
        render(<GroupTable groups={[{ ...groups[0], type: '' }]} updateGroupParams={vi.fn()} cycleLength={70} />);
        const entetes = [...document.querySelectorAll('.group-table th')].map(th => th.textContent);
        expect(entetes.indexOf('Signal')).toBe(entetes.indexOf('Type') + 1);
        const liste = screen.getByLabelText('Signal du groupe 1');
        const codes = [...liste.querySelectorAll('option')].map(o => o.value);
        for (const code of ['', 'R11v', 'R11j', 'R12', 'R12m', 'R13b', 'R14tg', 'R16dtd', 'R17', 'R18td', 'R19', 'R22v', 'R24', 'R25', 'A13b']) {
            expect(codes).toContain(code);
        }
        expect(liste.querySelector('optgroup[label="R14 · Tricolores directionnels"]')).not.toBeNull();
    });

    it('le choix est enregistré et sa désignation apparaît en infobulle', () => {
        const update = vi.fn();
        const { rerender } = render(<GroupTable groups={groups} updateGroupParams={update} cycleLength={70} />);
        fireEvent.change(screen.getByLabelText('Signal du groupe 2'), { target: { value: 'R12' } });
        expect(update).toHaveBeenCalledWith(2, { signal: 'R12' });
        rerender(<GroupTable groups={[{ ...groups[0], signal: 'R14tg' }]} updateGroupParams={update} cycleLength={70} />);
        const liste = screen.getByLabelText('Signal du groupe 1');
        expect(liste.value).toBe('R14tg');
        expect(liste.getAttribute('title')).toBe('Signal tricolore directionnel, tourne-à-gauche');
    });

    it.each([
        ['V', ['R11v', 'R11j', 'R14d', 'R14tg', 'R14td', 'R14dtg', 'R14dtd', 'R16d', 'R16tg', 'R16td', 'R16dtg', 'R16dtd', 'R22v', 'R22j']],
        ['VL', ['R11v', 'R11j', 'R14d', 'R14tg', 'R14td', 'R14dtg', 'R14dtd', 'R16d', 'R16tg', 'R16td', 'R16dtg', 'R16dtd', 'R22v', 'R22j']],
        ['B', ['R13b', 'R13bj', 'R15b', 'R17', 'R18tg', 'R18td']],
        ['CY', ['R12m', 'R13c', 'R19']],
        ['P', ['R12', 'R12m', 'R12pps']],
        ['FL', ['A13b']],
        ['PP', ['A13b']]
    ])('type %s : seuls ses signaux sont proposés', (type, attendus) => {
        render(<GroupTable groups={[{ ...groups[0], type }]} updateGroupParams={vi.fn()} cycleLength={70} />);
        const codes = [...screen.getByLabelText('Signal du groupe 1').querySelectorAll('option')].map(o => o.value);
        expect(codes).toEqual(['', ...attendus]);
    });

    it('un signal hors de la liste du type reste affiché', () => {
        render(<GroupTable groups={[{ ...groups[0], signal: 'R12' }]} updateGroupParams={vi.fn()} cycleLength={70} />);
        expect(screen.getByLabelText('Signal du groupe 1').value).toBe('R12');
    });

    it('un code hors liste reste affiché', () => {
        render(<GroupTable groups={[{ ...groups[0], signal: 'R13tj' }]} updateGroupParams={vi.fn()} cycleLength={70} />);
        expect(screen.getByLabelText('Signal du groupe 1').value).toBe('R13tj');
    });
});

describe('formulaire : signal et courant proposés selon le type', () => {
    const vierge = (id, extra = {}) => ({ ...groupe(id, `G${id}`, ''), ...extra });
    const choisir = (groupes, id, type) => {
        const update = vi.fn();
        const { container, unmount } = render(<GroupTable groups={groupes} updateGroupParams={update} cycleLength={70} />);
        fireEvent.change(container.querySelectorAll('.input-type')[groupes.findIndex(g => g.id === id)], { target: { value: type } });
        unmount();
        return update.mock.calls[0][1];
    };

    it.each([
        ['V', 'R11v', 'TD'],
        ['P', 'R12', 'Piéton'],
        ['CY', 'R13c', 'Cycle'],
        ['B', 'R13b', 'TD']
    ])('type %s : signal %s et courant %s dans des champs vides', (type, signal, courant) => {
        expect(choisir([vierge(1)], 1, type)).toEqual({ type, signal, courant });
    });

    it('un signal ou un courant choisis à la main sont conservés', () => {
        expect(choisir([vierge(1, { signal: 'R14tg', courant: 'TàG' })], 1, 'V')).toEqual({ type: 'V' });
    });

    it('les valeurs proposées pour l\'ancien type suivent le nouveau', () => {
        expect(choisir([vierge(1, { type: 'V', signal: 'R11v', courant: 'TD' })], 1, 'P'))
            .toEqual({ type: 'P', signal: 'R12', courant: 'Piéton' });
        expect(choisir([vierge(1, { type: 'P', signal: 'R12', courant: 'Piéton' })], 1, 'B'))
            .toEqual({ type: 'B', signal: 'R13b', courant: 'TD' });
    });

    it('FL et PP : A13b proposé, courant laissé tel quel', () => {
        expect(choisir([vierge(1)], 1, 'FL')).toEqual({ type: 'FL', signal: 'A13b' });
        expect(choisir([vierge(1, { type: 'P', signal: 'R12', courant: 'Piéton' })], 1, 'PP')).toEqual({ type: 'PP', signal: 'A13b' });
    });

    it('un signal choisi à la main mais absent de la liste du nouveau type est remplacé', () => {
        expect(choisir([vierge(1, { type: 'V', signal: 'R14tg', courant: 'TàG' })], 1, 'B')).toEqual({ type: 'B', signal: 'R13b' });
    });

    it('ancien type VL : ses valeurs proposées suivent aussi le nouveau type', () => {
        expect(choisir([vierge(1, { type: 'VL', signal: 'R11v', courant: 'TD' })], 1, 'CY'))
            .toEqual({ type: 'CY', signal: 'R13c', courant: 'Cycle' });
    });
});

describe('formulaire : infobulles de la liste Signal', () => {
    it('masquées dans la liste quand les infobulles Configuration sont coupées', () => {
        render(<GroupTable groups={groups} updateGroupParams={vi.fn()} cycleLength={70} tooltipsEnabled={false} />);
        const liste = screen.getByLabelText('Signal du groupe 1');
        expect(liste.getAttribute('title')).toBeNull();
        expect(liste.querySelector('option[value="R14tg"]').getAttribute('title')).toBeNull();
    });
});
