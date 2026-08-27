import { useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { isFilePickerActive } from '../utils/filePicker';
import { toast } from '../utils/toast';

/**
 * Shared registry of all open popup windows.
 * Allows coordinated focus management across multiple popups.
 */
// --- Mémoire de position des fenêtres détachées ---------------------------
// Une position dépend de l'ÉCRAN, pas du projet : elle vit donc dans le
// navigateur. Rangée dans le projet, elle rouvrirait les fenêtres hors champ
// sur un poste d'une autre résolution.
const GEOMETRY_KEY = 'popup_geometry';

const readPopupPosition = (key) => {
    if (!key) return null;
    try {
        const all = JSON.parse(localStorage.getItem(GEOMETRY_KEY) || '{}');
        const g = all[key];
        return (g && Number.isFinite(g.left) && Number.isFinite(g.top)) ? g : null;
    } catch { return null; }
};

const writePopupPosition = (key, left, top) => {
    if (!key) return;
    try {
        const all = JSON.parse(localStorage.getItem(GEOMETRY_KEY) || '{}');
        all[key] = { left, top };
        localStorage.setItem(GEOMETRY_KEY, JSON.stringify(all));
    } catch { /* quota, navigation privée */ }
};

// Part de la fenêtre devant rester dans la zone utile pour qu'une position
// mémorisée soit jugée encore bonne.
const VISIBLE_RATIO = 0.6;

const screenBounds = (popup) => {
    const scr = popup.screen;
    if (!scr || !scr.availWidth || !scr.availHeight) return null;
    return {
        left: typeof scr.availLeft === 'number' ? scr.availLeft : 0,
        top: typeof scr.availTop === 'number' ? scr.availTop : 0,
        width: scr.availWidth,
        height: scr.availHeight
    };
};

const isSufficientlyVisible = (popup) => {
    const b = screenBounds(popup);
    if (!b) return true; // aucune information : ne pas déplacer à l'aveugle
    const w = popup.outerWidth || popup.innerWidth || 0;
    const h = popup.outerHeight || popup.innerHeight || 0;
    if (!w || !h) return true;
    const visW = Math.min(popup.screenX + w, b.left + b.width) - Math.max(popup.screenX, b.left);
    const visH = Math.min(popup.screenY + h, b.top + b.height) - Math.max(popup.screenY, b.top);
    return visW >= w * VISIBLE_RATIO && visH >= h * VISIBLE_RATIO;
};

const openPopups = new Set();
let isBringingToFront = false;
let lastBringTime = 0;

// Toast « popups bloquées » : on n'avertit qu'une fois par session.
// Quand un projet rouvre 3 fenêtres détachées, le navigateur n'autorise
// qu'un seul window.open() par geste utilisateur — sans dédoublonnage,
// l'utilisateur recevrait 2 alertes consécutives pour le même problème.
let popupBlockedNotified = false;

// Drapeau « une modale main-window réclame le premier plan ». Quand on ouvre
// une modale React dans la fenêtre principale alors qu'une fenêtre détachée
// est focus, le mécanisme bringAllPopupsToFront masquerait la modale derrière
// la popup OS. Ce flag suspend temporairement ce comportement.
let mainModalActive = false;

export function setMainModalActive(active) {
    mainModalActive = !!active;
    if (mainModalActive) {
        // Ramène la fenêtre principale au premier plan pour que la modale soit visible.
        try { window.focus(); } catch { /* ignore */ }
    }
}

export function isMainModalActive() {
    return mainModalActive;
}

// Recouvrements ouverts DANS la fenêtre principale (menus, listes déroulantes).
// Ce sont des éléments du DOM : une fenêtre détachée est une fenêtre de l'OS,
// elle passe donc devant quoi qu'on fasse côté z-index. Tant qu'un menu est
// déployé, on suspend la remontée automatique des popups — sinon le menu se
// retrouvait masqué une seconde après son ouverture, sans que l'utilisateur
// ait rien fait.
const openMainOverlays = new Set();

export function setMainOverlayOpen(key, open) {
    if (open) openMainOverlays.add(key);
    else openMainOverlays.delete(key);
}

const isMainOverlayOpen = () => openMainOverlays.size > 0;

// --- Suspension du re-rendu des popups pendant l'édition d'un champ ---------
// Re-rendre une fenêtre détachée (renderToPopup) pendant qu'on tape dedans vole
// le focus/curseur. Approche directe : au moment de rendre, on regarde si un
// champ de CETTE popup a le focus (popup.document.activeElement). Si oui, on
// DIFFÈRE (on mémorise le contenu) ; on l'applique quand le champ perd le focus
// (événement focusout → flush).
const popupFlushers = new Set(); // fn() par popup : applique le contenu en attente si plus en édition

// Champ de SAISIE texte/nombre où le focus et le curseur doivent être préservés.
// On exclut range (curseurs de recadrage), checkbox/radio, boutons, color, file…
// qui n'ont pas de curseur de texte et gagnent à se mettre à jour en direct.
const isFieldEl = (el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
        const t = (el.type || 'text').toLowerCase();
        return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file'].includes(t);
    }
    return false;
};

const flushAllPopups = () => {
    popupFlushers.forEach(fn => { try { fn(); } catch { /* ignore */ } });
};

// Un champ de saisie est-il en cours d'édition (fenêtre principale ou popup) ?
// Sert à suspendre la remontée des popups au premier plan (qui volerait le
// focus du champ) tant qu'on tape dedans.
const isEditingAnyField = () => {
    if (isFieldEl(document.activeElement)) return true;
    for (const p of openPopups) {
        try { if (!p.closed && isFieldEl(p.document.activeElement)) return true; } catch { /* closed */ }
    }
    return false;
};

// À la perte de focus d'un champ, on tente d'appliquer les rendus en attente
// (différé pour laisser le focus se stabiliser lors d'un Tab entre champs :
// chaque flush ne s'exécute que si sa popup n'a plus de champ actif).
const onFieldFocusOut = () => { setTimeout(flushAllPopups, 0); };

// Attache l'écouteur de fin d'édition à un document (principal ou popup).
const installEditingListeners = (doc) => {
    if (!doc || doc.__tcfluxEditingListeners) return;
    doc.__tcfluxEditingListeners = true;
    doc.addEventListener('focusout', onFieldFocusOut);
};

export function bringAllPopupsToFront(except) {
    if (isBringingToFront || openPopups.size === 0 || isFilePickerActive() || mainModalActive || isEditingAnyField()) return;
    // Un clic DANS une popup reste prioritaire (multi-écrans) ; seule la
    // remontée initiée par la fenêtre principale cède le pas à ses menus.
    if (except === null && isMainOverlayOpen()) return;
    const now = Date.now();
    if (now - lastBringTime < 200) return;
    isBringingToFront = true;
    lastBringTime = now;

    // Quand le déclenchement vient de la fenêtre principale (except === null,
    // p. ex. un clic dans un champ), remonter les popups appelle popup.focus()
    // qui vole le focus clavier du champ en cours. On capture donc l'élément
    // actif (et sa sélection) AVANT de remonter les popups, pour le restituer
    // ensuite. Le but du mécanisme est seulement le z-order (popups visibles
    // sur un 2e écran), pas la prise de focus.
    let savedActive = null;
    if (except === null) {
        const el = document.activeElement;
        if (el && el !== document.body && typeof el.focus === 'function') {
            const sel = {};
            try {
                if (typeof el.selectionStart === 'number') {
                    sel.start = el.selectionStart;
                    sel.end = el.selectionEnd;
                }
            } catch { /* champs sans sélection (number, etc.) */ }
            savedActive = { el, sel };
        }
    }

    openPopups.forEach(p => {
        if (p !== except && !p.closed) p.focus();
    });
    if (except && !except.closed) except.focus();

    // Restituer le focus à la fenêtre principale + au champ d'origine.
    if (savedActive) {
        try {
            window.focus();
            savedActive.el.focus({ preventScroll: true });
            if (savedActive.sel.start !== undefined && typeof savedActive.el.setSelectionRange === 'function') {
                savedActive.el.setSelectionRange(savedActive.sel.start, savedActive.sel.end);
            }
        } catch { /* ignore */ }
    }

    setTimeout(() => { isBringingToFront = false; }, 200);
}

// Install shared listeners on the main window (once)
let mainListenerInstalled = false;
let bringPopupsTimer = null;
function installMainListener() {
    if (mainListenerInstalled) return;
    mainListenerInstalled = true;

    const bringPopupsIfAllowed = () => {
        if (openPopups.size === 0 || isBringingToFront || isFilePickerActive() || mainModalActive || isEditingAnyField()) return;
        if (isMainOverlayOpen()) return;
        if (bringPopupsTimer) clearTimeout(bringPopupsTimer);
        bringPopupsTimer = setTimeout(() => {
            bringPopupsTimer = null;
            if (isFilePickerActive()) return;
            bringAllPopupsToFront(null);
        }, 1000);
        // Note : la temporisation est relue à l'échéance (bringAllPopupsToFront
        // revérifie les gardes), un menu ouvert entre-temps annule donc l'effet.
    };

    // When main window regains focus from outside (alt-tab, taskbar)
    window.addEventListener('focus', bringPopupsIfAllowed);

    // When user clicks inside the main window (covers tab switches, buttons, etc.)
    document.addEventListener('mousedown', bringPopupsIfAllowed);

    // Close all popups when the main window is closed
    window.addEventListener('beforeunload', () => {
        openPopups.forEach(p => { if (!p.closed) p.close(); });
    });

    // Suivi de l'édition de champ sur la fenêtre principale.
    installEditingListeners(document);
}

/**
 * Custom hook to manage a window.open() popup that renders React content.
 * - Copies all stylesheets from the parent window
 * - Handles popup close detection
 * - Syncs light/dark mode
 * - Keeps all popups on top via shared registry
 *
 * @param {{width: number, height: number}} [contentSize] - Taille exacte
 *        attendue pour la zone utile. Le gabarit width/height passé à
 *        window.open est une estimation : la hauteur du chrome du navigateur
 *        (barre de titre, barre d'adresse) varie et n'est pas connue d'avance.
 *        Quand contentSize est fourni, la fenêtre est réajustée après ouverture
 *        pour que innerWidth/innerHeight tombent juste — sans quoi une fenêtre
 *        pourtant plus grande que son contenu se retrouve avec des ascenseurs.
 */
const usePopupWindow = ({ isOpen, onClose, title, width, height, contentSize = null, geometryKey = null }) => {
    const popupRef = useRef(null);
    const rootRef = useRef(null);
    const intervalRef = useRef(null);
    const contentSizeRef = useRef(contentSize);
    contentSizeRef.current = contentSize;
    // Identité stable pour la mémoire de position. Le titre ne peut pas servir
    // de clé : il porte le nom du carrefour et celui du plan de feux actif.
    const geometryKeyRef = useRef(geometryKey);
    geometryKeyRef.current = geometryKey;
    // Tant que le placement initial n'a pas eu lieu, la position courante est
    // celle qu'a choisie le navigateur : la mémoriser écraserait la bonne.
    const placedRef = useRef(false);
    const lastPosRef = useRef({ x: null, y: null });
    // Dernier contenu à afficher, mis en attente pendant l'édition d'un champ.
    const pendingContentRef = useRef(null);

    // Applique le contenu en attente, mais seulement si cette popup n'a plus de
    // champ en cours d'édition (sinon on préserve encore le focus — cas du Tab
    // vers un autre champ de la même popup).
    const flushPending = useCallback(() => {
        if (pendingContentRef.current == null) return;
        const popup = popupRef.current;
        if (!rootRef.current || !popup || popup.closed) return;
        if (isFieldEl(popup.document.activeElement)) return;
        rootRef.current.render(pendingContentRef.current);
        pendingContentRef.current = null;
    }, []);

    // Enregistre le flush de cette popup dans le registre global.
    useEffect(() => {
        popupFlushers.add(flushPending);
        return () => { popupFlushers.delete(flushPending); };
    }, [flushPending]);

    // Réajuste la fenêtre pour que sa zone utile fasse exactement contentSize.
    const fitToContent = useCallback(() => {
        const popup = popupRef.current;
        const target = contentSizeRef.current;
        if (!target || !popup || popup.closed) return;
        try {
            const iw = popup.innerWidth;
            const ih = popup.innerHeight;
            if (!iw || !ih) return; // fenêtre pas encore dimensionnée
            const maxW = (popup.screen?.availWidth || iw) - 40;
            const maxH = (popup.screen?.availHeight || ih) - 60;
            const dw = Math.round(Math.min(target.width, maxW)) - iw;
            const dh = Math.round(Math.min(target.height, maxH)) - ih;
            if (dw || dh) popup.resizeBy(dw, dh);
        } catch { /* resize refusé par le navigateur : on garde le gabarit */ }
    }, []);

    // Rattrapage MESURÉ, après le calage sur contentSize. Ce dernier reste une
    // estimation (hauteur réelle de la barre d'outils, mise à l'échelle qui
    // tombe sur une fraction de pixel) ; ici on lit le débordement réel de la
    // zone défilante et on l'ajoute à la fenêtre. N'agrandit jamais au-delà de
    // l'écran, et ne fait rien s'il n'y a pas de débordement : pas de boucle.
    const absorbOverflow = useCallback(() => {
        const popup = popupRef.current;
        if (!popup || popup.closed) return;
        try {
            const el = popup.document.querySelector('[data-fit-scroll]');
            if (!el) return;
            const dw = Math.ceil(el.scrollWidth - el.clientWidth);
            const dh = Math.ceil(el.scrollHeight - el.clientHeight);
            if (dw <= 0 && dh <= 0) return;
            const roomW = Math.max(0, (popup.screen?.availWidth || 0) - 40 - popup.innerWidth);
            const roomH = Math.max(0, (popup.screen?.availHeight || 0) - 60 - popup.innerHeight);
            popup.resizeBy(
                Math.min(Math.max(0, dw), roomW),
                Math.min(Math.max(0, dh), roomH)
            );
        } catch { /* resize refusé par le navigateur */ }
    }, []);

    // Recentre la fenêtre sur l'écran, une fois sa taille définitive connue.
    //
    // Le `left`/`top` passé à window.open n'est qu'un souhait : le navigateur
    // l'ignore dans plusieurs cas — ouverture hors geste utilisateur (c'est le
    // cas au chargement d'un projet, qui rouvre les fenêtres mémorisées), ou
    // réutilisation d'une fenêtre nommée dont il a retenu la géométrie. La
    // fenêtre retombait alors dans l'angle supérieur gauche, par-dessus la
    // barre de menus. On repose donc la position explicitement.
    //
    // Le centrage se fait sur la zone utile de l'ÉCRAN et non sur la fenêtre
    // principale : celle-ci peut être étroite ou déportée, et une fenêtre
    // détachée centrée sur elle finit hors champ.
    const placeWindow = useCallback(() => {
        const popup = popupRef.current;
        if (!popup || popup.closed) return;
        try {
            const w = popup.outerWidth || popup.innerWidth || 0;
            const h = popup.outerHeight || popup.innerHeight || 0;
            if (!w || !h) return; // pas encore dimensionnée : on repassera

            // 1. Position mémorisée, si elle laisse la fenêtre suffisamment
            //    visible. La vérification se fait APRÈS le déplacement : sur un
            //    poste multi-écrans, popup.screen suit la fenêtre, ce qui valide
            //    correctement une position sur l'écran secondaire.
            const saved = readPopupPosition(geometryKeyRef.current);
            if (saved) {
                popup.moveTo(saved.left, saved.top);
                if (isSufficientlyVisible(popup)) {
                    placedRef.current = true;
                    lastPosRef.current = { x: popup.screenX, y: popup.screenY };
                    return;
                }
            }

            // 2. Sinon, centrage sur la zone utile de l'écran — jamais l'angle,
            //    sauf fenêtre plus grande que l'écran, où il n'existe pas
            //    d'autre place.
            const b = screenBounds(popup);
            if (!b) return;
            popup.moveTo(
                Math.max(b.left, Math.round(b.left + (b.width - w) / 2)),
                Math.max(b.top, Math.round(b.top + (b.height - h) / 2))
            );
            placedRef.current = true;
            lastPosRef.current = { x: popup.screenX, y: popup.screenY };
        } catch { /* déplacement refusé par le navigateur : on garde la place */ }
    }, []);

    // Open/close popup based on isOpen
    useEffect(() => {
        if (isOpen) {
            // Center the popup on screen
            const left = window.screenX + Math.round((window.outerWidth - width) / 2);
            const top = window.screenY + Math.round((window.outerHeight - height) / 2);

            const popup = window.open(
                '',
                title.replace(/\s+/g, '_'),
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,menubar=no,toolbar=yes,location=yes,status=no`
            );

            if (!popup) {
                if (!popupBlockedNotified) {
                    popupBlockedNotified = true;
                    toast.error("Fenêtre détachée bloquée par le navigateur. Cliquez sur l'icône popup bloqué dans la barre d'adresse et choisissez « Toujours autoriser » pour ce site (voir le menu Aide).");
                }
                onClose();
                return;
            }

            popupRef.current = popup;
            openPopups.add(popup);
            installMainListener();
            // Suivi de l'édition de champ dans cette popup (suspension des re-rendus).
            installEditingListeners(popup.document);

            // Fenêtre nommée potentiellement réutilisée : on repart d'un head
            // vide, sinon les feuilles de style s'y recopient à chaque passage.
            popup.document.head.replaceChildren();

            // Set title
            popup.document.title = title;

            // Copy all stylesheets from parent window
            const parentStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
            parentStyles.forEach(node => {
                const clone = node.cloneNode(true);
                popup.document.head.appendChild(clone);
            });

            // Sync theme class on popup body
            ['light-mode', 'high-contrast-mode', 'amber-mode', 'daltonian-mode', 'sepia-mode', 'blue-night-mode'].forEach(cls => {
                if (document.body.classList.contains(cls)) {
                    popup.document.body.classList.add(cls);
                }
            });

            // Add base styles for popup body (all themes)
            const popupStyle = popup.document.createElement('style');
            popupStyle.textContent = `
                body {
                    margin: 0;
                    padding: 0;
                    background: #1e1e1e;
                    overflow: auto;
                }
                body.light-mode {
                    background: #f5f5f5;
                }
                body.high-contrast-mode {
                    background: #0a0e2a;
                }
                body.amber-mode {
                    background: #1a1a1a;
                }
                body.daltonian-mode {
                    background: #0d1b2a;
                }
                body.sepia-mode {
                    background: #f4ecd8;
                }
                body.blue-night-mode {
                    background: #002b36;
                }
                #popup-root {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
            `;
            popup.document.head.appendChild(popupStyle);

            // Create root container. La fenêtre nommée peut être RÉUTILISÉE par
            // window.open (rejeu d'effet en StrictMode, réouverture) : on repart
            // d'un body vide, sinon les racines s'empilent.
            popup.document.body.replaceChildren();
            const container = popup.document.createElement('div');
            container.id = 'popup-root';
            popup.document.body.appendChild(container);

            // Create React root
            rootRef.current = createRoot(container);

            // Corrige le gabarit une fois la fenêtre réellement dimensionnée,
            // puis absorbe ce qui dépasse encore une fois le contenu rendu.
            setTimeout(fitToContent, 0);
            setTimeout(absorbOverflow, 150);
            // En dernier : la position se calcule sur la taille définitive.
            // Deux passages, et non un : juste après l'ouverture, outerWidth vaut
            // encore 0 sur certaines fenêtres — celles sans phase de
            // redimensionnement, comme la matrice — et le centrage renonçait
            // silencieusement, laissant la fenêtre dans l'angle. Le second
            // passage rattrape, et opère sur la taille définitive.
            placedRef.current = false;
            lastPosRef.current = { x: null, y: null };
            setTimeout(placeWindow, 60);
            setTimeout(placeWindow, 300);

            // When this popup gains focus, bring all other popups to front too
            popup.addEventListener('focus', () => {
                if (!isFilePickerActive() && !mainModalActive) {
                    setTimeout(() => bringAllPopupsToFront(popup), 150);
                }
            });

            // Detect popup close
            intervalRef.current = setInterval(() => {
                // La position se relève tant que la fenêtre vit : une fois
                // popup.closed passé à true, screenX/screenY ne valent plus rien.
                if (!popup.closed && placedRef.current && geometryKeyRef.current) {
                    try {
                        const x = popup.screenX;
                        const y = popup.screenY;
                        if (Number.isFinite(x) && Number.isFinite(y) &&
                            (x !== lastPosRef.current.x || y !== lastPosRef.current.y)) {
                            lastPosRef.current = { x, y };
                            writePopupPosition(geometryKeyRef.current, x, y);
                        }
                    } catch { /* fenêtre en cours de fermeture */ }
                }
                if (popup.closed) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    rootRef.current = null;
                    popupRef.current = null;
                    pendingContentRef.current = null;
                    openPopups.delete(popup);
                    onClose();
                }
            }, 300);

        } else {
            // Close popup if open
            if (popupRef.current) {
                openPopups.delete(popupRef.current);
                if (!popupRef.current.closed) {
                    popupRef.current.close();
                }
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (rootRef.current) {
                rootRef.current = null;
            }
            popupRef.current = null;
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isOpen]);

    // Render content to popup.
    // Pendant l'édition d'un champ (fenêtre principale ou popup), on NE touche
    // PAS au DOM de la popup : on mémorise le dernier contenu, appliqué à la
    // fin de l'édition via flushPending (enregistré dans popupFlushers). Le
    // champ actif et son curseur ne sont ainsi jamais perturbés.
    const renderToPopup = useCallback((content) => {
        const popup = popupRef.current;
        if (!rootRef.current || !popup || popup.closed) return;
        // Défère si un champ de CETTE popup est en cours d'édition.
        if (isFieldEl(popup.document.activeElement)) {
            pendingContentRef.current = content;
            return;
        }
        pendingContentRef.current = null;
        rootRef.current.render(content);
    }, []);

    // Recale la fenêtre quand la taille utile change alors qu'elle est ouverte :
    // zoom, rognage, mais surtout arrivée tardive des dimensions natives de
    // l'image (chargées en asynchrone, après l'ouverture au clic).
    useEffect(() => {
        if (!isOpen || !contentSize) return;
        const t = setTimeout(fitToContent, 120);
        const t2 = setTimeout(absorbOverflow, 260);
        return () => { clearTimeout(t); clearTimeout(t2); };
    }, [isOpen, contentSize?.width, contentSize?.height, fitToContent, absorbOverflow]);

    // Update document title when the title prop changes while the popup is open
    // (le titre est posé une fois à l'ouverture ; cet effet le rafraîchit pour
    // refléter par ex. le nom du carrefour ou le PF actif).
    useEffect(() => {
        if (!isOpen) return;
        if (!popupRef.current || popupRef.current.closed) return;
        popupRef.current.document.title = title;
    }, [title, isOpen]);

    // Sync theme changes to popup via MutationObserver (instead of every render)
    useEffect(() => {
        if (!popupRef.current || popupRef.current.closed) return;
        const popup = popupRef.current;
        const themeClasses = ['light-mode', 'high-contrast-mode', 'amber-mode', 'daltonian-mode', 'sepia-mode', 'blue-night-mode'];

        const syncTheme = () => {
            if (popup.closed) return;
            themeClasses.forEach(cls => {
                popup.document.body.classList.toggle(cls, document.body.classList.contains(cls));
            });
        };

        // Sync immediately
        syncTheme();

        // Observe changes on main body class
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, [isOpen]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (popupRef.current) {
                openPopups.delete(popupRef.current);
                if (!popupRef.current.closed) {
                    popupRef.current.close();
                }
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return { renderToPopup, popupWindow: popupRef };
};

export default usePopupWindow;
