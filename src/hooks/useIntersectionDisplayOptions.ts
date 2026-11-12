import { useCallback, useEffect, useState } from 'react';

/** Cases d'affichage de l'image du carrefour. */
export interface IntersectionDisplayOptions {
    /** Calque des courants de circulation : flèches, numéros, noms et signaux. */
    showCurrents: boolean;
    showGroupNumbers: boolean;
    showGroupNames: boolean;
    /** Mode d'ajout d'une flèche au clic. */
    showArrows: boolean;
    /** Signal ISR du groupe à la place de sa flèche, si le champ Signal est renseigné. */
    showSignals: boolean;
    /** Calque des détecteurs de terrain. */
    showDetecteurs: boolean;
    /** Nom affiché à côté des détecteurs. */
    showDetecteurNames: boolean;
}

export type IntersectionDisplayOption = keyof IntersectionDisplayOptions;

const STORAGE_KEYS: Record<IntersectionDisplayOption, string> = {
    showCurrents: 'intersection_showCurrents',
    showGroupNumbers: 'intersection_showGroupNumbers',
    showGroupNames: 'intersection_showGroupNames',
    showArrows: 'intersection_showArrows',
    showSignals: 'intersection_showSignals',
    showDetecteurs: 'intersection_showDetecteurs',
    showDetecteurNames: 'intersection_showDetecteurNames'
};

const OPTIONS = Object.keys(STORAGE_KEYS) as IntersectionDisplayOption[];

const readStored = (option: IntersectionDisplayOption, parDefaut = true): boolean => {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS[option]);
        return saved !== null ? JSON.parse(saved) : parDefaut;
    } catch {
        return parDefaut;
    }
};

/**
 * Cases de l'image du carrefour, en deux familles : les courants de
 * circulation (calque, numéro et nom des GF, ajout d'une flèche, signaux) et
 * les détecteurs (calque, nom, ajout).
 *
 * Elles appartiennent au projet et s'enregistrent avec ses options de mise en
 * page : un carrefour dont les flèches sont posées garde l'ajout désactivé à
 * chaque réouverture. Le navigateur retient en plus la dernière
 * valeur, reprise par les projets enregistrés avant que ces cases n'en fassent
 * partie.
 */
const useIntersectionDisplayOptions = () => {
    const [options, setOptions] = useState<IntersectionDisplayOptions>(() => ({
        showCurrents: readStored('showCurrents'),
        showGroupNumbers: readStored('showGroupNumbers'),
        showGroupNames: readStored('showGroupNames'),
        showArrows: readStored('showArrows', false),
        showSignals: readStored('showSignals', false),
        showDetecteurs: readStored('showDetecteurs'),
        showDetecteurNames: readStored('showDetecteurNames')
    }));

    useEffect(() => {
        OPTIONS.forEach(option => {
            try {
                localStorage.setItem(STORAGE_KEYS[option], JSON.stringify(options[option]));
            } catch { /* stockage indisponible : la valeur reste celle du projet */ }
        });
    }, [options]);

    const setOption = useCallback((option: IntersectionDisplayOption, value: boolean) => {
        setOptions(prev => (prev[option] === value ? prev : { ...prev, [option]: value }));
    }, []);

    return { intersectionDisplay: options, setIntersectionDisplayOption: setOption };
};

export default useIntersectionDisplayOptions;
