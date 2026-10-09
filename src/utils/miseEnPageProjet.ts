import type { OptionsMiseEnPage, Projet } from '../types/projet';
import { CROP_BASIS, DEFAULT_CROP, DEFAULT_ZOOM } from './floatingImageBox';

/** Réglages de mise en page persistants d'un projet. */
type DirectoryKey = 'open' | 'save' | 'import' | 'image' | 'greenWave';

interface LayoutValues extends OptionsMiseEnPage {
    diagramHeight?: number | null;
    floatingCrop?: Record<string, unknown>;
    floatingZoom?: number;
    sidebarVisible?: boolean;
    directoryNames?: Partial<Record<DirectoryKey, string | null>>;
}

type LayoutSetter = (value?: unknown) => void;
type LayoutSetters = Record<string, LayoutSetter | undefined>;

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

/** Applique les réglages persistants lors de l'ouverture d'un projet. */
export const appliquerMiseEnPage = (
    data: Partial<Projet> | null | undefined,
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

    const poseurs: Partial<Record<keyof OptionsMiseEnPage, LayoutSetter>> = {
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
        const aDesCommentaires = data.groups?.some(g => g.comment && g.comment.trim() !== '')
            || (data.pfTabs || []).some(pf => pf.diagram?.some(d => d.comment && d.comment.trim() !== ''));
        s.setShowComments?.(!!aDesCommentaires);
        s.setShowRemarks?.(!!(data.pfTabs || []).some(pf => pf.remarques && pf.remarques.trim() !== ''));
        s.setSidebarVisible?.(true);
        DRAPEAUX_MISE_EN_PAGE
            .filter(nom => nom.startsWith('showFloating'))
            .forEach(nom => poseurs[nom]?.(false));
    }

    if (data.dossierSections && Object.keys(data.dossierSections).length > 0) {
        s.setDossierSections?.(data.dossierSections);
    }
};
