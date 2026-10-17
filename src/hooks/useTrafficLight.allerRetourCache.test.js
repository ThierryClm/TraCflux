import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { useTrafficLight } from './useTrafficLight';

/**
 * Aller-retour par le cache du navigateur avec le carrefour exemple :
 * ouvrir le projet, l'enregistrer, le rouvrir dans une nouvelle session.
 * Tout ce qui fait le projet doit revenir à l'identique.
 */
const exemple = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/Carrefour_Exemple.json'), 'utf8'));

const essentiel = (r) => ({
    intersectionName: r.intersectionName,
    groups: r.groups,
    conflictMatrix: r.conflictMatrix,
    pfTabs: r.pfTabs,
    activePFId: r.activePFId,
    trafficDatasets: r.trafficDatasets,
    customTrafficDatasetNames: r.customTrafficDatasetNames,
    pfTrafficDatasetMap: r.pfTrafficDatasetMap,
    dependencyGap: r.dependencyGap,
    externalLinks: r.externalLinks,
    actionColWidths: r.actionColWidths
});

beforeEach(() => localStorage.clear());

describe('useTrafficLight — aller-retour par le cache', () => {
    it('le carrefour exemple revient identique après enregistrement et réouverture', async () => {
        const premiere = renderHook(() => useTrafficLight());
        act(() => { premiere.result.current.loadFullState(exemple); });
        const avant = essentiel(premiere.result.current);
        let ok;
        await act(async () => { ok = await premiere.result.current.saveProject('Aller_retour'); });
        expect(ok).toBe(true);
        expect(premiere.result.current.getAllSaves().map(p => p.name)).toContain('Aller_retour');

        const seconde = renderHook(() => useTrafficLight());
        act(() => { expect(seconde.result.current.loadProject('Aller_retour')).toBeTruthy(); });
        expect(essentiel(seconde.result.current)).toEqual(avant);
        expect(seconde.result.current.projectName).toBe('Aller_retour');
    });
});
