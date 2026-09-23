import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ToastContainer from './ToastContainer';
import { getToastPrefs, setToastPref, subscribeToasts, toast } from '../utils/toast';

beforeEach(() => {
    localStorage.clear();
    setToastPref('success', true);
    setToastPref('error', true);
    setToastPref('info', true);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('bus de notifications', () => {
    it('publie chaque type avec un identifiant unique', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeToasts(listener);
        const successId = toast.success('Sauvé');
        const errorId = toast.error('Échec');
        const infoId = toast.info('Info');
        expect(listener.mock.calls.map(([event]) => event.type)).toEqual(['success', 'error', 'info']);
        expect(new Set([successId, errorId, infoId]).size).toBe(3);
        unsubscribe();
    });

    it('désactive et persiste un type sans toucher aux autres', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeToasts(listener);
        setToastPref('success', false);
        expect(toast.success('silencieux')).toBeNull();
        expect(toast.error('visible')).not.toBeNull();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(getToastPrefs()).toMatchObject({ success: false, error: true, info: true });
        expect(JSON.parse(localStorage.getItem('toastPreferences')).success).toBe(false);
        unsubscribe();
    });

    it('ignore un type de préférence inconnu', () => {
        const before = getToastPrefs();
        setToastPref('warning', false);
        expect(getToastPrefs()).toEqual(before);
    });
});

describe('ToastContainer', () => {
    it('affiche une notification avec son icône', () => {
        render(<ToastContainer />);
        act(() => { toast.success('Projet sauvegardé'); });
        expect(screen.getByText('Projet sauvegardé')).toBeInTheDocument();
        expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('marque puis retire la notification après sa durée', () => {
        vi.useFakeTimers();
        render(<ToastContainer />);
        act(() => { toast.info('Traitement'); });
        const item = screen.getByText('Traitement').closest('.toast');
        act(() => vi.advanceTimersByTime(3000));
        expect(item).toHaveClass('toast-leaving');
        act(() => vi.advanceTimersByTime(250));
        expect(screen.queryByText('Traitement')).toBeNull();
    });

    it('met le délai en pause au survol puis le reprend avec le temps restant', () => {
        vi.useFakeTimers();
        render(<ToastContainer />);
        act(() => { toast.info('Message à lire'); });
        const item = screen.getByText('Message à lire').closest('.toast');

        act(() => vi.advanceTimersByTime(1000));
        fireEvent.mouseEnter(item);
        act(() => vi.advanceTimersByTime(5000));

        expect(item).not.toHaveClass('toast-leaving');
        expect(screen.getByText('Message à lire')).toBeInTheDocument();

        fireEvent.mouseLeave(item);
        act(() => vi.advanceTimersByTime(1999));
        expect(item).not.toHaveClass('toast-leaving');
        act(() => vi.advanceTimersByTime(1));
        expect(item).toHaveClass('toast-leaving');
        act(() => vi.advanceTimersByTime(250));
        expect(screen.queryByText('Message à lire')).toBeNull();
    });

    it('annule aussi la disparition si le survol commence pendant la sortie', () => {
        vi.useFakeTimers();
        render(<ToastContainer />);
        act(() => { toast.info('Message rattrapé'); });
        const item = screen.getByText('Message rattrapé').closest('.toast');

        act(() => vi.advanceTimersByTime(3000));
        expect(item).toHaveClass('toast-leaving');

        fireEvent.mouseEnter(item);
        act(() => vi.advanceTimersByTime(1000));
        expect(item).not.toHaveClass('toast-leaving');
        expect(screen.getByText('Message rattrapé')).toBeInTheDocument();

        fireEvent.mouseLeave(item);
        act(() => vi.advanceTimersByTime(0));
        expect(item).toHaveClass('toast-leaving');
        act(() => vi.advanceTimersByTime(250));
        expect(screen.queryByText('Message rattrapé')).toBeNull();
    });

    it('se désabonne et annule ses minuteurs au démontage', () => {
        vi.useFakeTimers();
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = render(<ToastContainer />);
        act(() => { toast.error('Erreur'); });
        unmount();
        expect(clearTimeoutSpy).toHaveBeenCalled();
    });
});
