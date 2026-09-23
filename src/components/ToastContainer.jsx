import React, { useCallback, useEffect, useState, useRef } from 'react';
import { subscribeToasts } from '../utils/toast';
import './ToastContainer.css';

const DURATIONS = {
    success: 2500,
    error: 4000,
    info: 3000
};

const ICONS = {
    success: '✓',
    error: '✗',
    info: 'i'
};

const EXIT_DURATION = 250;

const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef(new Map());

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        timersRef.current.delete(id);
    }, []);

    const beginLeaving = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));

        const timeoutId = setTimeout(() => removeToast(id), EXIT_DURATION);
        timersRef.current.set(id, {
            phase: 'leaving',
            timeoutId,
            remaining: 0,
            startedAt: Date.now()
        });
    }, [removeToast]);

    const scheduleDismissal = useCallback((id, delay) => {
        const remaining = Math.max(0, delay);
        const timeoutId = setTimeout(() => beginLeaving(id), remaining);

        timersRef.current.set(id, {
            phase: 'visible',
            timeoutId,
            remaining,
            startedAt: Date.now()
        });
    }, [beginLeaving]);

    const pauseToast = useCallback((id) => {
        const timer = timersRef.current.get(id);
        if (!timer || timer.phase === 'paused') return;

        clearTimeout(timer.timeoutId);
        const remaining = timer.phase === 'leaving'
            ? 0
            : Math.max(0, timer.remaining - (Date.now() - timer.startedAt));

        if (timer.phase === 'leaving') {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: false } : t));
        }

        timersRef.current.set(id, {
            phase: 'paused',
            timeoutId: null,
            remaining,
            startedAt: Date.now()
        });
    }, []);

    const resumeToast = useCallback((id) => {
        const timer = timersRef.current.get(id);
        if (!timer || timer.phase !== 'paused') return;
        scheduleDismissal(id, timer.remaining);
    }, [scheduleDismissal]);

    useEffect(() => {
        const unsubscribe = subscribeToasts(t => {
            setToasts(prev => [...prev, t]);
            const duration = DURATIONS[t.type] || 3000;
            scheduleDismissal(t.id, duration);
        });

        return () => {
            unsubscribe();
            timersRef.current.forEach(timer => clearTimeout(timer.timeoutId));
            timersRef.current.clear();
        };
    }, [scheduleDismissal]);

    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`toast toast-${t.type}${t.leaving ? ' toast-leaving' : ''}`}
                    onMouseEnter={() => pauseToast(t.id)}
                    onMouseLeave={() => resumeToast(t.id)}
                >
                    <span className="toast-icon">{ICONS[t.type]}</span>
                    <span className="toast-msg">{t.message}</span>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
