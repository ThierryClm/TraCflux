import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { calculateDragConflicts, useTimelineDrag } from './useTimelineDrag';

const groups = [
    { id: 1, offset: 10, durations: { green: 20 } },
    { id: 2, offset: 40, durations: { green: 20 } }
];

const createProps = (overrides = {}) => ({
    actionData: [],
    conflictMatrix: [[0, 12], [0, 0]],
    conflicts: [],
    cycleLength: 60,
    endDrag: vi.fn(),
    groups,
    onDragConflicts: vi.fn(),
    pixelsPerSecond: 2,
    readOnly: false,
    startDrag: vi.fn(),
    updateActionRow: vi.fn(),
    updateGroupParams: vi.fn(),
    ...overrides
});

const dragEvent = (clientX) => ({
    clientX,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
});

describe('calculateDragConflicts', () => {
    it('recalcule les conflits pendant le déplacement d’une phase', () => {
        const conflicts = calculateDragConflicts({
            dragState: { groupId: 1, type: 'end', initialValue: 30, deltaSeconds: 5 },
            groups,
            conflictMatrix: [[0, 12], [0, 0]],
            cycleLength: 60
        });

        expect(conflicts).toEqual([{
            from: 1,
            to: 2,
            required: 12,
            actual: 5,
            type: 'intergreen'
        }]);
    });

    it('ignore les glissements d’actions', () => {
        expect(calculateDragConflicts({
            dragState: { actionId: 7, deltaSeconds: 3 },
            groups,
            conflictMatrix: [[0, 12], [0, 0]],
            cycleLength: 60
        })).toBeNull();
    });
});

describe('useTimelineDrag', () => {
    it('n’active pas le glissement en lecture seule', () => {
        const props = createProps({ readOnly: true });
        const { result } = renderHook(() => useTimelineDrag(props));

        act(() => result.current.handleDragStart(dragEvent(20), 1, 'start', 10));

        expect(result.current.dragState).toBeNull();
        expect(props.startDrag).not.toHaveBeenCalled();
    });

    it('applique un déplacement de début et déplace la bande passante liée', () => {
        const props = createProps({
            actionData: [{
                id: 9,
                action: 'Début de bande passante',
                gf: 'G1',
                deb: '10',
                fin: '20'
            }]
        });
        const { result } = renderHook(() => useTimelineDrag(props));

        act(() => result.current.handleDragStart(dragEvent(20), 1, 'start', 10));
        act(() => document.dispatchEvent(new MouseEvent('mousemove', { clientX: 26 })));
        act(() => document.dispatchEvent(new MouseEvent('mouseup')));

        expect(props.updateGroupParams).toHaveBeenCalledWith(1, {
            offset: 13,
            durations: { green: 17 }
        });
        expect(props.updateActionRow).toHaveBeenCalledWith(9, 'deb', '13');
        expect(props.updateActionRow).toHaveBeenCalledWith(9, 'fin', '23');
        expect(props.endDrag).toHaveBeenCalledOnce();
    });

    it('déplace une action en temps réel avec retour de cycle', () => {
        const props = createProps({
            actionData: [{ id: 4, action: 'Point de repos', deb: '58', fin: '' }]
        });
        const { result } = renderHook(() => useTimelineDrag(props));

        act(() => result.current.handleActionDragStart(dragEvent(10), 4, 'deb', 58));
        act(() => document.dispatchEvent(new MouseEvent('mousemove', { clientX: 16 })));

        expect(props.updateActionRow).toHaveBeenCalledWith(4, 'deb', '1');
        expect(result.current.dragState).toMatchObject({
            actionId: 4,
            currentValue: 1,
            deltaSeconds: 3,
            showTooltip: true
        });

        act(() => document.dispatchEvent(new MouseEvent('mouseup')));
        expect(result.current.dragState).toBeNull();
    });

    it('conserve la fin quand le début est saisi directement', () => {
        const props = createProps();
        const { result } = renderHook(() => useTimelineDrag(props));

        act(() => result.current.handleStartChange(1, '15'));
        act(() => result.current.handleEndChange(1, '5', 15));

        expect(props.updateGroupParams).toHaveBeenNthCalledWith(1, 1, {
            offset: 15,
            durations: { green: 15 }
        });
        expect(props.updateGroupParams).toHaveBeenNthCalledWith(2, 1, {
            durations: { green: 50 }
        });
    });
});
