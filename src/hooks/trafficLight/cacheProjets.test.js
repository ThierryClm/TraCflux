import { describe, it, expect, beforeEach } from 'vitest';
import { MAX_CACHED_PROJECTS, mettreProjetEnTete, listerProjetsCache, lireProjetCache, supprimerProjetCache } from './cacheProjets';

const ordre = () => JSON.parse(localStorage.getItem('traffic_project_order'));

describe('cache des projets', () => {
    beforeEach(() => localStorage.clear());

    it('met le projet ouvert en tête, sans doublon', () => {
        mettreProjetEnTete('A');
        mettreProjetEnTete('B');
        mettreProjetEnTete('A');
        expect(ordre()).toEqual(['A', 'B']);
    });

    it(`au-delà de ${MAX_CACHED_PROJECTS} projets, retire le plus ancien du cache`, () => {
        for (let i = 1; i <= MAX_CACHED_PROJECTS; i++) {
            localStorage.setItem(`traffic_project_P${i}`, '{}');
            mettreProjetEnTete(`P${i}`);
        }
        localStorage.setItem('traffic_project_P1_backup', '{}');
        mettreProjetEnTete('Nouveau');
        expect(ordre()).toHaveLength(MAX_CACHED_PROJECTS);
        expect(ordre()[0]).toBe('Nouveau');
        expect(localStorage.getItem('traffic_project_P1')).toBeNull();
        // La sauvegarde de secours du projet retiré est conservée.
        expect(localStorage.getItem('traffic_project_P1_backup')).toBe('{}');
    });

    it('liste les projets dans l\'ordre récent, sans les secours ni la clé d\'ordre', () => {
        localStorage.setItem('traffic_project_Ancien', JSON.stringify({ savedAt: '2026-01-01' }));
        localStorage.setItem('traffic_project_Recent', JSON.stringify({ savedAt: '2026-02-01' }));
        localStorage.setItem('traffic_project_Recent_backup', '{}');
        localStorage.setItem('traffic_project_HorsOrdre', 'pas du json');
        localStorage.setItem('traffic_project_order', JSON.stringify(['Recent', 'Ancien']));
        const liste = listerProjetsCache();
        expect(liste.map(p => p.name)).toEqual(['Recent', 'Ancien', 'HorsOrdre']);
        expect(liste[0].savedAt).toBe('2026-02-01');
        expect(liste[2]).toEqual({ name: 'HorsOrdre', savedAt: null, size: 'pas du json'.length });
    });

    it('lit un projet, renvoie null s\'il manque ou s\'il est illisible', () => {
        localStorage.setItem('traffic_project_A', JSON.stringify({ intersectionName: 'X' }));
        localStorage.setItem('traffic_project_B', '{abîmé');
        expect(lireProjetCache('A')).toEqual({ intersectionName: 'X' });
        expect(lireProjetCache('B')).toBeNull();
        expect(lireProjetCache('C')).toBeNull();
    });

    it('supprime un projet du cache', () => {
        localStorage.setItem('traffic_project_A', '{}');
        supprimerProjetCache('A');
        expect(localStorage.getItem('traffic_project_A')).toBeNull();
    });
});
