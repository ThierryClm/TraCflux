/**
 * Couleurs de mise en valeur des commentaires et des remarques (touches + / −).
 *
 * Le vert était #4CAF50, peu lisible sur le fond sombre de l'application : il
 * passe au vert fluo. Les textes déjà colorés gardent leur ancien vert dans le
 * fichier ; `vertFluo` le remplace à l'affichage, et l'édition suivante
 * enregistre la nouvelle couleur.
 */
export const VERT_TEXTE = '#39FF14';
export const ROUGE_TEXTE = '#F44336';

const ANCIEN_VERT = /#4caf50|rgb\(\s*76\s*,\s*175\s*,\s*80\s*\)/gi;

export const vertFluo = (html: string | undefined): string => (html || '').replace(ANCIEN_VERT, VERT_TEXTE);

/** Texte d'un champ mis en forme, sans balises ni style (entités décodées). */
export const texteBrut = (html: string | undefined): string => {
    if (!html) return '';
    const bloc = document.createElement('div');
    bloc.innerHTML = html;
    return (bloc.textContent || '').replace(/ /g, ' ').trim();
};

/**
 * Texte simple d'un champ mis en forme, sauts de ligne conservés : ceux des
 * balises <br> et des blocs (<div>, <p>, <li>) créés par l'éditeur. Couleurs,
 * tailles et balises disparaissent.
 */
export const texteAvecSauts = (html: string | undefined): string => {
    if (!html) return '';
    const bloc = document.createElement('div');
    bloc.innerHTML = html;
    bloc.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    bloc.querySelectorAll('div, p, li').forEach(el => el.before('\n'));
    return (bloc.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
};
