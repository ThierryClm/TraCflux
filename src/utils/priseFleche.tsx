import { Children, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode, SVGProps } from 'react';

const FORMES = new Set(['line', 'polyline', 'path', 'polygon']);

// Épaisseur visée à l'écran. Le symbole fait 96 px pour un viewBox de 32 :
// une unité SVG vaut donc 3 px, à multiplier par l'échelle de la flèche.
const EPAISSEUR_PRISE_PX = 14;
const PX_PAR_UNITE = 3;

const doublures = (enfants: ReactNode, epaisseur: number): ReactNode[] =>
    Children.toArray(enfants).flatMap((enfant) => {
        if (!isValidElement<SVGProps<SVGElement>>(enfant)) return [];
        if (enfant.type === 'g') return doublures(enfant.props.children, epaisseur);
        if (typeof enfant.type !== 'string' || !FORMES.has(enfant.type)) return [];
        return [cloneElement(enfant, {
            className: 'fleche-prise',
            fill: 'none',
            stroke: 'transparent',
            strokeWidth: epaisseur,
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
        })];
    });

/**
 * Ajoute à une flèche une doublure invisible qui suit son tracé. La zone de survol
 * épouse ainsi la flèche, son orientation comprise, et reste facile à viser quelle
 * que soit son échelle, là où le carré du symbole recouvrait les flèches voisines.
 */
const avecPriseSurvol = (
    fleche: ReactElement<SVGProps<SVGSVGElement>>,
    echelle: number
): ReactElement<SVGProps<SVGSVGElement>> => {
    const epaisseur = EPAISSEUR_PRISE_PX / (PX_PAR_UNITE * (echelle || 1));
    return cloneElement(fleche, undefined, ...Children.toArray(fleche.props.children), ...doublures(fleche.props.children, epaisseur));
};

export default avecPriseSurvol;
