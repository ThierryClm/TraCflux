import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CROP, DEFAULT_ZOOM } from './floatingImageBox';

const exemple = JSON.parse(readFileSync(
    path.join(process.cwd(), 'public', 'Carrefour_Exemple.json'),
    'utf8'
));

describe('Carrefour exemple', () => {
    it('ouvre l’image détachée avec un cadrage neutre', () => {
        expect(exemple.floatingCrop).toEqual(DEFAULT_CROP);
        expect(exemple.floatingZoom).toBe(DEFAULT_ZOOM);
    });
});
