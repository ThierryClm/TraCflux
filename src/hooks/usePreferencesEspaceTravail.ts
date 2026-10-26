/**
 * Préférences d'espace de travail mémorisées dans le navigateur
 * (localStorage) : elles ne voyagent pas avec le projet.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/** Sections des infobulles réglables dans Mise en page → Infobulles. */
export type PrefsInfobulles = Record<'menu' | 'main' | 'config' | 'diagram' | 'matrix' | 'traffic' | 'micro', boolean>;

/**
 * Interrupteur mémorisé sous la clé `cle` : relu au démarrage, réenregistré à
 * chaque changement. Absente ou illisible, la valeur vaut `defaut` : seule la
 * valeur contraire, écrite en toutes lettres, l'emporte.
 */
export const useBooleenMemorise = (cle: string, defaut: boolean): [boolean, Dispatch<SetStateAction<boolean>>] => {
    const [valeur, setValeur] = useState(() => {
        try {
            const lu = localStorage.getItem(cle);
            return defaut ? lu !== 'false' : lu === 'true';
        } catch { return defaut; }
    });
    useEffect(() => {
        try { localStorage.setItem(cle, String(valeur)); } catch {}
    }, [cle, valeur]);
    return [valeur, setValeur];
};

/** Préférences « Infobulles... » : 7 sections, toutes cochées par défaut. */
export const usePrefsInfobulles = () => {
    // Preferences "Infobulles..." (Mise en page). 7 sections, toutes
    // cochees par defaut. Persiste au niveau de l'application (localStorage).
    const [tooltipPrefs, setTooltipPrefsState] = useState<PrefsInfobulles>(() => {
        try {
            const raw = localStorage.getItem('tracflux.tooltips');
            const def = { menu: true, main: true, config: true, diagram: true, matrix: true, traffic: true, micro: true };
            if (!raw) return def;
            const parsed = JSON.parse(raw);
            return { ...def, ...parsed };
        } catch {
            return { menu: true, main: true, config: true, diagram: true, matrix: true, traffic: true, micro: true };
        }
    });
    const setTooltipPref = useCallback((key: keyof PrefsInfobulles) => {
        setTooltipPrefsState(prev => {
            const next = { ...prev, [key]: !prev[key] };
            try { localStorage.setItem('tracflux.tooltips', JSON.stringify(next)); } catch {}
            return next;
        });
    }, []);

    return { tooltipPrefs, setTooltipPref };
};
