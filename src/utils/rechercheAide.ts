/**
 * Recherche dans l'aide en ligne.
 *
 * La recherche ignore la casse et les accents (« ecran » trouve « écran »),
 * comme les apostrophes typographiques et les espaces multiples. Elle travaille
 * sur le texte affiché, découpé en nœuds texte par le DOM : chaque caractère
 * normalisé garde la trace du nœud et de la position d'où il vient, pour que
 * l'occurrence trouvée redevienne une plage (Range) à surligner.
 */

/** Texte normalisé, avec la position d'origine de chacun de ses caractères. */
export interface TexteNormalise {
    texte: string;
    origine: number[];
}

const normaliserCaractere = (c: string): string => {
    if (/\s/.test(c)) return ' ';
    if (c === '’' || c === '‘' || c === 'ʼ') return "'";
    if (c === 'œ' || c === 'Œ') return 'oe';
    if (c === 'æ' || c === 'Æ') return 'ae';
    return c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
};

/** Normalise un texte ; `origine[i]` est l'indice, dans `texte` d'entrée, du i-ième caractère produit. */
export const normaliser = (source: string, decalage = 0, precedentEspace = false): TexteNormalise => {
    let texte = '';
    const origine: number[] = [];
    let espace = precedentEspace;
    for (let i = 0; i < source.length; i++) {
        const n = normaliserCaractere(source[i]);
        if (n === ' ') {
            if (espace) continue;
            espace = true;
        } else if (n) {
            espace = false;
        }
        for (const c of n) {
            texte += c;
            origine.push(decalage + i);
        }
    }
    return { texte, origine };
};

/** Requête prête à chercher : normalisée, sans espace au bord. Vide si trop courte. */
export const preparerRequete = (requete: string): string => {
    const r = normaliser(requete).texte.trim();
    return r.length >= 2 ? r : '';
};

/** Débuts des occurrences (sans chevauchement) de `requete`, déjà préparée, dans `texte`. */
export const positionsOccurrences = (texte: string, requete: string): number[] => {
    if (!requete) return [];
    const positions: number[] = [];
    for (let i = texte.indexOf(requete); i !== -1; i = texte.indexOf(requete, i + requete.length)) {
        positions.push(i);
    }
    return positions;
};

/** Un chapitre (h3) ou une section (h4) de l'aide. */
export interface RubriqueAide {
    id: string;
    titre: string;
}

/** Une occurrence trouvée : sa plage dans la page, et la rubrique qui la contient. */
export interface OccurrenceAide {
    debut: { noeud: Text; offset: number };
    fin: { noeud: Text; offset: number };
    chapitre: RubriqueAide | null;
    section: RubriqueAide | null;
}

/** Index du texte de l'aide : construit une fois, l'aide est statique. */
export interface IndexAide {
    texte: string;
    /** Pour chaque caractère de `texte` : son nœud et sa position dans ce nœud. */
    noeuds: Text[];
    offsets: number[];
    /** Rubrique de chaque caractère, en indices dans `rubriques`. */
    chapitres: number[];
    sections: number[];
    rubriques: RubriqueAide[];
}

const rubrique = (el: Element): RubriqueAide => ({ id: el.id, titre: (el.textContent ?? '').trim() });

/**
 * Parcourt le texte affiché sous `racine`, hors des éléments qui répondent au
 * sélecteur `exclure` (sommaire, barre de recherche, boutons).
 */
export const indexerAide = (racine: Element, exclure: string): IndexAide => {
    const index: IndexAide = { texte: '', noeuds: [], offsets: [], chapitres: [], sections: [], rubriques: [] };
    let chapitre = -1;
    let section = -1;
    // nodeType plutôt qu'instanceof : dans la fenêtre détachée de l'aide, les
    // nœuds appartiennent à une autre fenêtre, dont Element n'est pas le nôtre.
    const estElement = (n: Node): n is Element => n.nodeType === Node.ELEMENT_NODE;
    const walker = racine.ownerDocument.createTreeWalker(racine, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (estElement(n) && n.matches(exclure) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (estElement(n)) {
            if (n.tagName === 'H3') {
                index.rubriques.push(rubrique(n));
                chapitre = index.rubriques.length - 1;
                section = -1;
            } else if (n.tagName === 'H4') {
                index.rubriques.push(rubrique(n));
                section = index.rubriques.length - 1;
            }
            continue;
        }
        const noeud = n as Text;
        const valeur = noeud.data;
        const { texte, origine } = normaliser(valeur, 0, index.texte.endsWith(' '));
        index.texte += texte;
        for (const o of origine) {
            index.noeuds.push(noeud);
            index.offsets.push(o);
            index.chapitres.push(chapitre);
            index.sections.push(section);
        }
    }
    return index;
};

/** Occurrences de la requête dans l'aide indexée, dans l'ordre du texte. */
export const chercherDansAide = (index: IndexAide, requete: string): OccurrenceAide[] => {
    const r = preparerRequete(requete);
    return positionsOccurrences(index.texte, r).map(p => {
        const dernier = p + r.length - 1;
        const chapitre = index.chapitres[p];
        const section = index.sections[p];
        return {
            debut: { noeud: index.noeuds[p], offset: index.offsets[p] },
            fin: { noeud: index.noeuds[dernier], offset: index.offsets[dernier] + 1 },
            chapitre: chapitre >= 0 ? index.rubriques[chapitre] : null,
            section: section >= 0 ? index.rubriques[section] : null,
        };
    });
};

/** Une rubrique de la liste déroulante : la section (ou le chapitre) et ses occurrences. */
export interface ResultatRubrique {
    chapitre: RubriqueAide | null;
    rubrique: RubriqueAide | null;
    nombre: number;
    /** Indice, dans la liste des occurrences, de la première de cette rubrique. */
    premiere: number;
}

/** Regroupe les occurrences par section, dans l'ordre de l'aide. */
export const regrouperParRubrique = (occurrences: OccurrenceAide[]): ResultatRubrique[] => {
    const resultats: ResultatRubrique[] = [];
    occurrences.forEach((o, i) => {
        const r = o.section ?? o.chapitre;
        const dernier = resultats[resultats.length - 1];
        if (dernier && dernier.rubrique === r) dernier.nombre++;
        else resultats.push({ chapitre: o.chapitre, rubrique: r, nombre: 1, premiere: i });
    });
    return resultats;
};
