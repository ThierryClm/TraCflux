/**
 * Affichage des commentaires et des remarques du diagramme.
 *
 * Un seul réglage pour tout le projet, à trois valeurs :
 * - 'afficher' : toujours affichés ;
 * - 'masquer'  : jamais affichés ;
 * - 'auto'     : affichés seulement pour les plans de feux qui en ont.
 *
 * Le projet enregistre le mode (commentsMode / remarksMode) ET l'ancien
 * booléen (showComments / showRemarks), pour qu'une version antérieure de
 * TraCflux ouvre le fichier sans perdre l'affichage.
 */
export type ModeAffichage = 'afficher' | 'masquer' | 'auto';

const MODES: readonly ModeAffichage[] = ['afficher', 'masquer', 'auto'];

export const estModeAffichage = (v: unknown): v is ModeAffichage =>
    typeof v === 'string' && (MODES as readonly string[]).includes(v);

/** Booléen à écrire pour les versions qui ne connaissent pas le mode. */
export const booleenDuMode = (mode: ModeAffichage): boolean => mode !== 'masquer';

/** Mode équivalent à un ancien booléen enregistré. */
export const modeDuBooleen = (affiche: boolean): ModeAffichage => (affiche ? 'afficher' : 'masquer');

interface OptionsAffichage {
    commentsMode?: unknown;
    remarksMode?: unknown;
    showComments?: unknown;
    showRemarks?: unknown;
}

/**
 * Mode enregistré dans les options de mise en page d'un projet : le mode
 * l'emporte, sinon l'ancien booléen ; undefined si le projet n'en dit rien.
 */
export const lireModeAffichage = (
    lo: OptionsAffichage | null | undefined,
    quoi: 'comments' | 'remarks'
): ModeAffichage | undefined => {
    if (!lo) return undefined;
    const mode = quoi === 'comments' ? lo.commentsMode : lo.remarksMode;
    if (estModeAffichage(mode)) return mode;
    const booleen = quoi === 'comments' ? lo.showComments : lo.showRemarks;
    return typeof booleen === 'boolean' ? modeDuBooleen(booleen) : undefined;
};

/** Affichage effectif pour le plan de feux courant. */
export const estAffiche = (mode: ModeAffichage, planEnContient: boolean): boolean =>
    mode === 'afficher' || (mode === 'auto' && planEnContient);

export const texteRenseigne = (texte: unknown): boolean =>
    typeof texte === 'string' && texte.trim() !== '';

/** Le plan courant a-t-il au moins un commentaire de groupe ? */
export const planACommentaires = (groups: ReadonlyArray<{ comment?: string }> | null | undefined): boolean =>
    !!groups?.some(g => texteRenseigne(g.comment));
