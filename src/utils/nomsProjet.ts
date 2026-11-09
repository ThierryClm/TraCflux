/** Le nom de fichier identifie la sauvegarde ; le titre décrit le carrefour. */
export const nomSansExtension = (nom: string): string => nom.replace(/\.json$/i, '');

export const nomsALOuverture = (nomFichier: string, titre?: string | null) => ({
    projectName: nomSansExtension(nomFichier),
    intersectionName: titre?.trim() ? titre : nomSansExtension(nomFichier)
});

/** Seul un premier enregistrement peut initialiser un titre encore vide. */
export const nomsALaSauvegarde = (etat: { projectName?: string | null; intersectionName?: string }, nomFichier: string) => ({
    projectName: nomSansExtension(nomFichier),
    intersectionName: (etat.intersectionName?.trim() || etat.projectName)
        ? etat.intersectionName ?? ''
        : nomSansExtension(nomFichier)
});

export const nomFichierSuggere = (nomFichier: string | null, titre: string): string => `${nomFichier || titre.trim() || 'projet'}.json`;
