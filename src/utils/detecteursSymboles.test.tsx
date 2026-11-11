import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderDetecteurSVG, tailleDetecteur, TAILLE_BOUTON, TAILLE_RADAR } from './detecteursSymboles';
import type { Detecteur } from '../types/projet';

const detecteur = (overrides: Partial<Detecteur> = {}): Detecteur => ({
    id: 1,
    nom: 'Détecteur',
    categorie: 'bouclePiedFeu',
    gf: 1,
    dimension: 5,
    position: { x: 50, y: 50 },
    orientation: 0,
    note: '',
    ...overrides
});

describe('taille des symboles', () => {
    it('dessine une boucle à 1 m de large et à sa longueur en mètres', () => {
        expect(tailleDetecteur(detecteur({ dimension: 5 }), 10)).toEqual({ largeur: 10, hauteur: 50 });
        expect(tailleDetecteur(detecteur({ dimension: 2.5 }), 10)).toEqual({ largeur: 10, hauteur: 25 });
    });

    it('propose 2 m pour une boucle de comptage sans dimension', () => {
        expect(tailleDetecteur(detecteur({ categorie: 'boucleComptage', dimension: null }), 10).hauteur).toBe(20);
    });

    it('garde une taille minimale lisible pour une petite échelle', () => {
        expect(tailleDetecteur(detecteur({ dimension: 0.5 }), 2)).toEqual({ largeur: 6, hauteur: 8 });
    });

    it('garde le radar et le bouton à taille fixe, quelle que soit l’échelle', () => {
        expect(tailleDetecteur(detecteur({ categorie: 'radar', dimension: 25 }), 10))
            .toEqual({ largeur: TAILLE_RADAR, hauteur: TAILLE_RADAR });
        expect(tailleDetecteur(detecteur({ categorie: 'radar', dimension: 25 }), 40))
            .toEqual({ largeur: TAILLE_RADAR, hauteur: TAILLE_RADAR });
        expect(tailleDetecteur(detecteur({ categorie: 'boutonPoussoir', dimension: null }), 40))
            .toEqual({ largeur: TAILLE_BOUTON, hauteur: TAILLE_BOUTON });
    });
});

describe('dessin des symboles', () => {
    it('dessine une boucle en rectangle à coins carrés, en pointillé', () => {
        const { container } = render(<div>{renderDetecteurSVG(detecteur(), 10)}</div>);
        const rect = container.querySelector('rect');
        expect(rect).not.toBeNull();
        expect(rect?.getAttribute('rx')).toBeNull();
        expect(rect?.getAttribute('stroke-dasharray')).toBe('6 4');
        expect(rect?.getAttribute('fill')).toBe('none');
    });

    it('dessine le radar avec un cône et deux arcs d’onde', () => {
        const { container } = render(<div>{renderDetecteurSVG(detecteur({ categorie: 'radar' }), 10)}</div>);
        expect(container.querySelectorAll('path')).toHaveLength(3);
    });

    it('dessine le bouton poussoir dans un cercle avec une main', () => {
        const { container } = render(<div>{renderDetecteurSVG(detecteur({ categorie: 'boutonPoussoir' }), 10)}</div>);
        expect(container.querySelector('circle')).not.toBeNull();
        expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
    });
});
