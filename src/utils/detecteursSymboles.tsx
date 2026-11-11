import type { CategorieDetecteur, Detecteur } from '../types/projet';
import { estBoucle } from './detecteurs';

/** Couleur de chaque catégorie de détecteur sur l'image. */
export const COULEUR_DETECTEUR: Record<CategorieDetecteur, string> = {
    bouclePiedFeu: '#4fc3f7',
    boucleEloignee: '#9575cd',
    boucleComptage: '#66bb6a',
    radar: '#000000',
    boutonPoussoir: '#000000'
};

/** Le radar et le bouton poussoir gardent une taille fixe à l'écran. */
export const TAILLE_RADAR = 28;
export const TAILLE_BOUTON = 26;

/** Longueur de boucle retenue pour le dessin quand la dimension est vide. */
const LONGUEUR_PAR_DEFAUT_M = 3;

export interface TailleDetecteur {
    largeur: number;
    hauteur: number;
}

/**
 * Taille du symbole à l'écran, en pixels CSS.
 * Les boucles suivent l'échelle du projet : largeur fixe de 1 m, longueur en
 * mètres. Le radar et le bouton poussoir ne dépendent pas de l'échelle.
 */
export const tailleDetecteur = (detecteur: Detecteur, pixelsParMetre: number): TailleDetecteur => {
    if (detecteur.categorie === 'radar') return { largeur: TAILLE_RADAR, hauteur: TAILLE_RADAR };
    if (detecteur.categorie === 'boutonPoussoir') return { largeur: TAILLE_BOUTON, hauteur: TAILLE_BOUTON };
    const longueurM = detecteur.dimension ?? (detecteur.categorie === 'boucleComptage' ? 2 : LONGUEUR_PAR_DEFAUT_M);
    return {
        largeur: Math.max(6, pixelsParMetre),
        hauteur: Math.max(8, longueurM * pixelsParMetre)
    };
};

/** Le nom tient-il dans la boucle, ou faut-il le poser juste au-dessus ? */
export const etiquetteDansBoucle = (detecteur: Detecteur, taille: TailleDetecteur): boolean =>
    estBoucle(detecteur.categorie) && taille.hauteur >= 40;

/**
 * Dessin SVG du symbole, centré dans une boîte de la taille calculée.
 * La rotation est appliquée par le conteneur, comme pour les flèches.
 */
export const renderDetecteurSVG = (detecteur: Detecteur, pixelsParMetre: number) => {
    const couleur = COULEUR_DETECTEUR[detecteur.categorie];
    const { largeur, hauteur } = tailleDetecteur(detecteur, pixelsParMetre);

    if (detecteur.categorie === 'radar') {
        return (
            <svg width={largeur} height={hauteur} viewBox="0 0 40 40" aria-hidden="true">
                {/* Cône ouvert vers la chaussée, pointe en haut. */}
                <path
                    d="M20 4 L7 32 A16 16 0 0 0 33 32 Z"
                    fill={couleur}
                    fillOpacity="0.18"
                    stroke={couleur}
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
                {/* Deux arcs d'onde. */}
                <path d="M13.5 22 A9 9 0 0 0 26.5 22" fill="none" stroke={couleur} strokeWidth="2" strokeLinecap="round" />
                <path d="M9.5 27 A14 14 0 0 0 30.5 27" fill="none" stroke={couleur} strokeWidth="2" strokeLinecap="round" />
            </svg>
        );
    }

    if (detecteur.categorie === 'boutonPoussoir') {
        return (
            <svg width={largeur} height={hauteur} viewBox="0 0 26 26" aria-hidden="true">
                <circle cx="13" cy="13" r="11" fill={couleur} fillOpacity="0.18" stroke={couleur} strokeWidth="2" />
                {/* Pictogramme de main, simplifié pour rester lisible à 26 px. */}
                <path
                    d="M9 14 v-3 a1.2 1.2 0 0 1 2.4 0 v2 M11.4 13 V9.2 a1.2 1.2 0 0 1 2.4 0 V13 M13.8 13 V10 a1.2 1.2 0 0 1 2.4 0 v4 M16.2 14 v-1.8 a1.2 1.2 0 0 1 2.4 0 V16 c0 3.2-2.4 5.4-5.4 5.4 h-1 c-2.6 0-4.4-1.8-4.4-4.4 v-2.4 l-1.2-1.2 a1.2 1.2 0 0 1 1.7-1.7 L9 13"
                    fill="none"
                    stroke={couleur}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }

    // Boucle : rectangle à coins carrés, trait pointillé, largeur 1 m.
    return (
        <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden="true">
            <rect
                x="1"
                y="1"
                width={Math.max(1, largeur - 2)}
                height={Math.max(1, hauteur - 2)}
                fill="none"
                stroke="#000000"
                strokeWidth="1"
                strokeDasharray="4 3"
            />
        </svg>
    );
};
