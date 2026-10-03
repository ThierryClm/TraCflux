import React from 'react';
import type { ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    className?: string;
    overlayClassName?: string;
}

const Modal = ({ isOpen, onClose, title, children, className = '', overlayClassName = '' }: ModalProps) => {
    if (!isOpen) return null;

    return (
        <div className={`modal-overlay ${overlayClassName}`} onClick={onClose}>
            <div className={`modal-content ${className}`} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
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
