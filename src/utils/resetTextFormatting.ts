/**
 * Retire uniquement les styles de couleur et de taille ajoutés au texte riche.
 * Les retours à la ligne et les autres éventuels attributs sont conservés.
 */
export const resetTextFormatting = (editable: HTMLElement): string => {
    const styledElements = Array.from(editable.querySelectorAll<HTMLElement>('*'));

    styledElements.forEach((element) => {
        element.style.removeProperty('color');
        element.style.removeProperty('font-size');

        if (!element.getAttribute('style')?.trim()) {
            element.removeAttribute('style');
        }
    });

    // Les spans créés uniquement pour la couleur/taille n'ont plus de rôle.
    // On les déballe du plus profond au plus proche de la racine.
    styledElements.reverse().forEach((element) => {
        if (element.tagName === 'SPAN' && element.attributes.length === 0) {
            element.replaceWith(...Array.from(element.childNodes));
        }
    });

    editable.normalize();
    return editable.innerHTML;
};
