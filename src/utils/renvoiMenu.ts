/**
 * Renvoi de l'aide en ligne vers la barre de menus. L'aide vit souvent dans une
 * fenêtre détachée, rendue par une autre racine React : le chemin passe donc par
 * ce petit magasin de module, où la barre de menus s'inscrit. Sans barre inscrite,
 * comme dans le module Onde verte, les renvois restent de simples textes.
 */
type OuvrirMenu = (chemin: string[]) => boolean;

let ouvrirMenu: OuvrirMenu | null = null;

export const definirOuvertureMenu = (ouvrir: OuvrirMenu | null) => { ouvrirMenu = ouvrir; };

export const menuAccessible = () => ouvrirMenu !== null;

/** Ouvre le menu au bon endroit et ramène la fenêtre principale devant l'aide. */
export const allerAuMenu = (chemin: string): boolean => {
    if (!ouvrirMenu?.(chemin.split(' → '))) return false;
    try { window.focus(); } catch { /* ignore */ }
    return true;
};

/** Libellé sans casse, coche ni points de suite : l'aide écrit « … », le menu « ... ». */
export const libelleMenu = (texte: string) => texte.replace(/[✓▶]/g, '').trim().replace(/(\.\.\.|…)$/, '').trim().toLowerCase();

/** L'entrée au libellé exact ou, à défaut, celle qui commence par lui (« Dupliquer »). */
export const trouverEntreeMenu = <T extends { label?: string; type?: string }>(entrees: T[], libelle: string): T | undefined => {
    const cible = libelleMenu(libelle);
    const nommees = entrees.filter(e => e.label && e.type !== 'header');
    return nommees.find(e => libelleMenu(e.label!) === cible) ?? nommees.find(e => libelleMenu(e.label!).startsWith(cible));
};
