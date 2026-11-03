import React, { useRef, useState } from 'react';
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import './Modal.css';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    className?: string;
    overlayClassName?: string;
    /**
     * Fenêtre non modale : la page n'est ni assombrie ni bloquée (on continue à
     * lire et à cliquer le diagramme), et la fenêtre se déplace par son bandeau.
     */
    nonModale?: boolean;
    /** Infobulle « Faites glisser… » du bandeau (fenêtre non modale). */
    tooltipsEnabled?: boolean;
}

const Modal = ({ isOpen, onClose, title, children, className = '', overlayClassName = '', nonModale = false, tooltipsEnabled = true }: ModalProps) => {
    // Déplacement de la fenêtre non modale, repris à zéro à chaque ouverture.
    const [decalage, setDecalage] = useState({ x: 0, y: 0 });
    const depart = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
    const [ouverte, setOuverte] = useState(isOpen);
    if (ouverte !== isOpen) {
        setOuverte(isOpen);
        if (isOpen) setDecalage({ x: 0, y: 0 });
    }

    if (!isOpen) return null;

    const commencerDeplacement = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (!nonModale || (e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        depart.current = { x: e.clientX, y: e.clientY, dx: decalage.x, dy: decalage.y };
        const bouger = (ev: MouseEvent) => {
            const d = depart.current;
            if (d) setDecalage({ x: d.dx + ev.clientX - d.x, y: d.dy + ev.clientY - d.y });
        };
        const lacher = () => {
            depart.current = null;
            document.removeEventListener('mousemove', bouger);
            document.removeEventListener('mouseup', lacher);
        };
        document.addEventListener('mousemove', bouger);
        document.addEventListener('mouseup', lacher);
    };

    return (
        <div className={`modal-overlay ${nonModale ? 'modal-non-modale' : ''} ${overlayClassName}`} onClick={nonModale ? undefined : onClose}>
            <div className={`modal-content ${className}`} onClick={(e) => e.stopPropagation()}
                style={nonModale ? { transform: `translate(${decalage.x}px, ${decalage.y}px)` } : undefined}>
                <div className={`modal-header${nonModale ? ' modal-header-deplacable' : ''}`} onMouseDown={commencerDeplacement}
                    title={nonModale && tooltipsEnabled ? 'Faites glisser pour déplacer la fenêtre' : undefined}>
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
