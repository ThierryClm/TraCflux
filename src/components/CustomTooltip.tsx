import React, { useRef, useState } from 'react';
import type { MouseEvent, MouseEventHandler, ReactElement } from 'react';
import { createPortal } from 'react-dom';
import './CustomTooltip.css';

interface TooltipChildProps {
    onMouseEnter?: MouseEventHandler<HTMLElement>;
    onMouseLeave?: MouseEventHandler<HTMLElement>;
    onMouseMove?: MouseEventHandler<HTMLElement>;
}

interface CustomTooltipProps {
    text?: string | null;
    delay?: number;
    children: ReactElement<TooltipChildProps>;
}

/**
 * Wrapper component that shows a custom tooltip (instead of the native `title`)
 * with theme-aware styling and a small delay before appearing.
 *
 * Usage:
 *   <CustomTooltip text="My tooltip">
 *     <button>Click me</button>
 *   </CustomTooltip>
 *
 *   <CustomTooltip text={`Line 1\nLine 2`}>...</CustomTooltip>
 *
 * Props:
 *   - text: string | null — tooltip content (supports \n for new lines)
 *   - delay: number (ms) — how long to wait before showing (default: 400ms)
 *   - children: single React element — the element to attach the tooltip to
 */
const CustomTooltip = ({ text, delay = 400, children }: CustomTooltipProps) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Document propriétaire de l'élément survolé : permet de porter l'infobulle
    // dans le bon document (fenêtre détachée ou principale).
    const docRef = useRef<Document | null>(null);

    if (!text) {
        // No tooltip text: render children directly
        return children;
    }

    const handleMouseEnter = (e: MouseEvent<HTMLElement>) => {
        const x = e.clientX;
        const y = e.clientY;
        docRef.current = e.currentTarget?.ownerDocument || document;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setPos({ x, y });
            setVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setVisible(false);
    };

    const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
        if (visible) setPos({ x: e.clientX, y: e.clientY });
    };

    // Clone the child to attach the mouse handlers
    const child = React.Children.only(children);
    const wrappedChild = React.cloneElement(child, {
        onMouseEnter: (e: MouseEvent<HTMLElement>) => {
            handleMouseEnter(e);
            if (child.props.onMouseEnter) child.props.onMouseEnter(e);
        },
        onMouseLeave: (e: MouseEvent<HTMLElement>) => {
            handleMouseLeave();
            if (child.props.onMouseLeave) child.props.onMouseLeave(e);
        },
        onMouseMove: (e: MouseEvent<HTMLElement>) => {
            handleMouseMove(e);
            if (child.props.onMouseMove) child.props.onMouseMove(e);
        }
    });

    // L'infobulle est rendue via un portail vers le <body> du document
    // propriétaire de la cible. Ainsi elle échappe à tout contexte
    // d'empilement local (un ancêtre avec transform/filter au survol piégeait
    // le position:fixed et plaçait l'infobulle DERRIÈRE les barres du diagramme).
    const targetDoc = docRef.current || document;
    const tooltipNode = visible && targetDoc.body ? createPortal(
        <div
            className="custom-tooltip"
            style={{
                position: 'fixed',
                left: pos.x + 12,
                top: pos.y + 16,
                pointerEvents: 'none',
                zIndex: 9999
            }}
        >
            {text.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
            ))}
        </div>,
        targetDoc.body
    ) : null;

    return (
        <>
            {wrappedChild}
            {tooltipNode}
        </>
    );
};

export default CustomTooltip;
