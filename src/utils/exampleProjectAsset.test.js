import { describe, expect, it } from 'vitest';
import { getExampleProjectAssetUrl, getExampleProjectFetchOptions } from './exampleProjectAsset';

describe('projet exemple — cache navigateur', () => {
    it('versionne le JSON selon le build courant', () => {
        const url = new URL(getExampleProjectAssetUrl(
            'https://preview.example/app/?example=carrefour',
            '2026-10-03T10:15:00.000Z'
        ));

        expect(url.pathname).toBe('/app/Carrefour_Exemple.json');
        expect(url.searchParams.get('build')).toBe('2026-10-03T10:15:00.000Z');
    });

    it('interdit la réutilisation du cache HTTP du navigateur', () => {
        expect(getExampleProjectFetchOptions()).toEqual({ cache: 'no-store' });
    });
});
