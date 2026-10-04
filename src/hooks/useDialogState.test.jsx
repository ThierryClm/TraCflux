import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import useDialogState from './useDialogState';

beforeEach(() => {
    localStorage.clear();
});

describe('useDialogState', () => {
    it('fournit des dialogues fermés et des formulaires neutres', () => {
        const { result } = renderHook(() => useDialogState());

        expect(result.current.openModal).toBe(false);
        expect(result.current.slideValue).toBe(0);
        expect(result.current.insertDuration).toBe(5);
        expect(result.current.reduceDuration).toBe(5);
        expect(result.current.htmFile).toBeNull();
        expect(result.current.printType).toBeNull();
        expect(result.current.dossierSections).toEqual({});
        expect(result.current.draggedTabIndex).toBeNull();
        expect(result.current.helpZoneRef.current).toBeNull();
    });

    it('restaure les imports HTM mémorisés', () => {
        const imported = [{
            id: '1',
            name: 'Plan importé',
            importedAt: '2026-10-04T10:00:00.000Z',
            data: { groups: [], cycleLength: 60 },
        }];
        localStorage.setItem('importedHTMFiles', JSON.stringify(imported));

        const { result } = renderHook(() => useDialogState());
        expect(result.current.importedHTMFiles).toEqual(imported);
    });

    it('ignore une sauvegarde HTM illisible', () => {
        localStorage.setItem('importedHTMFiles', '{invalide');

        const { result } = renderHook(() => useDialogState());
        expect(result.current.importedHTMFiles).toEqual([]);
    });

    it('met à jour les états typés des dialogues', () => {
        const { result } = renderHook(() => useDialogState());
        const file = new File(['<html></html>'], 'plan.htm', { type: 'text/html' });

        act(() => {
            result.current.setOpenModal(true);
            result.current.setHtmFile(file);
            result.current.setPrintType('dossier');
            result.current.setDossierSections({ image: true, matrice: false });
            result.current.setDraggedTabIndex(2);
        });

        expect(result.current.openModal).toBe(true);
        expect(result.current.htmFile).toBe(file);
        expect(result.current.printType).toBe('dossier');
        expect(result.current.dossierSections).toEqual({ image: true, matrice: false });
        expect(result.current.draggedTabIndex).toBe(2);
    });
});
