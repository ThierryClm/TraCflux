import { useCallback, useEffect, useState } from 'react';

/** Cases d'affichage de l'image du carrefour. */
export interface IntersectionDisplayOptions {
    /** Calque des flèches : courants de circulation, numéros et noms. */
    showCurrents: boolean;
    showGroupNumbers: boolean;
    showGroupNames: boolean;
    /** Mode d'ajout d'une flèche au clic. */
    showArrows: boolean;
    /** Vue Signaux, exclusive avec les flèches : signaux ISR à la place de celles-ci. */
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
    const [options, setOptions] = useState<IntersectionDisplayOptions>(() => {
        // Signaux et flèches sont exclusifs : un choix « signaux » enregistré
        // par une version antérieure l'emporte sur les courants.
        const signals = readStored('showSignals', false);
        return {
            showCurrents: !signals && readStored('showCurrents'),
            showGroupNumbers: readStored('showGroupNumbers'),
            showGroupNames: readStored('showGroupNames'),
            showArrows: readStored('showArrows', false),
            showSignals: signals,
            showDetecteurs: readStored('showDetecteurs'),
            showDetecteurNames: readStored('showDetecteurNames')
        };
    });

    useEffect(() => {
        OPTIONS.forEach(option => {
            try {
                localStorage.setItem(STORAGE_KEYS[option], JSON.stringify(options[option]));
            } catch { /* stockage indisponible : la valeur reste celle du projet */ }
        });
    }, [options]);

    const setOption = useCallback((option: IntersectionDisplayOption, value: boolean) => {
        setOptions(prev => {
            const next = { ...prev, [option]: value };
            // Flèches et signaux s'excluent : cocher l'un décoche l'autre.
            if (option === 'showSignals' && value) {
                next.showCurrents = false;
                next.showArrows = false;
            }
            if (option === 'showCurrents') {
                if (value) next.showSignals = false;
                else next.showArrows = false;
            }
            return next;
        });
    }, []);

    return { intersectionDisplay: options, setIntersectionDisplayOption: setOption };
};

export default useIntersectionDisplayOptions;
