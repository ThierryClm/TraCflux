import type { CadrageImage, OptionsMiseEnPage, Projet } from '../types/projet';
import { CROP_BASIS, DEFAULT_CROP, DEFAULT_ZOOM } from './floatingImageBox';

/** Réglages de mise en page persistants d'un projet. */
type DirectoryKey = 'open' | 'save' | 'import' | 'image' | 'greenWave';

interface LayoutValues extends OptionsMiseEnPage {
    diagramHeight?: number | null;
    floatingCrop?: CadrageImage;
    floatingZoom?: number;
    sidebarVisible?: boolean;
    directoryNames?: Partial<Record<DirectoryKey, string | null>>;
}

type SetterBooleen = (value: boolean) => void;

/** Projet à appliquer : seul compte le texte des commentaires de ses groupes. */
type DonneesMiseEnPage = Omit<Partial<Projet>, 'groups'> & { groups?: Array<{ comment?: string }> };

/** Les setters de l'application que l'ouverture d'un projet met à jour. */
interface LayoutSetters {
    setDiagramHeight?: (height: number) => void;
    resetDiagramHeight?: () => void;
    setFloatingCrop?: (crop: CadrageImage) => void;
    setFloatingZoom?: (zoom: number) => void;
    markLegacyCrop?: (legacy: boolean) => void;
    setSidebarVisible?: SetterBooleen;
    setShowComments?: SetterBooleen;
    setShowRemarks?: SetterBooleen;
    setShowActionDescription?: SetterBooleen;
    setShowFloatingForm?: SetterBooleen;
    setShowFloatingMatrix?: SetterBooleen;
    setShowFloatingTraffic?: SetterBooleen;
    setShowFloatingImage?: SetterBooleen;
    setShowFloatingConditions?: SetterBooleen;
    setShowFloatingVariables?: SetterBooleen;
    setShowFloatingRemarks?: SetterBooleen;
    setShowImageGroupNumbers?: SetterBooleen;
    setShowImageGroupNames?: SetterBooleen;
    setShowImageArrows?: SetterBooleen;
    setDossierSections?: (sections: Record<string, boolean>) => void;
}

/**
 * Les sept drapeaux de détachement, les quatre options d'affichage et les
 * trois cases de l'image du carrefour.
 * La liste est liée au type afin qu'une nouvelle option ne puisse pas être
 * oubliée silencieusement lors de la persistance.
 */
const DRAPEAUX_MISE_EN_PAGE: (keyof OptionsMiseEnPage)[] = [
    'showParameters', 'showComments', 'showRemarks', 'showActionDescription',
    'showFloatingForm', 'showFloatingMatrix', 'showFloatingTraffic',
    'showFloatingImage', 'showFloatingConditions', 'showFloatingVariables',
    'showFloatingRemarks',
    'showImageGroupNumbers', 'showImageGroupNames', 'showImageArrows'
];

/** Compose les réglages persistants depuis l'état courant de l'application. */
export const lireMiseEnPage = (v: LayoutValues): Partial<Projet> => ({
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
        showFloatingRemarks: v.showFloatingRemarks,
        showImageGroupNumbers: v.showImageGroupNumbers,
        showImageGroupNames: v.showImageGroupNames,
        showImageArrows: v.showImageArrows
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
 * Affichage des commentaires et remarques du diagramme à l'ouverture d'un
 * projet. Le réglage enregistré dans le projet l'emporte ; un projet antérieur,
 * qui n'en a pas, l'affiche s'il a du contenu à montrer.
 */
export const affichageCommentairesRemarques = (
    data: DonneesMiseEnPage
): { showComments: boolean; showRemarks: boolean } => {
    const lo = data.layoutOptions || {};
    const plans = data.pfTabs || [];
    const aDesCommentaires = !!(data.groups?.some(g => g.comment && g.comment.trim() !== '')
        || plans.some(pf => pf.diagram?.some(d => d.comment && d.comment.trim() !== '')));
    const aDesRemarques = plans.some(pf => pf.remarques && pf.remarques.trim() !== '');
    return {
        showComments: typeof lo.showComments === 'boolean' ? lo.showComments : aDesCommentaires,
        showRemarks: typeof lo.showRemarks === 'boolean' ? lo.showRemarks : aDesRemarques
    };
};

/** Applique les réglages persistants lors de l'ouverture d'un projet. */
export const appliquerMiseEnPage = (
    data: DonneesMiseEnPage | null | undefined,
    s: LayoutSetters
): void => {
    if (!data || typeof data !== 'object') return;

    if (data.diagramHeight !== undefined && data.diagramHeight !== null) {
        s.setDiagramHeight?.(data.diagramHeight);
    } else {
        s.resetDiagramHeight?.();
    }

    s.setFloatingCrop?.(data.floatingCrop !== undefined ? data.floatingCrop : { ...DEFAULT_CROP });
    s.setFloatingZoom?.(data.floatingZoom !== undefined ? data.floatingZoom : DEFAULT_ZOOM);
    s.markLegacyCrop?.(data.floatingCrop !== undefined && data.floatingCropBasis !== CROP_BASIS);

    const poseurs: Partial<Record<keyof OptionsMiseEnPage, SetterBooleen>> = {
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
        showFloatingRemarks: s.setShowFloatingRemarks,
        showImageGroupNumbers: s.setShowImageGroupNumbers,
        showImageGroupNames: s.setShowImageGroupNames,
        showImageArrows: s.setShowImageArrows
    };

    if (data.layoutOptions && typeof data.layoutOptions === 'object') {
        const lo = data.layoutOptions;
        s.setSidebarVisible?.(typeof lo.showParameters === 'boolean' ? lo.showParameters : true);
        DRAPEAUX_MISE_EN_PAGE.forEach(nom => {
            if (nom === 'showParameters') return;
            if (typeof lo[nom] === 'boolean') poseurs[nom]?.(lo[nom]);
        });
    } else {
        const affichage = affichageCommentairesRemarques(data);
        s.setShowComments?.(affichage.showComments);
        s.setShowRemarks?.(affichage.showRemarks);
        s.setSidebarVisible?.(true);
        DRAPEAUX_MISE_EN_PAGE
            .filter(nom => nom.startsWith('showFloating'))
            .forEach(nom => poseurs[nom]?.(false));
    }

    if (data.dossierSections && Object.keys(data.dossierSections).length > 0) {
        s.setDossierSections?.(data.dossierSections);
    }
};
