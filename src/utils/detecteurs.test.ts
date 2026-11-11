import { describe, it, expect } from 'vitest';
import {
    CATEGORIES_DETECTEUR,
    changerCategorie,
    creerDetecteur,
    dimensionDepuisSaisie,
    dimensionParDefaut,
    dimensionSaisissable,
    dupliquerDetecteur,
    normaliserDetecteurs,
    normaliserPixelsParMetre,
    PIXELS_PAR_METRE_DEFAUT,
    PIXELS_PAR_METRE_MAX,
    PIXELS_PAR_METRE_MIN
} from './detecteurs';
import type { Detecteur } from '../types/projet';

const detecteur = (overrides: Partial<Detecteur> = {}): Detecteur => ({
    id: 1,
    nom: 'Détecteur 1',
    categorie: 'bouclePiedFeu',
    gf: 1,
    dimension: 8,
    position: null,
    orientation: 0,
    note: '',
    ...overrides
});

describe('catégories et dimensions', () => {
    it('propose les cinq catégories du module', () => {
        expect(CATEGORIES_DETECTEUR.map(c => c.valeur)).toEqual([
            'bouclePiedFeu', 'boucleEloignee', 'boucleComptage', 'radar', 'boutonPoussoir'
        ]);
    });

    it('donne 2 m à la boucle de comptage, rien aux autres', () => {
        expect(dimensionParDefaut('boucleComptage')).toBe(2);
        expect(dimensionParDefaut('bouclePiedFeu')).toBeNull();
        expect(dimensionParDefaut('boucleEloignee')).toBeNull();
        expect(dimensionParDefaut('radar')).toBeNull();
    });

    it('ne saisit pas de dimension pour un radar ni pour un bouton poussoir', () => {
        expect(dimensionSaisissable('boutonPoussoir')).toBe(false);
        expect(dimensionSaisissable('radar')).toBe(false);
        expect(dimensionSaisissable('bouclePiedFeu')).toBe(true);
        expect(dimensionDepuisSaisie('12', 'boutonPoussoir')).toBeNull();
        expect(dimensionDepuisSaisie('12', 'radar')).toBeNull();
    });

    it('lit une dimension entière ou décimale, vide ou nulle refusée', () => {
        expect(dimensionDepuisSaisie('12', 'bouclePiedFeu')).toBe(12);
        expect(dimensionDepuisSaisie('7,5', 'bouclePiedFeu')).toBe(7.5);
        expect(dimensionDepuisSaisie('', 'bouclePiedFeu')).toBeNull();
        expect(dimensionDepuisSaisie('0', 'bouclePiedFeu')).toBeNull();
        expect(dimensionDepuisSaisie('abc', 'bouclePiedFeu')).toBeNull();
    });
});

describe('échelle de l’image', () => {
    it('reprend le défaut quand la valeur manque ou est illisible', () => {
        expect(normaliserPixelsParMetre(undefined)).toBe(PIXELS_PAR_METRE_DEFAUT);
        expect(normaliserPixelsParMetre('abc')).toBe(PIXELS_PAR_METRE_DEFAUT);
        expect(normaliserPixelsParMetre(0)).toBe(PIXELS_PAR_METRE_MIN);
    });

    it('lit une valeur valide et la borne', () => {
        expect(normaliserPixelsParMetre(18)).toBe(18);
        expect(normaliserPixelsParMetre('7,5')).toBe(7.5);
        expect(normaliserPixelsParMetre(10000)).toBe(PIXELS_PAR_METRE_MAX);
    });
});

describe('création et changement de type', () => {
    it('crée un détecteur numéroté, sans groupe ni position', () => {
        const existants = [detecteur({ id: 3, nom: 'Détecteur 1' })];
        const neuf = creerDetecteur(existants);
        expect(neuf).toMatchObject({
            id: 4,
            nom: 'Détecteur 2',
            categorie: 'bouclePiedFeu',
            gf: null,
            dimension: null,
            position: null,
            orientation: 0,
            note: ''
        });
    });

    it('donne 2 m à une boucle de comptage créée directement', () => {
        expect(creerDetecteur([], 'boucleComptage').dimension).toBe(2);
    });

    it('efface la dimension en passant au bouton poussoir, la remet en revenant', () => {
        const boucle = detecteur({ categorie: 'bouclePiedFeu', dimension: 9 });
        const bouton = changerCategorie(boucle, 'boutonPoussoir');
        expect(bouton.dimension).toBeNull();
        expect(changerCategorie(bouton, 'boucleComptage').dimension).toBe(2);
    });

    it('efface aussi la dimension en passant au radar', () => {
        const boucle = detecteur({ categorie: 'bouclePiedFeu', dimension: 9 });
        expect(changerCategorie(boucle, 'radar').dimension).toBeNull();
    });

    it('conserve la longueur saisie entre deux types de boucle', () => {
        const boucle = detecteur({ categorie: 'bouclePiedFeu', dimension: 9 });
        expect(changerCategorie(boucle, 'boucleEloignee').dimension).toBe(9);
    });
});

describe('duplication', () => {
    it('insère la copie juste après l’original, avec un nom libre', () => {
        const liste = [
            detecteur({ id: 1, nom: 'Entrée nord' }),
            detecteur({ id: 2, nom: 'Entrée sud' })
        ];
        const apres = dupliquerDetecteur(liste, 1);
        expect(apres.map(d => d.nom)).toEqual(['Entrée nord', 'Entrée nord (copie)', 'Entrée sud']);
        expect(apres[1].id).toBe(3);
        expect(apres[1].categorie).toBe(liste[0].categorie);
        expect(apres[1].gf).toBe(liste[0].gf);
    });

    it('numérote les copies successives', () => {
        const liste = [detecteur({ id: 1, nom: 'Entrée nord' })];
        const une = dupliquerDetecteur(liste, 1);
        const deux = dupliquerDetecteur(une, 1);
        expect(deux.map(d => d.nom)).toEqual(['Entrée nord', 'Entrée nord (copie) 2', 'Entrée nord (copie)']);
    });

    it('ne touche à rien pour un identifiant inconnu', () => {
        const liste = [detecteur()];
        expect(dupliquerDetecteur(liste, 99)).toBe(liste);
    });
});

describe('normalisation d’un projet enregistré', () => {
    it('rend une liste vide pour un projet antérieur au module', () => {
        expect(normaliserDetecteurs(undefined)).toEqual([]);
        expect(normaliserDetecteurs(null)).toEqual([]);
        expect(normaliserDetecteurs('nope')).toEqual([]);
    });

    it('relit les champs valides et répare les autres', () => {
        const liste = normaliserDetecteurs([
            {
                id: 2,
                nom: 'Boucle A',
                categorie: 'boucleComptage',
                gf: '3',
                dimension: '2,5',
                position: { x: 12, y: 40 },
                orientation: '45',
                note: 'après le carrefour'
            },
            { id: 2, categorie: 'inconnue', dimension: 4, position: { x: 'a' } },
            'pas un détecteur',
            { id: 0, nom: 12, categorie: 'boutonPoussoir', dimension: 3 }
        ]);
        expect(liste).toHaveLength(3);
        expect(liste[0]).toEqual({
            id: 2,
            nom: 'Boucle A',
            categorie: 'boucleComptage',
            gf: 3,
            dimension: 2.5,
            position: { x: 12, y: 40 },
            orientation: 45,
            note: 'après le carrefour'
        });
        // Identifiant en double et catégorie inconnue : id suivant, boucle par défaut.
        expect(liste[1].id).toBe(3);
        expect(liste[1].categorie).toBe('bouclePiedFeu');
        expect(liste[1].dimension).toBe(4);
        expect(liste[1].position).toBeNull();
        // Un bouton poussoir n'a pas de dimension ; nom non textuel vidé.
        expect(liste[2]).toMatchObject({ id: 4, nom: '', categorie: 'boutonPoussoir', dimension: null });
    });
});
