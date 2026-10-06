/**
 * Simple toast bus (singleton). No provider needed.
 *
 * Usage:
 *   import { toast } from './utils/toast';
 *   toast.success('Projet sauvegardé');
 *   toast.error('Échec de l\'import');
 *   toast.info('Action annulée');
 *
 * Mount <ToastContainer /> once in the root to display toasts.
 */

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
    id: number;
    type: ToastType;
    message: string;
    createdAt: number;
}

export type ToastPreferences = Record<ToastType, boolean>;
type ToastListener = (toast: ToastMessage) => void;

const listeners = new Set<ToastListener>();
let nextId = 1;

// Per-type enable/disable flags (persisted to localStorage)
const STORAGE_KEY = 'toastPreferences';
const defaultPrefs: ToastPreferences = { success: true, error: true, info: true };

function loadPrefs(): ToastPreferences {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...defaultPrefs };
        const parsed = JSON.parse(raw) as Partial<ToastPreferences>;
        return { ...defaultPrefs, ...parsed };
    } catch {
        return { ...defaultPrefs };
    }
}

let prefs = loadPrefs();

export function getToastPrefs() {
    return { ...prefs };
}

export function setToastPref(type: ToastType, enabled: boolean) {
    if (!(type in prefs)) return;
    prefs = { ...prefs, [type]: !!enabled };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

function emit(type: ToastType, message: string): number | null {
    if (!prefs[type]) return null; // silenced by user preference
    const t = { id: nextId++, type, message, createdAt: Date.now() };
    listeners.forEach(l => l(t));
    return t.id;
}

export const toast = {
    success: (message: string) => emit('success', message),
    error: (message: string) => emit('error', message),
    info: (message: string) => emit('info', message)
};

export function subscribeToasts(listener: ToastListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
