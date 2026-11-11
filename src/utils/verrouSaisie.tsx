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
import type { ReactNode, SyntheticEvent } from 'react';
import './verrouSaisie.css';

export type SectionVerrou = 'proprietes' | 'configuration' | 'matrice' | 'trafic' | 'diagramme' | 'conditions' | 'variables' | 'image' | 'scenarios' | 'phasages';
export type PrefsVerrou = Record<SectionVerrou, boolean>;

export const SECTIONS_VERROU: SectionVerrou[] = ['proprietes', 'configuration', 'matrice', 'trafic', 'diagramme', 'conditions', 'variables', 'image', 'scenarios', 'phasages'];
const AUCUN: PrefsVerrou = { proprietes: false, configuration: false, matrice: false, trafic: false, diagramme: false, conditions: false, variables: false, image: false, scenarios: false, phasages: false };

let etat: PrefsVerrou = AUCUN;
const abonnes = new Set<() => void>();
const publier = (suivant: PrefsVerrou) => {
    etat = suivant;
    abonnes.forEach(f => f());
};

export const lirePrefsVerrou = (): PrefsVerrou => etat;

export const basculerVerrou = (section: SectionVerrou) => publier({ ...etat, [section]: !etat[section] });

/** Toutes les sections d'un coup : verrouille s'il en reste une ouverte, sinon déverrouille. */
export const basculerVerrouTout = () => {
    const toutVerrouille = SECTIONS_VERROU.every(k => etat[k]);
    const suivant = { ...AUCUN };
    SECTIONS_VERROU.forEach(k => { suivant[k] = !toutVerrouille; });
    publier(suivant);
};

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

/** Mention partagée par les titres des sections, dans toutes les racines React. */
export const MentionVerrou = ({ section, verrouille = false, title }: {
    section: SectionVerrou; verrouille?: boolean; title?: string;
}) => {
    const prefs = usePrefsVerrou();
    if (!prefs[section] && !verrouille) return null;
    return <span className="mention-verrou" title={title}
        style={{ color: '#aaa', fontWeight: 'normal', fontSize: '0.85em', whiteSpace: 'nowrap' }}>(verrouillé)</span>;
};

// Marque posée sur les contrôles verrouillés ici, pour ne rendre au
// déverrouillage que ce que le verrou a pris (un champ déjà désactivé par
// l'application le reste).
const MARQUE = 'data-verrou-saisie';
const TEXTE = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]), textarea';
const A_DESACTIVER = 'select, input[type=checkbox], input[type=radio], input[type=range]';

const verrouiller = (racine: HTMLElement, boutons = false) => {
    if (boutons) racine.querySelectorAll<HTMLButtonElement>('button:not([data-verrou-autorise])').forEach(el => {
        if (!el.disabled) { el.disabled = true; el.setAttribute(MARQUE, 'desactive'); }
    });
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
    const boutons = section === 'image' || section === 'scenarios' || section === 'phasages';
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const racine = ref.current;
        if (!racine) return;
        if (!verrouille) { deverrouiller(racine); return; }
        verrouiller(racine, boutons);
        // React peut ajouter des lignes ou réactiver un champ : on reverrouille.
        const obs = new MutationObserver(() => verrouiller(racine, boutons));
        obs.observe(racine, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'readonly', 'contenteditable'] });
        return () => obs.disconnect();
    }, [verrouille, boutons]);
    const bloquerImage = (e: SyntheticEvent) => {
        if (section !== 'image' || !lirePrefsVerrou().image) return;
        if ((e.target as Element | null)?.closest?.('[data-verrou-autorise]')) return;
        e.preventDefault(); e.stopPropagation();
    };
    return (
        <div onMouseDownCapture={bloquerImage} onDoubleClickCapture={bloquerImage}
            onDropCapture={bloquerImage} onDragOverCapture={bloquerImage} onPasteCapture={bloquerImage} ref={ref} className={`zone-verrou-saisie${verrouille ? ' verrouillee' : ''}`} data-section={section}
            style={{ display: 'contents' }}>
            {children}
        </div>
    );
};
