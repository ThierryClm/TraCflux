/**
 * Verrouillage de la saisie par section (Mise en page → Verrouillage saisie).
 *
 * Sur un smartphone, toucher un champ pour faire défiler ouvre le clavier ou
 * la liste de choix. Une section verrouillée garde ses valeurs lisibles mais
 * non modifiables : champs en lecture seule (pas de clavier), listes et cases
 * désactivées.
 *
 * Préférence du poste (localStorage), comme les infobulles. Elle vit dans un
 * petit magasin de module, et non dans un contexte React : les fenêtres
 * détachées sont rendues dans d'autres racines React, qu'un contexte
 * n'atteindrait pas.
 */
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

export type SectionVerrou = 'proprietes' | 'configuration' | 'matrice' | 'trafic' | 'diagramme';
export type PrefsVerrou = Record<SectionVerrou, boolean>;

const CLE = 'tracflux.verrouSaisie';
const AUCUN: PrefsVerrou = { proprietes: false, configuration: false, matrice: false, trafic: false, diagramme: false };

const lire = (): PrefsVerrou => {
    try {
        const brut = localStorage.getItem(CLE);
        return brut ? { ...AUCUN, ...JSON.parse(brut) } : AUCUN;
    } catch { return AUCUN; }
};

let etat: PrefsVerrou = lire();
const abonnes = new Set<() => void>();

export const lirePrefsVerrou = (): PrefsVerrou => etat;

export const basculerVerrou = (section: SectionVerrou) => {
    etat = { ...etat, [section]: !etat[section] };
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* navigation privée */ }
    abonnes.forEach(f => f());
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
