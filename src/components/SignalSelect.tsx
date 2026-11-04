import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import SignalModule from './SignalModule';
import { famillesPourType, libelleSignalIsr, signalAdmis } from '../utils/signauxIsr';
import { ROUGE_SIGNAL } from '../utils/aspectSignal';
import { usePrefsVerrou } from '../utils/verrouSaisie';
import './SignalSelect.css';

interface SignalSelectProps {
    value: string;
    type?: string;
    courant?: string;
    label: string;
    title?: string;
    tooltipsEnabled?: boolean;
    disabled?: boolean;
    onChange: (code: string) => void;
}

/** Le même module que sur le carrefour, allumé et immobile pour l'identifier. */
const VignetteSignal = ({ code, courant }: { code: string; courant?: string }) => (
    <span className="signal-select-icon" aria-hidden="true">
        <SignalModule code={code} courant={courant} couleur={code === 'R24' || code === 'R25' ? ROUGE_SIGNAL : 'rgb(0, 255, 0)'}
            temps={0} enLecture={false} a13bAllume />
    </span>
);

/** Liste illustrée commune à la page, au téléphone et au formulaire détaché. */
const SignalSelect = ({ value, type, courant, label, title, tooltipsEnabled = true, disabled = false, onChange }: SignalSelectProps) => {
    const verrouille = usePrefsVerrou().configuration || disabled;
    const bouton = useRef<HTMLButtonElement>(null);
    const liste = useRef<HTMLDivElement>(null);
    const id = useId();
    const [ouverture, setOuverture] = useState<{ document: Document; type?: string; value: string } | null>(null);
    const ouvert = !!ouverture && !verrouille && ouverture.type === type && ouverture.value === value;
    // Invalider aussi le souvenir de l'ouverture : déverrouiller ou annuler
    // un changement de type ne doit jamais rouvrir une ancienne liste.
    if (ouverture && !ouvert) setOuverture(null);
    const fermer = () => setOuverture(null);
    const [actif, setActif] = useState(0);
    const [position, setPosition] = useState<CSSProperties>({});
    const recherche = useRef({ texte: '', instant: 0 });
    const familles = famillesPourType(type);
    const horsListe = value && !signalAdmis(type, value) ? [{ code: value, libelle: libelleSignalIsr(value) ?? value }] : [];
    const options = [{ code: '', libelle: 'Aucun signal' }, ...horsListe, ...familles.flatMap(f => f.signaux)];
    const documentCible = ouverture?.document;
    const modifiable = () => !verrouille && !bouton.current?.closest('.dossier-readonly');

    const ouvrir = (index = options.findIndex(o => o.code === value)) => {
        if (!modifiable()) return;
        setActif(Math.max(0, index));
        recherche.current = { texte: '', instant: 0 };
        setOuverture({ document: bouton.current!.ownerDocument, type, value });
    };
    const choisir = (code: string) => {
        if (modifiable()) onChange(code);
        fermer();
        bouton.current?.focus({ preventScroll: true });
    };

    useLayoutEffect(() => {
        if (!ouvert) return;
        const cible = bouton.current;
        const doc = cible?.ownerDocument;
        const fenetre = doc?.defaultView;
        if (!cible || !doc || !fenetre) return;
        const placer = () => {
            const rect = cible.getBoundingClientRect();
            const vue = fenetre.visualViewport;
            const gauche = vue?.offsetLeft ?? 0;
            const haut = vue?.offsetTop ?? 0;
            const largeur = vue?.width ?? fenetre.innerWidth;
            const hauteur = vue?.height ?? fenetre.innerHeight;
            const width = Math.min(380, largeur - 16);
            const dessous = Math.max(0, haut + hauteur - rect.bottom - 12);
            const dessus = Math.max(0, rect.top - haut - 12);
            const versLeHaut = dessous < 220 && dessus > dessous;
            const maxHeight = Math.min(360, versLeHaut ? dessus : dessous);
            setPosition({ width, maxHeight, left: Math.max(gauche + 8, Math.min(rect.left, gauche + largeur - width - 8)),
                top: versLeHaut ? undefined : rect.bottom + 4,
                bottom: versLeHaut ? fenetre.innerHeight - rect.top + 4 : undefined });
        };
        const fermerDehors = (e: globalThis.PointerEvent) => {
            const cibleEvenement = e.target as Node;
            if (!cible.contains(cibleEvenement) && !liste.current?.contains(cibleEvenement)) fermer();
        };
        placer();
        doc.addEventListener('pointerdown', fermerDehors);
        fenetre.addEventListener('resize', placer);
        doc.addEventListener('scroll', placer, true);
        fenetre.visualViewport?.addEventListener('resize', placer);
        fenetre.visualViewport?.addEventListener('scroll', placer);
        return () => {
            doc.removeEventListener('pointerdown', fermerDehors);
            fenetre.removeEventListener('resize', placer);
            doc.removeEventListener('scroll', placer, true);
            fenetre.visualViewport?.removeEventListener('resize', placer);
            fenetre.visualViewport?.removeEventListener('scroll', placer);
        };
    }, [ouvert]);

    useEffect(() => {
        if (ouvert) liste.current?.querySelector<HTMLElement>(`[id="${id}-option-${actif}"]`)?.scrollIntoView?.({ block: 'nearest' });
    }, [ouvert, actif, id]);

    const auClavier = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Tab') { fermer(); return; }
        if (e.key === 'Escape') { e.preventDefault(); fermer(); return; }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            if (!ouvert) {
                ouvrir(e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : undefined);
            } else if (e.key === 'Enter' || e.key === ' ') {
                choisir(options[actif].code);
            } else {
                setActif(i => e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1
                    : Math.max(0, Math.min(options.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
            }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const maintenant = e.timeStamp;
            const texte = (maintenant - recherche.current.instant < 800 ? recherche.current.texte : '') + e.key.toLowerCase();
            recherche.current = { texte, instant: maintenant };
            const index = options.findIndex(o => o.code.toLowerCase().startsWith(texte));
            if (index >= 0) { if (!ouvert) ouvrir(index); else setActif(index); recherche.current = { texte, instant: maintenant }; }
        }
    };

    const option = (code: string, libelle: string) => {
        const index = options.findIndex(o => o.code === code);
        return (
            <div key={code} id={`${id}-option-${index}`} role="option" aria-label={code ? `${code} ${libelle}` : libelle} aria-selected={code === value} data-value={code}
                className={`signal-select-option${actif === index ? ' active' : ''}`} title={tooltipsEnabled ? libelle : undefined}
                onPointerDown={e => e.preventDefault()} onClick={() => choisir(code)}>
                <VignetteSignal code={code} courant={courant} />
                <span className="signal-select-description">{code && <strong>{code} </strong>}<span>{libelle}</span></span>
                {code === value && <span className="signal-select-check" aria-hidden="true">✓</span>}
            </div>
        );
    };

    return (<>
        <button ref={bouton} type="button" role="combobox" className="input-signal signal-select-trigger" value={value}
            aria-label={label} aria-haspopup="listbox" aria-expanded={ouvert} aria-controls={ouvert ? id : undefined}
            aria-activedescendant={ouvert ? `${id}-option-${actif}` : undefined} disabled={verrouille} title={tooltipsEnabled ? title : undefined}
            onClick={() => ouvert ? fermer() : ouvrir()} onKeyDown={auClavier}
            onBlur={() => fermer()}>
            <VignetteSignal code={value} courant={courant} /><span className="signal-select-code">{value || '—'}</span>
            <span className="signal-select-chevron" aria-hidden="true">▾</span>
        </button>
        {ouvert && documentCible && createPortal(
            <div ref={liste} id={id} role="listbox" aria-label={label} className="signal-select-list" style={position}>
                {option('', 'Aucun signal')}
                {horsListe.map(o => option(o.code, o.libelle))}
                {familles.map((f, i) => <div role="group" aria-labelledby={`${id}-famille-${i}`} key={f.famille}>
                    <div className="signal-select-family" id={`${id}-famille-${i}`}>{f.famille}</div>
                    {f.signaux.map(o => option(o.code, o.libelle))}
                </div>)}
            </div>, documentCible.body
        )}
    </>);
};

export default SignalSelect;
