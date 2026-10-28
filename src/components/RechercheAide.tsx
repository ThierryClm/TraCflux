import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { chercherDansAide, indexerAide, preparerRequete, regrouperParRubrique } from '../utils/rechercheAide';
import type { IndexAide, OccurrenceAide } from '../utils/rechercheAide';
import './RechercheAide.css';

/** Ce qui n'est pas du texte d'aide : le sommaire, la recherche elle-même, les boutons. */
const HORS_TEXTE = '#help-sommaire, .help-recherche, button';

const SURLIGNAGE = 'aide-recherche';
const SURLIGNAGE_COURANT = 'aide-recherche-courante';

// API CSS Custom Highlight : surligne des plages sans toucher au DOM que React
// gère. Absente de jsdom et des navigateurs anciens, où seule la sélection
// marque l'occurrence courante. Registre et constructeur sont ceux de la
// fenêtre qui affiche l'aide : l'application, ou la fenêtre détachée.
type RegistreSurlignages = Map<string, unknown>;
type FenetreAide = Window & {
    CSS?: { highlights?: RegistreSurlignages };
    Highlight?: new (...plages: Range[]) => unknown;
};
const fenetreDe = (el: Element | null | undefined): FenetreAide =>
    (el?.ownerDocument.defaultView ?? window) as FenetreAide;
const registre = (f: FenetreAide): RegistreSurlignages | null => f.CSS?.highlights ?? null;

const plage = (o: OccurrenceAide): Range => {
    const r = (o.debut.noeud.ownerDocument ?? document).createRange();
    r.setStart(o.debut.noeud, o.debut.offset);
    r.setEnd(o.fin.noeud, o.fin.offset);
    return r;
};

const effacerSurlignages = (f: FenetreAide) => {
    const reg = registre(f);
    reg?.delete(SURLIGNAGE);
    reg?.delete(SURLIGNAGE_COURANT);
};

/** Ancêtre qui défile : le corps de la fenêtre d'aide. */
const conteneurDefilant = (el: Element | null): HTMLElement | null => {
    for (let e = el?.parentElement ?? null; e; e = e.parentElement) {
        const { overflowY } = (e.ownerDocument.defaultView ?? window).getComputedStyle(e);
        if ((overflowY === 'auto' || overflowY === 'scroll') && e.scrollHeight > e.clientHeight) return e;
    }
    return null;
};

/** Amène l'occurrence au tiers haut de la fenêtre, sous la barre de recherche. */
const amenerEnVue = (r: Range, barre: HTMLElement | null) => {
    const conteneur = conteneurDefilant(barre);
    const rect = r.getBoundingClientRect();
    if (!conteneur) {
        r.startContainer.parentElement?.scrollIntoView({ block: 'center' });
        return;
    }
    const zone = conteneur.getBoundingClientRect();
    const hautBarre = barre?.getBoundingClientRect().height ?? 0;
    const visibleHaut = zone.top + hautBarre;
    if (rect.top >= visibleHaut + 8 && rect.bottom <= zone.bottom - 8) return;
    conteneur.scrollTop += rect.top - visibleHaut - (zone.height - hautBarre) / 3;
};

interface RechercheAideProps {
    /** Conteneur du texte de l'aide. */
    racine: RefObject<HTMLElement | null>;
}

const RechercheAide = ({ racine }: RechercheAideProps) => {
    const [saisie, setSaisie] = useState('');
    const [resultat, setResultat] = useState<{ requete: string; occurrences: OccurrenceAide[] }>({ requete: '', occurrences: [] });
    const [courante, setCourante] = useState(0);
    const [listeOuverte, setListeOuverte] = useState(false);
    const index = useRef<IndexAide | null>(null);
    const barre = useRef<HTMLDivElement>(null);
    const champ = useRef<HTMLInputElement>(null);

    // Cherche dans l'aide et repart de la première occurrence.
    const lancer = useCallback((texte: string) => {
        let occurrences: OccurrenceAide[] = [];
        if (preparerRequete(texte) && racine.current) {
            index.current ??= indexerAide(racine.current, HORS_TEXTE);
            occurrences = chercherDansAide(index.current, texte);
        }
        setResultat({ requete: texte, occurrences });
        setCourante(0);
    }, [racine]);

    // Recherche au fil de la frappe, une fois la saisie posée.
    useEffect(() => {
        const t = setTimeout(() => lancer(saisie), 150);
        return () => clearTimeout(t);
    }, [saisie, lancer]);

    const { requete, occurrences } = resultat;
    const rubriques = useMemo(() => regrouperParRubrique(occurrences), [occurrences]);

    // Surligne toutes les occurrences, la courante d'une autre couleur, et l'amène à l'écran.
    useEffect(() => {
        const f = fenetreDe(barre.current);
        if (occurrences.length === 0) { effacerSurlignages(f); return; }
        const plages = occurrences.map(plage);
        const actuelle = plages[Math.min(courante, plages.length - 1)];
        const reg = registre(f);
        if (reg && f.Highlight) {
            reg.set(SURLIGNAGE, new f.Highlight(...plages));
            reg.set(SURLIGNAGE_COURANT, new f.Highlight(actuelle));
        } else {
            const selection = f.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(actuelle);
        }
        amenerEnVue(actuelle, barre.current);
    }, [occurrences, courante]);

    useEffect(() => {
        const f = fenetreDe(barre.current);
        return () => effacerSurlignages(f);
    }, []);

    // À l'ouverture de l'aide, le curseur attend dans le champ, sans
    // faire défiler (l'aide peut s'ouvrir sur un chapitre précis).
    useEffect(() => { champ.current?.focus({ preventScroll: true }); }, []);

    // Ctrl+F, fenêtre d'aide ouverte : la recherche de l'aide plutôt que celle du navigateur.
    useEffect(() => {
        const surTouche = (e: globalThis.KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                champ.current?.focus();
                champ.current?.select();
            }
        };
        const f = fenetreDe(barre.current);
        f.addEventListener('keydown', surTouche);
        return () => f.removeEventListener('keydown', surTouche);
    }, []);

    const total = occurrences.length;
    // Pas de retour en boucle : on s'arrête à la première et à la dernière occurrence.
    const aller = useCallback((pas: number) => {
        if (total === 0) return;
        setCourante(c => Math.min(Math.max(c + pas, 0), total - 1));
    }, [total]);
    const premiere = courante <= 0;
    const derniere = courante >= total - 1;

    const vider = () => { setSaisie(''); lancer(''); setListeOuverte(false); champ.current?.focus(); };

    const surToucheChamp = (e: KeyboardEvent<HTMLInputElement>) => {
        // Les raccourcis de l'application (Ctrl+Z annule le projet…) ne
        // s'appliquent pas à la saisie de la recherche.
        e.stopPropagation();
        if (e.key === 'Enter') {
            e.preventDefault();
            // Entrée avant la fin du délai de frappe : on cherche tout de suite.
            if (requete !== saisie) lancer(saisie);
            else aller(e.shiftKey ? -1 : 1);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (listeOuverte) setListeOuverte(false);
            else vider();
        } else if (e.key === 'ArrowDown' && rubriques.length > 0) {
            e.preventDefault();
            setListeOuverte(true);
        }
    };

    const actif = preparerRequete(requete) !== '';
    const compteur = !actif ? '' : total === 0 ? 'Aucun résultat' : `${Math.min(courante, total - 1) + 1} / ${total}`;

    return (
        <div className="help-recherche" ref={barre} role="search">
            <div className="help-recherche-barre">
                <span className="help-recherche-loupe" aria-hidden="true">🔍</span>
                <input
                    ref={champ}
                    type="search"
                    className="help-recherche-champ"
                    placeholder="Rechercher dans l'aide…"
                    aria-label="Rechercher dans l'aide"
                    value={saisie}
                    onChange={(e) => setSaisie(e.target.value)}
                    onKeyDown={surToucheChamp}
                />
                <span className={`help-recherche-compteur${actif && total === 0 ? ' help-recherche-vide' : ''}`} aria-live="polite">{compteur}</span>
                <button type="button" className="help-recherche-btn" onClick={() => aller(-1)} disabled={total === 0 || premiere}
                    title="Occurrence précédente (Maj+Entrée)" aria-label="Occurrence précédente">▲</button>
                <button type="button" className="help-recherche-btn" onClick={() => aller(1)} disabled={total === 0 || derniere}
                    title="Occurrence suivante (Entrée)" aria-label="Occurrence suivante">▼</button>
                <button type="button" className="help-recherche-btn help-recherche-chapitres" onClick={() => setListeOuverte(o => !o)}
                    disabled={total === 0} aria-expanded={listeOuverte} aria-haspopup="listbox"
                    title="Chapitres qui contiennent ce mot">
                    Chapitres{total > 0 ? ` (${rubriques.length})` : ''} ▾
                </button>
                {saisie && (
                    <button type="button" className="help-recherche-btn" onClick={vider} title="Effacer la recherche (Échap)" aria-label="Effacer la recherche">✕</button>
                )}
            </div>
            {listeOuverte && total > 0 && (
                <ul className="help-recherche-liste" role="listbox" aria-label="Chapitres qui contiennent ce mot">
                    {rubriques.map((r, i) => {
                        const nouveauChapitre = r.chapitre && (i === 0 || rubriques[i - 1].chapitre !== r.chapitre);
                        const enCours = courante >= r.premiere && courante < r.premiere + r.nombre;
                        return [
                            nouveauChapitre && (
                                <li key={`c-${r.chapitre!.id}-${i}`} className="help-recherche-liste-chapitre" role="presentation">{r.chapitre!.titre}</li>
                            ),
                            <li key={`r-${r.rubrique?.id ?? 'debut'}-${i}`} role="option" aria-selected={enCours}>
                                <button type="button" className={`help-recherche-liste-rubrique${enCours ? ' en-cours' : ''}`}
                                    onClick={() => { setCourante(r.premiere); setListeOuverte(false); }}>
                                    <span>{r.rubrique && r.rubrique !== r.chapitre ? r.rubrique.titre : 'Titre du chapitre'}</span>
                                    <span className="help-recherche-nombre">{r.nombre}</span>
                                </button>
                            </li>,
                        ];
                    })}
                </ul>
            )}
        </div>
    );
};

export default RechercheAide;
