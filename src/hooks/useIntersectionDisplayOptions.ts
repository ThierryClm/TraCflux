import { useCallback, useEffect, useState } from 'react';

/** Cases d'affichage de l'image du carrefour. */
export interface IntersectionDisplayOptions {
    showGroupNumbers: boolean;
    showGroupNames: boolean;
    /** Ajout de flèches au clic sur l'image (« Ajouter un courant de circulation »). */
    showArrows: boolean;
}

export type IntersectionDisplayOption = keyof IntersectionDisplayOptions;

const STORAGE_KEYS: Record<IntersectionDisplayOption, string> = {
    showGroupNumbers: 'intersection_showGroupNumbers',
    showGroupNames: 'intersection_showGroupNames',
    showArrows: 'intersection_showArrows'
};

const OPTIONS = Object.keys(STORAGE_KEYS) as IntersectionDisplayOption[];

const readStored = (option: IntersectionDisplayOption): boolean => {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS[option]);
        return saved !== null ? JSON.parse(saved) : true;
    } catch {
        return true;
    }
};

/**
 * Cases « Afficher numéro de groupe », « Afficher noms des groupes » et
 * « Ajouter un courant de circulation » (ajout de flèches au clic) de l'image
 * du carrefour.
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
        showArrows: readStored('showArrows')
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
