/**
 * Dossier imprimé, sorti d'App.tsx tel quel.
 *
 * - useMiseEnPageImpression : orientation et largeur de la feuille, largeurs
 *   relevées sur le tableau des conditions pour que l'impression replie le
 *   texte aux mêmes endroits qu'à l'écran.
 * - useImpressionDossier : pied de page, copie figée de l'aperçu imprimée
 *   dans un onglet indépendant, boutons Imprimer et Exporter PDF.
 *
 * Les deux hooks sont appelés là où vivait leur code : l'ordre des effets
 * d'App ne change pas.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type { LargeursColonnes } from '../components/ActionTable';
import type { TypeImpression } from './useDialogState';
import { APP_NAME, APP_VERSION } from '../version';
import { copieAvecAncetres, documentImpression, ouvrirOngletImpression } from '../utils/ongletImpression';
import { toast } from '../utils/toast';

interface EntreesMiseEnPage {
    actionColWidths: Partial<LargeursColonnes> | undefined;
    activeTab: string;
    simulationEnabled: boolean;
    phasageBulleEnabled: boolean;
}

/** Orientation, largeur de la feuille et relevés du tableau des conditions. */
export const useMiseEnPageImpression = ({ actionColWidths, activeTab, simulationEnabled, phasageBulleEnabled }: EntreesMiseEnPage) => {
    // Repli de la colonne « Action_Micro » à l'impression, en caractères.
    //
    // Il ne se DÉDUIT pas : une estimation de la chasse à partir de la taille de
    // police donnait 41 caractères là où l'écran en met 57, et les équations se
    // coupaient ailleurs. On MESURE donc le champ tel qu'il est rendu — largeur
    // utile divisée par la largeur d'un caractère, exacte en chasse fixe — et
    // l'unité ch reporte ce compte à l'impression, quelle que soit la taille du
    // texte imprimé. Les lignes se coupent alors aux mêmes endroits.
    // Largeur du conteneur d'impression du dossier, en px CSS.
    //
    // La mise en page d'impression a son propre gabarit : ni le papier converti
    // en pixels CSS (1047), ni la largeur de la fenêtre. Sur ce poste, la mesure
    // relevée pendant le rendu d'impression donne 1683 px — c'est la valeur de
    // départ, corrigée automatiquement ailleurs par la mesure ci-dessous.
    //
    // Cette mesure ne se prend QUE lorsque le média d'impression est actif :
    // « beforeprint » se déclenche encore sur la mise en page d'écran et
    // renvoyait la largeur de la fenêtre, sans rapport avec la feuille.
    // Orientation du dossier imprimé. Le paysage reste la valeur par défaut :
    // c'est lui qui donne au diagramme la largeur nécessaire pour un cycle long.
    const [dossierPortrait, setDossierPortrait] = useState(() => {
        try { return localStorage.getItem('dossier_orientation') === 'portrait'; } catch { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem('dossier_orientation', dossierPortrait ? 'portrait' : 'paysage'); } catch { /* quota */ }
    }, [dossierPortrait]);

    // Largeur de la feuille, DÉCIDÉE et non relevée.
    //
    // Elle était mesurée pendant l'impression (`documentElement.clientWidth`) et
    // mise en cache. Or une mesure ne sert qu'à l'impression SUIVANTE : en
    // changeant d'orientation on repartait d'une valeur par défaut, d'où deux
    // tirages nécessaires avant d'obtenir la bonne proportion du diagramme.
    //
    // Le relevé valait exactement la largeur de la feuille entière — 1122 px pour
    // les 297 mm d'une A4 paysage, soit 96 px par pouce. On peut donc la calculer
    // plutôt que l'attendre, ce qui supprime le décalage d'un tirage.
    // Zone utile, marges de la feuille déduites : 297 - 2 × 10 en paysage,
    // 210 - 2 × 10 en portrait. On y donnait auparavant la largeur de la feuille
    // ENTIÈRE, si bien que le diagramme débordait de 13 mm dans la marge.
    const dossierPrintWidth = (dossierPortrait ? 190 : 277) * (96 / 25.4);

    const [microPrintStyle, setMicroPrintStyle] = useState<CSSProperties | null>(null);

    // Même recette pour la Description, devenue multiligne : sans report de la
    // largeur d'écran, l'impression replie où elle veut, et sans `pre-wrap`
    // (cf. App.css) les sauts de ligne saisis disparaissent purement.
    //
    // Nuance par rapport à Action_Micro : cette colonne n'a pas de calque
    // d'affichage à mesurer, on mesure donc la zone de saisie elle-même. Elle
    // réserve de quoi loger un caractère de plus, si bien qu'un mot en bout de
    // ligne peut se placer autrement qu'à l'écran.
    const [descriptionPrintStyle, setDescriptionPrintStyle] = useState<CSSProperties | null>(null);
    const [largeurTableauConditions, setLargeurTableauConditions] = useState(0);
    /**
     * Relève sur l'écran les largeurs dont l'impression a besoin.
     *
     * Trois mesures, un seul relevé : la largeur totale du tableau des
     * conditions — qui sert à le réduire en portrait — et les largeurs utiles
     * des colonnes Action_Micro et Description, reportées telles quelles à
     * l'impression pour que le navigateur y replie le texte aux mêmes endroits
     * qu'à l'écran.
     *
     * Elle ne se contente plus de tourner au montage. Le tableau n'est pas
     * toujours monté à cet instant — un projet chargé ensuite, l'onglet
     * Simulation ou Phasage actif — et plus rien ne relançait la mesure : la
     * largeur restait à zéro, le tableau partait à l'impression à sa largeur
     * d'écran, sans réduction. Plus large que la feuille en portrait, il
     * faisait alors rétrécir TOUT le document par le navigateur, diagramme
     * compris. Elle est donc aussi appelée à l'ouverture de la boîte
     * d'impression, où le tableau est à coup sûr en place.
     */
    const mesurerColonnesImpression = useCallback(() => {
        const tableau = document.querySelector<HTMLElement>('.action-table');
        if (tableau?.offsetWidth) setLargeurTableauConditions(tableau.offsetWidth);

        /** Largeur intérieure d'un champ, rembourrage déduit. */
        const utileDe = (champ: Element) => {
            const style = window.getComputedStyle(champ);
            return {
                style,
                utile: champ.clientWidth
                    - (parseFloat(style.paddingLeft) || 0)
                    - (parseFloat(style.paddingRight) || 0)
            };
        };

        // Action_Micro : on mesure le calque d'affichage, pas la zone de saisie.
        // C'est lui que l'utilisateur lit (le texte de la zone de saisie est
        // transparent), et sa largeur de repli est la bonne au pixel près. La
        // zone de saisie, elle, réserve de quoi loger un caractère de plus —
        // d'où le « et » qui montait d'une ligne à l'impression.
        const champMicro = document.querySelector('.action-table .micro-highlight-backdrop')
            || document.querySelector('.action-table .input-micro');
        if (champMicro) {
            const { style, utile } = utileDe(champMicro);
            // Même largeur ET même police : c'est le navigateur qui replie, avec
            // les mêmes données qu'à l'écran, donc aux mêmes endroits. Compter
            // les caractères était une approximation — 62 par ligne à
            // l'impression contre 57 à l'écran — et l'équation se coupait
            // ailleurs, ce qui est précisément ce qu'il faut éviter ici.
            if (utile > 0) setMicroPrintStyle({
                width: `${Math.round(utile)}px`,
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight
            });
        }

        // Description : pas de calque d'affichage, on mesure la zone de saisie.
        const champDesc = document.querySelector('.action-table .input-desc');
        if (champDesc) {
            const { style, utile } = utileDe(champDesc);
            // Pas de fontFamily : à l'écran ce champ est en monospace, comme
            // tout `select` et `textarea` du tableau, mais à l'impression il
            // doit s'aligner sur la colonne Action, en proportionnelle. Le
            // repli peut donc différer d'un mot de celui de l'écran ; la
            // largeur, elle, est respectée.
            if (utile > 0) setDescriptionPrintStyle({
                width: `${Math.round(utile)}px`,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight
            });
        }
    }, []);

    // La mesure se refait au montage et à chaque redimensionnement de colonne.
    // Pas de printType dans les dépendances : il est déclaré plus bas, et le
    // citer ici plantait le module au chargement (accès avant initialisation).
    // Relevé du DOM rendu, recopié dans l'état : c'est bien une synchronisation
    // avec l'extérieur. Dans App, la règle ne voyait pas ce setState indirect.
    useEffect(() => {
        // oxlint-disable-next-line react/set-state-in-effect
        mesurerColonnesImpression();
    }, [mesurerColonnesImpression, actionColWidths?.micro, actionColWidths?.description,
        activeTab, simulationEnabled, phasageBulleEnabled]);
    /**
     * Largeur du tableau des conditions à retenir pour l'impression.
     *
     * La mesure d'écran est la bonne valeur — elle porte les colonnes telles que
     * l'utilisateur les a réglées. Mais elle suppose le tableau monté, ce qu'il
     * n'est pas lorsqu'on imprime depuis l'onglet Simulation ou Phasage. Sans
     * repli, le tableau partait alors à sa largeur naturelle, débordait la
     * feuille en portrait, et le navigateur réduisait TOUT le document —
     * diagramme compris, aux trois quarts de sa taille.
     *
     * Le repli reconstruit cette largeur à partir des trois colonnes réglables
     * et d'une constante pour les dix autres, relevée à 343 px sur le tableau
     * par défaut (961 px pour 160 + 420 + 38 de colonnes réglables). Une
     * approximation suffit : elle ne sert qu'à décider d'un facteur de
     * réduction, et quelques pixels d'écart ne se voient pas.
     */
    const LARGEUR_COLONNES_FIXES = 343;
    const largeurConditionsImpression = largeurTableauConditions > 0
        ? largeurTableauConditions
        : LARGEUR_COLONNES_FIXES
            + (actionColWidths?.description ?? 160)
            + (actionColWidths?.micro ?? 420)
            + (actionColWidths?.abrv ?? 38);

    return {
        dossierPortrait, setDossierPortrait, dossierPrintWidth,
        microPrintStyle, descriptionPrintStyle, mesurerColonnesImpression, largeurConditionsImpression
    };
};

interface EntreesImpression {
    dossierPortrait: boolean;
    /** Nom du carrefour, repris en haut des pages à partir de la 2e. */
    nomCarrefour?: string;
    /** Nom du fichier projet (avec ou sans .json), repris en bas des pages à partir de la 2e. */
    nomFichier?: string | null;
    setDossierDialog: Dispatch<SetStateAction<boolean>>;
    setPrintType: Dispatch<SetStateAction<TypeImpression | null>>;
    setPrintPreviewModal: Dispatch<SetStateAction<boolean>>;
}

/** Impression de l'aperçu dans un onglet indépendant ; Imprimer et Exporter PDF. */
/** Chaîne CSS entre guillemets : guillemets et barres obliques échappés, sauts de ligne aplatis. */
const chaineCss = (texte: string) => `"${texte.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;

interface MentionsPages {
    /** Outil et version, en bas à gauche de chaque page. */
    signature: string;
    /** Nom du carrefour, en haut au centre à partir de la 2e page. */
    carrefour?: string;
    /** Nom du fichier, extension comprise, en bas au centre à partir de la 2e page. */
    fichier?: string;
}

/**
 * Marges de page du dossier imprimé (boîtes de marge @page).
 *
 * Sur chaque page : l'outil et sa version en bas à gauche, le numéro de page
 * en bas à droite. À partir de la 2e page — la première est la page de garde,
 * qui porte déjà le nom du carrefour en titre — le nom du carrefour en haut au
 * centre et le nom du fichier, extension comprise, en bas au centre : une feuille
 * isolée dit de quel carrefour et de quel fichier elle vient.
 *
 * Le chemin du fichier et la date ne figurent pas : le navigateur imprime
 * déjà la date, l'heure et le titre du document en tête de chaque feuille.
 */
export const stylePagesDossier = ({ signature, carrefour, fichier }: MentionsPages): string => {
    const police = 'font-size: 10px; color: #444;';
    const marges = [
        `@bottom-left { content: ${chaineCss(signature)}; ${police} }`,
        `@bottom-right { content: "Page " counter(page); ${police} }`,
        carrefour ? `@top-center { content: ${chaineCss(carrefour)}; ${police} }` : '',
        fichier ? `@bottom-center { content: ${chaineCss(fichier)}; ${police} }` : '',
    ].filter(Boolean).join('\n    ');
    return ['dossier-page', 'dossier-page-portrait'].map(page => `
@page ${page} {
    ${marges}
}
@page ${page}:first {
    @top-center { content: none; }
    @bottom-center { content: none; }
}`).join('\n');
};

/**
 * Nom du fichier projet tel qu'imprimé, avec son extension .json. Un projet
 * sans fichier (restauré du cache, exemple) est désigné par son nom de projet,
 * complété de .json : c'est le nom qu'aurait son fichier.
 */
export const nomDeFichier = (nom: string | null | undefined): string => {
    const brut = (nom || '').trim();
    if (!brut) return '';
    return /\.json$/i.test(brut) ? brut : `${brut}.json`;
};

export const useImpressionDossier = ({ dossierPortrait, setDossierDialog, setPrintType, setPrintPreviewModal, nomCarrefour, nomFichier }: EntreesImpression) => {
    // Injecte les marges de page du dossier le temps de la copie (cf. stylePagesDossier).
    const injectDossierFooterStyle = () => {
        const prev = document.getElementById('dossier-print-footer-style');
        if (prev) prev.remove();
        const style = document.createElement('style');
        style.id = 'dossier-print-footer-style';
        style.textContent = stylePagesDossier({
            signature: `${APP_NAME} ${APP_VERSION}`,
            carrefour: nomCarrefour?.trim(),
            fichier: nomDeFichier(nomFichier),
        });
        document.head.appendChild(style);
        return style;
    };

    // Imprime l'aperçu affiché dans un onglet indépendant (cf.
    // utils/ongletImpression) : une copie figée, avec les classes print-* et
    // le pied de page du dossier, que les règles @media print attendent.
    // window.print() appelé ici figeait TraCflux et ses fenêtres détachées
    // tant que la boîte d'impression restait ouverte.
    const imprimerApercu = (type: string) => {
        const apercu = document.querySelector('.print-preview-overlay');
        if (!apercu) return;
        const footerStyle = type === 'dossier' ? injectDossierFooterStyle() : null;
        const classesBody = [
            document.body.className,
            `print-${type}`,
            type === 'dossier' && dossierPortrait ? 'print-portrait' : ''
        ].filter(Boolean).join(' ');
        const html = documentImpression(copieAvecAncetres(apercu), {
            titre: document.title.replace(/^\* /, ''),
            classesBody
        });
        footerStyle?.remove();
        ouvrirOngletImpression(html);
    };

    // Handler confirmation impression dossier (Imprimer)
    // Ouvre la modale d'aperçu (hors écran), le temps qu'elle se dessine, puis
    // l'imprime dans un onglet indépendant. 500 ms restent dans le délai où le
    // navigateur rattache encore l'ouverture de l'onglet au clic.
    const handleDossierConfirm = () => {
        setDossierDialog(false);
        setPrintType('dossier');
        setPrintPreviewModal(true);
        setTimeout(() => {
            imprimerApercu('dossier');
            setPrintPreviewModal(false);
            setPrintType(null);
        }, 500);
    };

    // Handler export PDF : même flow que Imprimer, avec un message invitant à
    // choisir « Enregistrer au format PDF » comme imprimante. Garantit un rendu
    // identique à l'impression.
    const handleDossierExportPDF = () => {
        setDossierDialog(false);
        setPrintType('dossier');
        setPrintPreviewModal(true);
        toast.info('Dans la boîte d\'impression, sélectionnez « Enregistrer au format PDF »');
        setTimeout(() => {
            imprimerApercu('dossier');
            setPrintPreviewModal(false);
            setPrintType(null);
        }, 500);
    };

    return { imprimerApercu, handleDossierConfirm, handleDossierExportPDF };
};
