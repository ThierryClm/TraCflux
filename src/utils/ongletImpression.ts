/**
 * Impression dans un onglet indépendant.
 *
 * window.print() bloque la page qui l'appelle tant que la boîte d'impression
 * est ouverte — et, avec elle, les fenêtres qu'elle a détachées. On imprime
 * donc une copie figée de ce qui doit sortir sur papier, dans un onglet
 * ouvert sans lien avec TraCflux (noopener) : le navigateur le place dans un
 * processus à part, et TraCflux reste utilisable pendant l'impression.
 *
 * L'onglet reçoit un document autonome (styles de la page, adresse de base
 * pour les polices et les images), lance l'impression une fois chargé et se
 * ferme ensuite.
 */

/** Échappe un texte inséré dans le document d'impression. */
export const echapperHtml = (texte: string): string =>
    texte.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/**
 * Règles CSS de la page : le contenu imprimé garde ses polices, ses classes
 * et ses règles @media print. Une feuille illisible (autre origine) est
 * importée par son adresse.
 */
export const cssDuDocument = (doc: Document): string =>
    Array.from(doc.styleSheets).map((feuille) => {
        try {
            return Array.from(feuille.cssRules).map(regle => regle.cssText).join('\n');
        } catch {
            return feuille.href ? `@import url("${feuille.href}");` : '';
        }
    }).join('\n');

/** Imprime une fois chargé, puis ferme l'onglet. */
const SCRIPT_IMPRESSION = '<script>'
    + "window.addEventListener('afterprint', function () { window.close(); });"
    + "window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });"
    + '</script>';

export interface OptionsDocumentImpression {
    /** Titre du document : en-tête du navigateur, nom proposé pour le PDF. */
    titre: string;
    /** Classes du <body>. */
    classesBody?: string;
    /** Règles ajoutées après celles de la page. */
    styleSupplementaire?: string;
    /** Document d'où viennent les styles et l'adresse de base. */
    source?: Document;
}

/** Assemble le document autonome autour d'un contenu HTML. */
export const documentImpression = (
    contenuBody: string,
    { titre, classesBody = '', styleSupplementaire = '', source = document }: OptionsDocumentImpression
): string => {
    const html = source.documentElement;
    const classesHtml = html.className ? ` class="${echapperHtml(html.className)}"` : '';
    return '<!DOCTYPE html>\n'
        + `<html lang="fr"${classesHtml}><head><meta charset="utf-8">`
        + `<base href="${echapperHtml(source.baseURI)}"><title>${echapperHtml(titre)}</title>`
        + `<style>${cssDuDocument(source).replace(/<\/style/gi, '<\\/style')}</style>`
        + (styleSupplementaire ? `<style>${styleSupplementaire}</style>` : '')
        + `</head><body class="${echapperHtml(classesBody)}">`
        + contenuBody
        + SCRIPT_IMPRESSION
        + '</body></html>';
};

/**
 * Recopie dans le clone les valeurs saisies : cloneNode ne reprend que les
 * attributs, pas l'état courant des champs.
 */
const recopierSaisies = (original: Element, clone: Element): void => {
    const sources = original.querySelectorAll('input, textarea, select');
    const cibles = clone.querySelectorAll('input, textarea, select');
    sources.forEach((src, i) => {
        const cible = cibles[i];
        if (!cible) return;
        if (src instanceof HTMLInputElement) {
            if (src.type === 'checkbox' || src.type === 'radio') {
                if (src.checked) cible.setAttribute('checked', '');
                else cible.removeAttribute('checked');
            } else {
                cible.setAttribute('value', src.value);
            }
        } else if (src instanceof HTMLTextAreaElement) {
            cible.textContent = src.value;
        } else if (src instanceof HTMLSelectElement) {
            Array.from((cible as HTMLSelectElement).options).forEach((opt, j) => {
                if (j === src.selectedIndex) opt.setAttribute('selected', '');
                else opt.removeAttribute('selected');
            });
        }
    });
};

/**
 * Copie figée d'un élément de la page, enveloppée de ses ancêtres (copiés
 * sans leurs autres enfants) jusqu'au <body> : les règles CSS qui passent par
 * un ancêtre (#root…) continuent de s'appliquer dans l'onglet d'impression.
 */
export const copieAvecAncetres = (element: Element): string => {
    const copie = element.cloneNode(true) as Element;
    recopierSaisies(element, copie);
    copie.querySelectorAll('script').forEach(s => s.remove());

    let enveloppe: Element = copie;
    let parent = element.parentElement;
    while (parent && parent !== element.ownerDocument.body && parent !== element.ownerDocument.documentElement) {
        const ancetre = parent.cloneNode(false) as Element;
        ancetre.appendChild(enveloppe);
        enveloppe = ancetre;
        parent = parent.parentElement;
    }
    return enveloppe.outerHTML;
};

/**
 * Ouvre le document dans un onglet indépendant. À appeler dans les quelques
 * secondes qui suivent le clic de l'utilisateur, sans quoi le bloqueur de
 * fenêtres surgissantes l'arrêterait.
 */
export const ouvrirOngletImpression = (html: string): void => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    // Laisse à l'onglet le temps de charger le document avant de libérer l'adresse.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
