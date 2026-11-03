import { useEffect, useLayoutEffect, useRef } from 'react';
import type { SyntheticEvent } from 'react';
import CustomTooltip from './CustomTooltip';
import { resetTextFormatting } from '../utils/resetTextFormatting';
import { ROUGE_TEXTE, VERT_TEXTE, vertFluo } from '../utils/couleursTexte';

interface RangeBookmark {
    startPath: number[];
    startOffset: number;
    endPath: number[];
    endOffset: number;
}

const nodePathFrom = (root: Node, node: Node): number[] | null => {
    const path: number[] = [];
    let current: Node | null = node;

    while (current && current !== root) {
        const parent: ParentNode | null = current.parentNode;
        if (!parent) return null;
        const index = Array.from(parent.childNodes).indexOf(current as ChildNode);
        if (index < 0) return null;
        path.unshift(index);
        current = parent as Node;
    }

    return current === root ? path : null;
};

const nodeAtPath = (root: Node, path: number[]): Node | null => {
    let current: Node | null = root;
    for (const index of path) {
        current = current.childNodes.item(index);
        if (!current) return null;
    }
    return current;
};

const bookmarkRange = (editable: HTMLElement, range: Range): RangeBookmark | null => {
    const startPath = nodePathFrom(editable, range.startContainer);
    const endPath = nodePathFrom(editable, range.endContainer);
    if (!startPath || !endPath) return null;

    return {
        startPath,
        startOffset: range.startOffset,
        endPath,
        endOffset: range.endOffset
    };
};

const rangeFromBookmark = (editable: HTMLElement, bookmark: RangeBookmark | null): Range | null => {
    if (!bookmark) return null;
    const startNode = nodeAtPath(editable, bookmark.startPath);
    const endNode = nodeAtPath(editable, bookmark.endPath);
    if (!startNode || !endNode) return null;

    const startLimit = startNode.nodeType === Node.TEXT_NODE
        ? (startNode as Text).data.length
        : startNode.childNodes.length;
    const endLimit = endNode.nodeType === Node.TEXT_NODE
        ? (endNode as Text).data.length
        : endNode.childNodes.length;
    if (bookmark.startOffset > startLimit || bookmark.endOffset > endLimit) return null;

    try {
        const range = editable.ownerDocument.createRange();
        range.setStart(startNode, bookmark.startOffset);
        range.setEnd(endNode, bookmark.endOffset);
        return range.collapsed ? null : range;
    } catch {
        return null;
    }
};

/**
 * Champ Remarques du plan de feu actif, rendu à la fois en colonne du
 * diagramme et dans une fenêtre détachée. Mêmes interactions dans les deux
 * contextes : sélectionner du texte puis cliquer + (vert) / − (rouge) /
 * ▲ (agrandir) / ▼ (réduire), ou utiliser les raccourcis clavier + / −.
 *
 * Important pour le mode popup : tous les accès `window` / `document` doivent
 * passer par `ownerDocument` / `defaultView` du nœud concerné — sinon
 * getSelection() et createElement() ciblent la fenêtre principale alors que
 * l'éditable et sa sélection vivent dans la popup.
 *
 * Stratégie de sélection : on lit en priorité la sélection LIVE au moment du
 * clic (les boutons font `e.preventDefault()` sur mousedown pour la préserver),
 * avec repli sur la dernière sélection sauvegardée via onMouseUp/onKeyUp/onSelect.
 *
 * - groupCount : nombre de groupes (pour calculer la limite de caractères en
 *   mode colonne du diagramme, où la hauteur dépend du nombre de groupes).
 * - popupMode : si true, le champ remplit son conteneur (popup détachée) et
 *   la limite de caractères est virtuellement levée — le popup est
 *   redimensionnable, plus de contrainte d'alignement avec le diagramme.
 */
/** Longueur maximale des remarques d'un plan de feu, en caractères. */
export const LONGUEUR_MAX_REMARQUES = 1000;

/**
 * Coupe le texte de l'éditable à `max` caractères en gardant sa structure :
 * sauts de ligne, couleurs et tailles avant la coupe sont conservés. On
 * remplaçait autrefois tout le contenu par son texte brut tronqué, ce qui
 * effaçait la mise en forme et les retours à la ligne.
 */
export const tronquerRemarques = (racine: HTMLElement, max: number): boolean => {
    const doc = racine.ownerDocument;
    const parcours = doc.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    let compte = 0;
    for (let n = parcours.nextNode() as Text | null; n; n = parcours.nextNode() as Text | null) {
        if (compte + n.data.length > max) {
            const plage = doc.createRange();
            plage.setStart(n, max - compte);
            plage.setEnd(racine, racine.childNodes.length);
            plage.deleteContents();
            return true;
        }
        compte += n.data.length;
    }
    return false;
};

interface RemarquesEditorProps {
    remarques?: string;
    updateRemarques?: (html: string) => void;
    groupCount: number;
    popupMode?: boolean;
    /** Case « Diagramme » de Mise en page → Infobulles. */
    tooltipsEnabled?: boolean;
}

const RemarquesEditor = ({ remarques, updateRemarques, groupCount, popupMode = false, tooltipsEnabled = true }: RemarquesEditorProps) => {
    const tip = (text: string) => tooltipsEnabled ? text : undefined;
    const remarquesSelectionRef = useRef<RangeBookmark | null>(null);
    const editableRef = useRef<HTMLDivElement | null>(null);
    const restoreSelectionAfterRenderRef = useRef(false);

    // Limite fixe, quelle que soit la hauteur de la colonne (qui défile au-delà).
    // Elle dépendait du nombre de groupes — près de 490 caractères pour neuf
    // groupes — et un texte plus long était coupé à l'enregistrement.
    void groupCount;
    const calculatedMaxLength = LONGUEUR_MAX_REMARQUES;
    const tooltipText = `Remarques générales (${LONGUEUR_MAX_REMARQUES} caractères au plus) — Sélectionnez du texte puis + (vert), − (rouge), ▲ (agrandir), ▼ (réduire)`;


    const docOf = (node: Node | null) => node?.ownerDocument || document;
    const winOf = (node: Node | null) => docOf(node).defaultView || window;

    // La saisie s'arrête à la limite au lieu de couper le texte après coup.
    // Un collage trop long est réduit à la place restante, en texte simple.
    useEffect(() => {
        const editable = editableRef.current;
        if (!editable) return;
        const garde = (e: InputEvent) => {
            if (!e.inputType.startsWith('insert')) return;
            const sel = winOf(editable).getSelection();
            const remplace = sel && sel.rangeCount > 0 ? sel.toString().length : 0;
            const ajout = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
            const place = LONGUEUR_MAX_REMARQUES - ((editable.textContent || '').length - remplace);
            if (ajout.length <= place) return;
            e.preventDefault();
            if (place > 0) docOf(editable).execCommand('insertText', false, ajout.slice(0, place));
        };
        editable.addEventListener('beforeinput', garde);
        return () => editable.removeEventListener('beforeinput', garde);
    });

    const rememberRange = (editable: HTMLElement, range: Range) => {
        remarquesSelectionRef.current = bookmarkRange(editable, range);
    };

    const showSelection = (editable: HTMLElement, range: Range) => {
        try {
            editable.focus({ preventScroll: true });
            const sel = winOf(editable).getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        } catch { /* ignore */ }
    };

    const saveSelectionFrom = (editable: HTMLElement) => {
        const sel = winOf(editable).getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            if (editable.contains(range.startContainer) && editable.contains(range.endContainer)) {
                rememberRange(editable, range);
            }
        }
    };

    // Résout une Range utilisable : sélection LIVE en priorité, repli sur la
    // dernière sauvegardée. Utilise la bonne window selon le contexte (popup
    // ou principal).
    const resolveActiveRange = (editable: HTMLElement): Range | null => {
        const sel = winOf(editable).getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            if (editable.contains(range.startContainer) && editable.contains(range.endContainer)) {
                rememberRange(editable, range);
                return range.cloneRange();
            }
        }
        return rangeFromBookmark(editable, remarquesSelectionRef.current);
    };

    const restoreSelectionOver = (editable: HTMLElement, span: HTMLSpanElement) => {
        // range.insertNode peut laisser un nœud texte vide avant le span. Il
        // disparaît lors de la sérialisation HTML et décalerait alors le signet.
        editable.normalize();
        const doc = docOf(editable);
        const newRange = doc.createRange();
        newRange.selectNodeContents(span);
        rememberRange(editable, newRange);
        showSelection(editable, newRange);
    };

    // dangerouslySetInnerHTML recrée les nœuds après updateRemarques. Une
    // Range DOM pointe alors vers les anciens nœuds et le clic suivant ne fait
    // rien. Le signet par chemins reconstruit la sélection sur le nouveau HTML.
    useLayoutEffect(() => {
        if (!restoreSelectionAfterRenderRef.current) return;
        restoreSelectionAfterRenderRef.current = false;
        const editable = editableRef.current;
        const range = editable && rangeFromBookmark(editable, remarquesSelectionRef.current);
        if (editable && range) showSelection(editable, range);
    });

    // delta = +2 (Agrandir) ou -2 (Réduire). Renvoie un handler React.
    const applyResize = (delta: number) => (e: SyntheticEvent<HTMLElement>) => {
        e.preventDefault();
        const editable = editableRef.current;
        if (!editable) return;
        const range = resolveActiveRange(editable);
        if (!range) return;
        const doc = docOf(editable);
        const win = winOf(editable);
        const container = range.commonAncestorContainer;
        const parentEl = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement;
        const parsedSize = parentEl ? parseFloat(win.getComputedStyle(parentEl).fontSize) : 14;
        const current = Number.isFinite(parsedSize) ? parsedSize : 14;
        const newSize = Math.max(8, current + delta);

        // Après restauration, le Range couvre le span créé au clic précédent :
        // le modifier directement évite d'empiler des balises à chaque ▲/▼.
        if (
            container.nodeType === Node.ELEMENT_NODE
            && container !== editable
            && (container as Element).tagName === 'SPAN'
            && range.startContainer === container
            && range.startOffset === 0
            && range.endContainer === container
            && range.endOffset === container.childNodes.length
        ) {
            const span = container as HTMLSpanElement;
            span.style.fontSize = newSize + 'px';
            restoreSelectionOver(editable, span);
            if (updateRemarques) {
                restoreSelectionAfterRenderRef.current = true;
                updateRemarques(editable.innerHTML);
            }
            return;
        }

        const span = doc.createElement('span');
        span.style.fontSize = newSize + 'px';
        try {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        } catch { return; }
        restoreSelectionOver(editable, span);
        if (updateRemarques) {
            restoreSelectionAfterRenderRef.current = true;
            updateRemarques(editable.innerHTML);
        }
    };

    // Couleur : VERT_TEXTE (vert fluo) ou ROUGE_TEXTE (rouge). Si la sélection est
    // déjà colorée, on bascule sur blanc (retour visuel à la couleur du fond).
    const applyColor = (color: string) => (e: SyntheticEvent<HTMLElement>) => {
        e.preventDefault();
        const editable = editableRef.current;
        if (!editable) return;
        const range = resolveActiveRange(editable);
        if (!range) return;
        const doc = docOf(editable);
        const parentSpan = range.commonAncestorContainer.parentElement;
        const isColored = parentSpan && parentSpan.tagName === 'SPAN' && parentSpan.style.color;
        const span = doc.createElement('span');
        span.style.color = isColored ? 'white' : color;
        try {
            range.surroundContents(span);
        } catch {
            // surroundContents échoue sur les sélections partielles d'un span ;
            // on tombe sur extract/insert qui gère ces cas.
            try {
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
            } catch { return; }
        }
        restoreSelectionOver(editable, span);
        if (updateRemarques) {
            restoreSelectionAfterRenderRef.current = true;
            updateRemarques(editable.innerHTML);
        }
    };

    const resetFormatting = (e: SyntheticEvent<HTMLElement>) => {
        e.preventDefault();
        const editable = editableRef.current;
        if (!editable) return;

        remarquesSelectionRef.current = null;
        const html = resetTextFormatting(editable);
        editable.focus({ preventScroll: true });
        updateRemarques?.(html);
    };

    return (
        <div className={`timeline-remarques no-print${popupMode ? ' remarques-popup-mode' : ''}`}>
            <div className="remarques-header">
                <span>Remarques</span>
                <CustomTooltip text={tip('Couleur verte (+)')}><span
                    className="comment-color-btn comment-color-plus"
                    role="button"
                    aria-label="Colorer le texte sélectionné en vert"
                    onMouseDown={applyColor(VERT_TEXTE)}
                >+</span></CustomTooltip>
                <CustomTooltip text={tip('Couleur rouge (-)')}><span
                    className="comment-color-btn comment-color-minus"
                    role="button"
                    aria-label="Colorer le texte sélectionné en rouge"
                    onMouseDown={applyColor('#F44336')}
                >−</span></CustomTooltip>
                <CustomTooltip text={tip('Agrandir le texte sélectionné')}><span
                    className="comment-size-btn"
                    role="button"
                    aria-label="Agrandir la taille du texte sélectionné"
                    onMouseDown={applyResize(+2)}
                >▲</span></CustomTooltip>
                <CustomTooltip text={tip('Réduire le texte sélectionné')}><span
                    className="comment-size-btn"
                    role="button"
                    aria-label="Réduire la taille du texte sélectionné"
                    onMouseDown={applyResize(-2)}
                >▼</span></CustomTooltip>
                <CustomTooltip text={tip('Réinitialiser la couleur et la taille')}><span
                    className="comment-reset-btn"
                    role="button"
                    aria-label="Réinitialiser la couleur et la taille des remarques"
                    onMouseDown={resetFormatting}
                >Réinit.</span></CustomTooltip>
            </div>
            <div
                ref={editableRef}
                className="input-remarques"
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: vertFluo(remarques) }}
                onMouseUp={(e) => saveSelectionFrom(e.currentTarget)}
                onKeyUp={(e) => saveSelectionFrom(e.currentTarget)}
                onSelect={(e) => saveSelectionFrom(e.currentTarget)}
                onBlur={(e) => {
                    // Filet de sécurité (texte venu d'un ancien projet, par exemple) :
                    // la coupe garde la mise en forme et les sauts de ligne.
                    tronquerRemarques(e.currentTarget, calculatedMaxLength);
                    updateRemarques && updateRemarques(e.currentTarget.innerHTML);
                }}
                onKeyDown={(e) => {
                    // Raccourcis clavier : + / − colorent la sélection.
                    if (e.key === '+' || e.key === '-') {
                        const sel = winOf(e.currentTarget).getSelection();
                        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                            applyColor(e.key === '+' ? VERT_TEXTE : ROUGE_TEXTE)(e);
                        }
                    }
                }}
                data-tooltip={tip(tooltipText)}
            />
        </div>
    );
};

export default RemarquesEditor;
