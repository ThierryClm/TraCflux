/**
 * Préférences d'espace de travail mémorisées dans le navigateur
 * (localStorage) : elles ne voyagent pas avec le projet.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/** Sections des infobulles réglables dans Mise en page → Infobulles. */
export type SectionInfobulles = 'menu' | 'main' | 'config' | 'diagram' | 'matrix' | 'traffic' | 'micro' | 'actions' | 'assistant' | 'image';
export type PrefsInfobulles = Record<SectionInfobulles, boolean>;

/** Toutes cochées par défaut ; une section ajoutée plus tard part cochée. */
export const PREFS_INFOBULLES_DEFAUT: PrefsInfobulles = {
    menu: true, main: true, config: true, diagram: true, matrix: true, traffic: true, micro: true,
    actions: true, assistant: true, image: true
};

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

/** Préférences « Infobulles... » : dix sections, toutes cochées par défaut. */
export const usePrefsInfobulles = () => {
    // Préférences « Infobulles... » (Mise en page). Dix sections, toutes
    // cochées par défaut. Persiste au niveau de l'application (localStorage).
    const [tooltipPrefs, setTooltipPrefsState] = useState<PrefsInfobulles>(() => {
        try {
            const raw = localStorage.getItem('tracflux.tooltips');
            const def = PREFS_INFOBULLES_DEFAUT;
            if (!raw) return def;
            const parsed = JSON.parse(raw);
            return { ...def, ...parsed };
        } catch {
            return PREFS_INFOBULLES_DEFAUT;
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
