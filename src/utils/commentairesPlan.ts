import type { Groupe, PlanDeFeu } from '../types/projet';

/** Commentaire renseigné d'un groupe dans un plan de feu. */
export interface CommentaireGroupe {
    groupId: number;
    texte: string;
    couleur: string;
}

/**
 * Commentaires renseignés d'un plan de feu, dans l'ordre des groupes. Le plan
 * actif se lit dans les groupes à l'écran, à jour ; les autres dans leur
 * diagramme enregistré, avec le même repli que lorsqu'on ouvre l'onglet.
 */
export const commentairesDuPlan = (
    pf: PlanDeFeu,
    actif: { activePFId: number; groups: Groupe[] }
): CommentaireGroupe[] => actif.groups
    .map(g => {
        const ligne = pf.id === actif.activePFId ? undefined : pf.diagram?.find(d => d.groupId === g.id);
        const texte = ligne?.comment !== undefined ? ligne.comment : g.comment;
        const couleur = ligne?.commentColor !== undefined ? ligne.commentColor : g.commentColor;
        return { groupId: g.id, texte: (texte || '').trim(), couleur: couleur || '' };
    })
    .filter(c => c.texte !== '');

/** Le plan a des remarques (texte visible, balises de mise en forme ôtées). */
export const remarquesRenseignees = (pf: PlanDeFeu): boolean =>
    (pf.remarques || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';

/**
 * Cases « Commentaires » et « Remarques » du dossier. Un dossier enregistré
 * avant leur arrivée imprimait toujours les remarques et jamais les
 * commentaires : lu ainsi, il imprime ce qu'il imprimait.
 */
export const imprimerRemarques = (sections: Record<string, boolean>, pfId: number) =>
    sections[`remarques_${pfId}`] !== false;
export const imprimerCommentaires = (sections: Record<string, boolean>, pfId: number) =>
    !!sections[`commentaires_${pfId}`];
