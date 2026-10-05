import {
    useState,
    useRef,
    useCallback,
    useEffect,
    type MouseEvent as ReactMouseEvent
} from 'react';

interface Position {
    x: number;
    y: number;
}

/** Gère l'état et le drag de la légende flottante. */
const useFloatingLegend = () => {
    const [showFloatingLegend, setShowFloatingLegend] = useState(false);
    const [floatingLegendPosition, setFloatingLegendPosition] = useState<Position>({ x: 200, y: 150 });
    const [isLegendDragging, setIsLegendDragging] = useState(false);
    const legendDragOffset = useRef<Position>({ x: 0, y: 0 });

    const handleLegendMouseDown = useCallback((event: ReactMouseEvent<HTMLElement>) => {
        const target = event.target as Element;
        if (target.classList.contains('floating-close-btn')) return;
        setIsLegendDragging(true);
        legendDragOffset.current = {
            x: event.clientX - floatingLegendPosition.x,
            y: event.clientY - floatingLegendPosition.y
        };
    }, [floatingLegendPosition]);

    useEffect(() => {
        if (!isLegendDragging) return;

        const handleMouseMove = (event: MouseEvent) => {
            setFloatingLegendPosition({
                x: event.clientX - legendDragOffset.current.x,
                y: event.clientY - legendDragOffset.current.y
            });
        };

        const handleMouseUp = () => {
            setIsLegendDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isLegendDragging]);

    return {
        showFloatingLegend,
        setShowFloatingLegend,
        floatingLegendPosition,
        isLegendDragging,
        handleLegendMouseDown
    };
};

export default useFloatingLegend;
