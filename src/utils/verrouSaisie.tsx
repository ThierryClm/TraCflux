/**
 * Verrouillage de la saisie par section (Mise en page → Verrouillage saisie).
 *
 * Sur un smartphone, toucher un champ pour faire défiler ouvre le clavier ou
 * la liste de choix. Une section verrouillée garde ses valeurs lisibles mais
 * non modifiables : champs en lecture seule (pas de clavier), listes et cases
 * désactivées.
 *
 * Réglage du projet : enregistré avec lui (layoutOptions.verrouSaisie),
 * relu à son ouverture, remis à zéro pour un nouveau projet. Il vit dans un
 * petit magasin de module, et non dans un contexte React : les fenêtres
 * détachées sont rendues dans d'autres racines React, qu'un contexte
 * n'atteindrait pas.
 */
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

export type SectionVerrou = 'proprietes' | 'configuration' | 'matrice' | 'trafic' | 'diagramme' | 'conditions' | 'variables';
export type PrefsVerrou = Record<SectionVerrou, boolean>;

export const SECTIONS_VERROU: SectionVerrou[] = ['proprietes', 'configuration', 'matrice', 'trafic', 'diagramme', 'conditions', 'variables'];
const AUCUN: PrefsVerrou = { proprietes: false, configuration: false, matrice: false, trafic: false, diagramme: false, conditions: false, variables: false };

let etat: PrefsVerrou = AUCUN;
const abonnes = new Set<() => void>();
const publier = (suivant: PrefsVerrou) => {
    etat = suivant;
    abonnes.forEach(f => f());
};

export const lirePrefsVerrou = (): PrefsVerrou => etat;

export const basculerVerrou = (section: SectionVerrou) => publier({ ...etat, [section]: !etat[section] });

/**
 * Pose le verrouillage enregistré dans un projet (sections absentes ou
 * valeurs illisibles : déverrouillées). Sans argument : tout déverrouillé.
 */
export const definirPrefsVerrou = (prefs?: Partial<Record<string, unknown>> | null) => {
    const suivant = { ...AUCUN };
    SECTIONS_VERROU.forEach(k => { suivant[k] = prefs?.[k] === true; });
    if (SECTIONS_VERROU.some(k => suivant[k] !== etat[k])) publier(suivant);
};

/** Ce qu'on enregistre dans le projet : les seules sections verrouillées. */
export const prefsVerrouAEnregistrer = (): Partial<PrefsVerrou> | undefined => {
    const verrouillees = SECTIONS_VERROU.filter(k => etat[k]);
    return verrouillees.length ? Object.fromEntries(verrouillees.map(k => [k, true])) : undefined;
};

const sAbonner = (f: () => void) => {
    abonnes.add(f);
    return () => { abonnes.delete(f); };
};

export const usePrefsVerrou = (): PrefsVerrou => useSyncExternalStore(sAbonner, lirePrefsVerrou, lirePrefsVerrou);

// Marque posée sur les contrôles verrouillés ici, pour ne rendre au
// déverrouillage que ce que le verrou a pris (un champ déjà désactivé par
// l'application le reste).
const MARQUE = 'data-verrou-saisie';
const TEXTE = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]), textarea';
const A_DESACTIVER = 'select, input[type=checkbox], input[type=radio], input[type=range]';

const verrouiller = (racine: HTMLElement) => {
    racine.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXTE).forEach(el => {
        if (!el.readOnly) { el.readOnly = true; el.setAttribute(MARQUE, 'lecture'); }
    });
    racine.querySelectorAll<HTMLSelectElement | HTMLInputElement>(A_DESACTIVER).forEach(el => {
        if (!el.disabled) { el.disabled = true; el.setAttribute(MARQUE, 'desactive'); }
    });
    racine.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach(el => {
        el.setAttribute('contenteditable', 'false'); el.setAttribute(MARQUE, 'editable');
    });
};

const deverrouiller = (racine: HTMLElement) => {
    racine.querySelectorAll<HTMLElement>(`[${MARQUE}]`).forEach(el => {
        const genre = el.getAttribute(MARQUE);
        if (genre === 'lecture') (el as HTMLInputElement).readOnly = false;
        else if (genre === 'desactive') (el as HTMLInputElement).disabled = false;
        else if (genre === 'editable') el.setAttribute('contenteditable', 'true');
        el.removeAttribute(MARQUE);
    });
};

/**
 * Enveloppe une section : tant qu'elle est verrouillée, ses contrôles (y
 * compris ceux que React ajoute ou réactive ensuite) restent non modifiables.
 * `display: contents` : l'enveloppe ne change pas la mise en page.
 */
export const ZoneVerrouSaisie = ({ section, children }: { section: SectionVerrou; children: ReactNode }) => {
    const verrouille = usePrefsVerrou()[section];
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const racine = ref.current;
        if (!racine) return;
        if (!verrouille) { deverrouiller(racine); return; }
        verrouiller(racine);
        // React peut ajouter des lignes ou réactiver un champ : on reverrouille.
        const obs = new MutationObserver(() => verrouiller(racine));
        obs.observe(racine, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'readonly', 'contenteditable'] });
        return () => obs.disconnect();
    }, [verrouille]);
    return (
        <div ref={ref} className={`zone-verrou-saisie${verrouille ? ' verrouillee' : ''}`} data-section={section}
            style={{ display: 'contents' }}>
            {children}
        </div>
    );
};
