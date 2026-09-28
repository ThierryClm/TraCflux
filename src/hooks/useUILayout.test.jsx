import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import useUILayout from './useUILayout';

beforeEach(() => {
    localStorage.clear();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
});

describe('useUILayout', () => {
    it('fournit les valeurs par défaut et les persiste', () => {
        const { result } = renderHook(() => useUILayout());
        expect(result.current.pixelsPerSecond).toBe(10);
        expect(result.current.activeTab).toBe('config');
        expect(result.current.sidebarWidth).toBe(450);
        expect(result.current.sidebarVisible).toBe(true);
        expect(localStorage.getItem('sidebar_width')).toBe('450');
        expect(localStorage.getItem('sidebar_visible')).toBe('true');
        act(() => result.current.setSidebarVisible(false));
        expect(localStorage.getItem('sidebar_visible')).toBe('false');
    });

    it('restaure la disposition persistée', () => {
        localStorage.setItem('sidebar_width', '620');
        localStorage.setItem('sidebar_visible', 'false');
        localStorage.setItem('diagram_height', '280');
        const { result } = renderHook(() => useUILayout());
        expect(result.current.sidebarWidth).toBe(620);
        expect(result.current.sidebarVisible).toBe(false);
        expect(result.current.diagramHeight).toBe(280);
    });

    it('redimensionne la barre latérale entre 300 et 1200 pixels', () => {
        const { result } = renderHook(() => useUILayout());
        result.current.splitViewRef.current = { getBoundingClientRect: () => ({ left: 100 }) };
        act(() => result.current.handleResizeStart({ preventDefault() {} }));
        expect(result.current.isResizing).toBe(true);
        expect(document.body.style.cursor).toBe('col-resize');
        act(() => document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 })));
        expect(result.current.sidebarWidth).toBe(300);
        act(() => document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1500 })));
        expect(result.current.sidebarWidth).toBe(1200);
        act(() => document.dispatchEvent(new MouseEvent('mouseup')));
        expect(result.current.isResizing).toBe(false);
        expect(document.body.style.cursor).toBe('');
    });

    it('redimensionne le diagramme dans les limites du conteneur', () => {
        const { result } = renderHook(() => useUILayout());
        result.current.diagramAreaRef.current = {
            getBoundingClientRect: () => ({ top: 50, height: 600 }),
            querySelector: () => null
        };
        act(() => result.current.handleDiagramResizeStart({ preventDefault() {} }));
        expect(result.current.isResizingDiagram).toBe(true);
        expect(document.body.style.cursor).toBe('row-resize');
        act(() => document.dispatchEvent(new MouseEvent('mousemove', { clientY: 100 })));
        expect(result.current.diagramHeight).toBe(100);
        act(() => document.dispatchEvent(new MouseEvent('mousemove', { clientY: 900 })));
        expect(result.current.diagramHeight).toBe(450);
        act(() => document.dispatchEvent(new MouseEvent('mouseup')));
        expect(result.current.isResizingDiagram).toBe(false);
    });

    it('redimensionne le panneau d’actions relativement à sa hauteur courante', () => {
        const { result } = renderHook(() => useUILayout());
        result.current.diagramAreaRef.current = { getBoundingClientRect: () => ({ height: 600 }) };
        act(() => result.current.handleActionPanelResize(50));
        expect(result.current.diagramHeight).toBe(450);
        act(() => result.current.handleActionPanelResize(-1000));
        expect(result.current.diagramHeight).toBe(100);
    });

    it('réinitialise la hauteur et sa persistance', () => {
        localStorage.setItem('diagram_height', '250');
        const { result } = renderHook(() => useUILayout());
        act(() => result.current.resetDiagramHeight());
        expect(result.current.diagramHeight).toBeNull();
        expect(localStorage.getItem('diagram_height')).toBeNull();
    });

    it('nettoie les styles globaux au démontage', () => {
        const { result, unmount } = renderHook(() => useUILayout());
        act(() => result.current.handleResizeStart({ preventDefault() {} }));
        unmount();
        expect(document.body.style.cursor).toBe('');
        expect(document.body.style.userSelect).toBe('');
    });
});
