import type { CategorieDetecteur, Detecteur, PositionDetecteur } from '../types/projet';

/** Catégories proposées dans la liste « Type » du tableau des détecteurs. */
export const CATEGORIES_DETECTEUR: { valeur: CategorieDetecteur; libelle: string }[] = [
    { valeur: 'bouclePiedFeu', libelle: 'Boucle de pied de feu' },
    { valeur: 'boucleEloignee', libelle: 'Boucle éloignée' },
    { valeur: 'boucleComptage', libelle: 'Boucle de comptage' },
    { valeur: 'radar', libelle: 'Radar' },
    { valeur: 'boutonPoussoir', libelle: 'Bouton poussoir' }
];

export const LIBELLE_CATEGORIE: Record<CategorieDetecteur, string> = {
    bouclePiedFeu: 'Boucle de pied de feu',
    boucleEloignee: 'Boucle éloignée',
    boucleComptage: 'Boucle de comptage',
    radar: 'Radar',
    boutonPoussoir: 'Bouton poussoir'
};

/** Largeur d'une boucle, fixe : seule sa longueur se saisit. */
export const LARGEUR_BOUCLE_M = 1;

/** Longueur proposée pour une boucle de comptage, posée après le carrefour. */
export const DIMENSION_COMPTAGE_M = 2;

/** Échelle par défaut de l'image : pixels de l'image pour un mètre. */
export const PIXELS_PAR_METRE_DEFAUT = 12;
export const PIXELS_PAR_METRE_MIN = 1;
export const PIXELS_PAR_METRE_MAX = 500;

/** Largeur de voie moyenne retenue comme référence d'échelle. */
export const LARGEUR_VOIE_REFERENCE_M = 7;

export const estCategorieDetecteur = (valeur: unknown): valeur is CategorieDetecteur =>
    typeof valeur === 'string' && CATEGORIES_DETECTEUR.some(c => c.valeur === valeur);

export const estBoutonPoussoir = (categorie: CategorieDetecteur): boolean =>
    categorie === 'boutonPoussoir';

/** Les trois catégories dessinées en boucle (rectangle pointillé). */
export const estBoucle = (categorie: CategorieDetecteur): boolean =>
    categorie === 'bouclePiedFeu' || categorie === 'boucleEloignee' || categorie === 'boucleComptage';

/** Seules les boucles ont une dimension : ni le radar ni le bouton n'en ont. */
export const dimensionSaisissable = (categorie: CategorieDetecteur): boolean =>
    estBoucle(categorie);

export const dimensionParDefaut = (categorie: CategorieDetecteur): number | null =>
    categorie === 'boucleComptage' ? DIMENSION_COMPTAGE_M : null;

export const descriptionDimension = (categorie: CategorieDetecteur): string => {
    if (categorie === 'radar') return 'Un radar n’a pas de dimension : symbole de taille fixe';
    if (estBoutonPoussoir(categorie)) return 'Un bouton poussoir n’a pas de dimension';
    return `Longueur de la boucle, en mètres (largeur ${LARGEUR_BOUCLE_M} m)`;
};

/** Nombre lu depuis un champ de saisie (virgule décimale admise). */
const nombreFini = (valeur: unknown): number | null => {
    if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : null;
    if (typeof valeur === 'string' && valeur.trim() !== '') {
        const n = Number(valeur.trim().replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }
    return null;
};

/** Échelle relue d'un projet, bornée ; une valeur absente ou illisible reprend le défaut. */
export const normaliserPixelsParMetre = (valeur: unknown): number => {
    const n = nombreFini(valeur);
    if (n === null) return PIXELS_PAR_METRE_DEFAUT;
    return Math.min(PIXELS_PAR_METRE_MAX, Math.max(PIXELS_PAR_METRE_MIN, n));
};

/** Longueur ou portée saisie ; null quand la valeur est vide ou sans objet. */
export const dimensionDepuisSaisie = (
    valeur: string,
    categorie: CategorieDetecteur
): number | null => {
    if (!dimensionSaisissable(categorie)) return null;
    const n = nombreFini(valeur);
    return n !== null && n > 0 ? n : null;
};

export const prochainIdDetecteur = (existants: Detecteur[]): number =>
    existants.reduce((max, d) => Math.max(max, d.id), 0) + 1;

const nomDeBase = (existants: Detecteur[]): string => {
    const noms = new Set(existants.map(d => d.nom.trim()));
    let n = 1;
    while (noms.has(`Détecteur ${n}`)) n++;
    return `Détecteur ${n}`;
};

const nomDeCopie = (existants: Detecteur[], nom: string): string => {
    const noms = new Set(existants.map(d => d.nom.trim()));
    const base = `${nom.trim() || 'Détecteur'} (copie)`;
    if (!noms.has(base)) return base;
    let n = 2;
    while (noms.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
};

/** Un détecteur neuf, sans groupe de feu ni position. */
export const creerDetecteur = (
    existants: Detecteur[],
    categorie: CategorieDetecteur = 'bouclePiedFeu'
): Detecteur => ({
    id: prochainIdDetecteur(existants),
    nom: nomDeBase(existants),
    categorie,
    gf: null,
    dimension: dimensionParDefaut(categorie),
    position: null,
    orientation: 0,
    note: ''
});

/**
 * Changement de type : le bouton poussoir perd sa dimension ; une boucle ou un
 * radar qui n'en avait pas reçoit celle de sa catégorie, s'il y en a une.
 */
export const changerCategorie = (detecteur: Detecteur, categorie: CategorieDetecteur): Detecteur => {
    if (categorie === detecteur.categorie) return detecteur;
    let dimension = detecteur.dimension;
    if (!dimensionSaisissable(categorie)) dimension = null;
    else if (dimension === null) dimension = dimensionParDefaut(categorie);
    return { ...detecteur, categorie, dimension };
};

/** Copie insérée juste après l'original, avec un nom libre. */
export const dupliquerDetecteur = (existants: Detecteur[], id: number): Detecteur[] => {
    const index = existants.findIndex(d => d.id === id);
    if (index === -1) return existants;
    const source = existants[index];
    const copie: Detecteur = {
        ...source,
        id: prochainIdDetecteur(existants),
        nom: nomDeCopie(existants, source.nom),
        position: source.position ? { ...source.position } : null
    };
    return [...existants.slice(0, index + 1), copie, ...existants.slice(index + 1)];
};

const positionValide = (valeur: unknown): PositionDetecteur | null => {
    if (!valeur || typeof valeur !== 'object') return null;
    const p = valeur as Record<string, unknown>;
    const x = nombreFini(p.x);
    const y = nombreFini(p.y);
    return x === null || y === null ? null : { x, y };
};

/**
 * Relit la liste d'un projet enregistré : un fichier antérieur au module n'en
 * a pas, et une entrée abîmée ne doit pas faire échouer l'ouverture.
 */
export const normaliserDetecteurs = (valeur: unknown): Detecteur[] => {
    if (!Array.isArray(valeur)) return [];
    const resultat: Detecteur[] = [];
    const ids = new Set<number>();
    for (const brut of valeur) {
        if (!brut || typeof brut !== 'object') continue;
        const d = brut as Record<string, unknown>;
        const idLu = nombreFini(d.id);
        let id = idLu !== null && Number.isInteger(idLu) && idLu > 0 && !ids.has(idLu)
            ? idLu
            : resultat.reduce((max, x) => Math.max(max, x.id), 0) + 1;
        while (ids.has(id)) id++;
        ids.add(id);
        const categorie = estCategorieDetecteur(d.categorie) ? d.categorie : 'bouclePiedFeu';
        const gf = nombreFini(d.gf);
        const dimension = nombreFini(d.dimension);
        resultat.push({
            id,
            nom: typeof d.nom === 'string' ? d.nom : '',
            categorie,
            gf: gf !== null && Number.isInteger(gf) && gf > 0 ? gf : null,
            dimension: estBoutonPoussoir(categorie) || dimension === null || dimension <= 0
                ? null
                : dimension,
            position: positionValide(d.position),
            orientation: nombreFini(d.orientation) ?? 0,
            note: typeof d.note === 'string' ? d.note : ''
        });
    }
    return resultat;
};
