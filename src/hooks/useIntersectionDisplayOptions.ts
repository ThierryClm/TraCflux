import { useCallback, useEffect, useState } from 'react';

/** Cases d'affichage de l'image du carrefour. */
export interface IntersectionDisplayOptions {
    showGroupNumbers: boolean;
    showGroupNames: boolean;
    /** Ajout de flèches au clic sur l'image (« Ajouter un courant de circulation »). */
    showArrows: boolean;
    /** Signal ISR du groupe à la place de sa flèche, si le champ Signal est renseigné. */
    showSignals: boolean;
    /** Calque des détecteurs de terrain. */
    showDetecteurs: boolean;
}

export type IntersectionDisplayOption = keyof IntersectionDisplayOptions;

const STORAGE_KEYS: Record<IntersectionDisplayOption, string> = {
    showGroupNumbers: 'intersection_showGroupNumbers',
    showGroupNames: 'intersection_showGroupNames',
    showArrows: 'intersection_showArrows',
    showSignals: 'intersection_showSignals',
    showDetecteurs: 'intersection_showDetecteurs'
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
 * Cases « Afficher numéro de groupe », « Afficher noms des groupes »,
 * « Ajouter un courant de circulation » (ajout de flèches au clic), « Signal »
 * (décochée d'origine : les flèches restent la vue par défaut) et « Détecteurs »
 * de l'image du carrefour.
 *
 * Elles appartiennent au projet et s'enregistrent avec ses options de mise en
 * page : un carrefour dont les flèches sont posées garde l'ajout désactivé à
 * chaque réouverture. Le navigateur retient en plus la dernière
 * valeur, reprise par les projets enregistrés avant que ces cases n'en fassent
 * partie.
 */
const useIntersectionDisplayOptions = () => {
    const [options, setOptions] = useState<IntersectionDisplayOptions>(() => ({
        showGroupNumbers: readStored('showGroupNumbers'),
        showGroupNames: readStored('showGroupNames'),
        showArrows: readStored('showArrows'),
        showSignals: readStored('showSignals', false),
        showDetecteurs: readStored('showDetecteurs')
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
