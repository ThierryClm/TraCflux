/**
 * Durée d'un point de repos, lue dans la description de sa condition :
 * « attente maxi 15 secondes » fige le cycle 15 s en simulation.
 *
 * Seul compte le nombre accolé à « maxi » (ou « max », « maximum »,
 * « maximale ») : juste après — « attente maxi 15 », « Sémard maxi 16'' » —
 * ou, à défaut, juste avant, unité comprise — « 12'' max », « 12 s maxi ».
 * Un autre chiffre de la description (« GF 3 », « V2 ») ne compte pas.
 * Plafonnée à 30 s ; sans valeur lisible, 10 s, la durée fixe d'avant.
 */
export const DUREE_REPOS_DEFAUT = 10;
export const DUREE_REPOS_MAX = 30;

/** Description proposée à la création d'un point de repos. */
export const DESCRIPTION_REPOS_DEFAUT = `attente maxi ${DUREE_REPOS_DEFAUT} secondes`;

const MAXI = String.raw`max(?:i|imum|imale)?\b\.?`;
/** « maxi », puis le nombre : « maxi 15 », « maxi : 16'' ». */
const NOMBRE_APRES = new RegExp(String.raw`\b${MAXI}\s*:?\s*(\d+)`, 'i');
/**
 * Le nombre, son unité éventuelle, puis « maxi » : « 12'' max », « 12 s maxi ».
 * Pas un numéro de groupe ou de plan (« GF 3 maxi »).
 */
const NOMBRE_AVANT = new RegExp(String.raw`(?<![\d\p{L}])(?<!\b(?:GF|PF)\s*)(\d+)\s*(?:['’″"]{1,2}|s\b|sec\b|secondes?\b)?\s*${MAXI}`, 'iu');

/** Position du nombre de la durée dans la description, s'il y en a un. */
const trouverDuree = (texte: string): { valeur: number; debut: number; fin: number } | null => {
    const position = (nombre: string, debut: number) =>
        ({ valeur: parseInt(nombre, 10), debut, fin: debut + nombre.length });
    // Après « maxi » d'abord : le nombre termine la correspondance.
    const apres = NOMBRE_APRES.exec(texte);
    if (apres) return position(apres[1], apres.index + apres[0].length - apres[1].length);
    // Sinon avant : le nombre l'ouvre.
    const avant = NOMBRE_AVANT.exec(texte);
    return avant ? position(avant[1], avant.index) : null;
};

/** Durée du repos, en secondes, d'après la description de la condition. */
export const lireDureeRepos = (description: string | null | undefined): number => {
    const valeur = trouverDuree(description || '')?.valeur ?? NaN;
    if (!(valeur > 0)) return DUREE_REPOS_DEFAUT;
    return Math.min(valeur, DUREE_REPOS_MAX);
};

export interface MorceauDescription {
    texte: string;
    /** Le nombre de « attente maxi N », mis en couleur dans le tableau. */
    duree: boolean;
}

/** Découpe une description pour colorer la durée d'attente. */
export const decouperDescription = (description: string | null | undefined): MorceauDescription[] => {
    const texte = description || '';
    const trouve = trouverDuree(texte);
    if (!trouve) return texte ? [{ texte, duree: false }] : [];
    const { debut: debutNombre, fin: finNombre } = trouve;
    return [
        { texte: texte.slice(0, debutNombre), duree: false },
        { texte: texte.slice(debutNombre, finNombre), duree: true },
        { texte: texte.slice(finNombre), duree: false },
    ].filter(m => m.texte !== '');
};

