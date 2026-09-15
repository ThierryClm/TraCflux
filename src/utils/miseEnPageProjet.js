/**
 * Les réglages de mise en page qui appartiennent au projet.
 *
 * Six clés — hauteur du diagramme, cadrage et zoom de l'image détachée, options
 * d'affichage, répertoires de travail — qui ne vivent pas dans `useTrafficLight`
 * mais dans `App`. Le fichier `.json` les portait, le cache localStorage non :
 * rouvrir un projet depuis la liste les perdait donc silencieusement.
 *
 * Elles transitent maintenant par `champsProjetRef`, comme les cases du dossier
 * d'impression, ce qui les fait entrer dans `getFullState` — et donc dans les
 * DEUX écrivains à la fois, sans que personne ait à y penser.
 *
 * La lecture et l'écriture vivent ici, en un seul exemplaire. C'est la
 * duplication d'une même logique entre le lecteur « fichier » et le lecteur
 * « cache » qui a produit, une par une, toutes les pertes constatées.
 */
import { CROP_BASIS, DEFAULT_CROP, DEFAULT_ZOOM } from './floatingImageBox';

/** Les sept drapeaux de détachement, plus les quatre options d'affichage. */
const DRAPEAUX_MISE_EN_PAGE = [
    'showParameters', 'showComments', 'showRemarks', 'showActionDescription',
    'showFloatingForm', 'showFloatingMatrix', 'showFloatingTraffic',
    'showFloatingImage', 'showFloatingConditions', 'showFloatingVariables',
    'showFloatingRemarks'
];

/**
 * Compose les six clés à partir de l'état courant de l'application.
 * Le résultat est fusionné dans `getFullState`, donc écrit à l'identique dans
 * le fichier et dans le cache.
 */
export const lireMiseEnPage = (v) => ({
    diagramHeight: v.diagramHeight,
    floatingCrop: v.floatingCrop,
    floatingCropBasis: CROP_BASIS,
    floatingZoom: v.floatingZoom,
    layoutOptions: {
        showParameters: v.sidebarVisible,
        showComments: v.showComments,
        showRemarks: v.showRemarks,
        showActionDescription: v.showActionDescription,
        showFloatingForm: v.showFloatingForm,
        showFloatingMatrix: v.showFloatingMatrix,
        showFloatingTraffic: v.showFloatingTraffic,
        showFloatingImage: v.showFloatingImage,
        showFloatingConditions: v.showFloatingConditions,
        showFloatingVariables: v.showFloatingVariables,
        showFloatingRemarks: v.showFloatingRemarks
    },
    directoryNames: {
        open: v.directoryNames?.open ?? null,
        save: v.directoryNames?.save ?? null,
        import: v.directoryNames?.import ?? null,
        image: v.directoryNames?.image ?? null,
        greenWave: v.directoryNames?.greenWave ?? null
    }
});

/**
 * Applique les six clés à l'ouverture d'un projet, quel que soit le chemin.
 *
 * Les valeurs de repli comptent autant que les valeurs lues : un projet
 * enregistré avant l'existence d'une option ne doit pas hériter du réglage du
 * projet précédent. C'est pourquoi l'absence d'une clé remet une valeur neutre
 * plutôt que de ne rien faire.
 */
export const appliquerMiseEnPage = (data, s) => {
    if (!data || typeof data !== 'object') return;

    // Hauteur du diagramme : absente, on efface aussi la valeur mémorisée par
    // le navigateur, qui reviendrait sinon au prochain rechargement.
    if (data.diagramHeight !== undefined && data.diagramHeight !== null) {
        s.setDiagramHeight?.(data.diagramHeight);
    } else {
        s.resetDiagramHeight?.();
    }

    // Cadrage et zoom de l'image détachée : hériter de ceux du projet précédent
    // n'a pas de sens et laissait les curseurs déjà engagés au premier
    // détachement.
    s.setFloatingCrop?.(data.floatingCrop !== undefined ? data.floatingCrop : { ...DEFAULT_CROP });
    s.setFloatingZoom?.(data.floatingZoom !== undefined ? data.floatingZoom : DEFAULT_ZOOM);
    s.markLegacyCrop?.(data.floatingCrop !== undefined && data.floatingCropBasis !== CROP_BASIS);

    const poseurs = {
        showParameters: s.setSidebarVisible,
        showComments: s.setShowComments,
        showRemarks: s.setShowRemarks,
        showActionDescription: s.setShowActionDescription,
        showFloatingForm: s.setShowFloatingForm,
        showFloatingMatrix: s.setShowFloatingMatrix,
        showFloatingTraffic: s.setShowFloatingTraffic,
        showFloatingImage: s.setShowFloatingImage,
        showFloatingConditions: s.setShowFloatingConditions,
        showFloatingVariables: s.setShowFloatingVariables,
        showFloatingRemarks: s.setShowFloatingRemarks
    };

    if (data.layoutOptions && typeof data.layoutOptions === 'object') {
        const lo = data.layoutOptions;
        // Le panneau des paramètres est le seul dont l'absence a une valeur
        // par défaut affirmative : un projet antérieur à l'option l'affichait.
        s.setSidebarVisible?.(typeof lo.showParameters === 'boolean' ? lo.showParameters : true);
        DRAPEAUX_MISE_EN_PAGE.forEach(nom => {
            if (nom === 'showParameters') return;
            if (typeof lo[nom] === 'boolean') poseurs[nom]?.(lo[nom]);
        });
    } else {
        // Projet ancien, sans layoutOptions : on devine les commentaires et les
        // remarques d'après leur contenu, et on repart d'un espace de travail
        // propre — l'utilisateur détachera ce dont il a besoin.
        const aDesCommentaires = data.groups?.some(g => g.comment && g.comment.trim() !== '')
            || (data.pfTabs || []).some(pf => pf.diagram?.some(d => d.comment && d.comment.trim() !== ''));
        s.setShowComments?.(!!aDesCommentaires);
        s.setShowRemarks?.(!!(data.pfTabs || []).some(pf => pf.remarques && pf.remarques.trim() !== ''));
        s.setSidebarVisible?.(true);
        ['showFloatingForm', 'showFloatingMatrix', 'showFloatingTraffic', 'showFloatingImage',
            'showFloatingConditions', 'showFloatingVariables', 'showFloatingRemarks']
            .forEach(nom => poseurs[nom]?.(false));
    }

    // Cases du dossier d'impression : absentes d'un projet antérieur, on garde
    // celles en place plutôt que de tout décocher.
    if (data.dossierSections && Object.keys(data.dossierSections).length > 0) {
        s.setDossierSections?.(data.dossierSections);
    }
};
