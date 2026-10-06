import { useEffect, useRef, useState } from 'react';
import type {
    CSSProperties,
    ChangeEvent,
    FocusEvent,
    HTMLInputTypeAttribute,
    KeyboardEvent,
    MouseEventHandler,
} from 'react';

interface LocalInputProps {
    value?: string | number | null;
    onCommit: (value: string) => void;
    type?: HTMLInputTypeAttribute;
    className?: string;
    style?: CSSProperties;
    readOnly?: boolean;
    disabled?: boolean;
    onClick?: MouseEventHandler<HTMLInputElement>;
    placeholder?: string;
    maxLength?: number;
    title?: string;
    selectOnFocus?: boolean;
}

/**
 * Input with local state during editing.
 * Commits value to parent only on blur or Enter.
 * This prevents undo from capturing every keystroke.
 */
const LocalInput = ({ value, onCommit, type = 'text', className, style, readOnly, disabled, onClick, placeholder, maxLength, title, selectOnFocus = false }: LocalInputProps) => {
    const [localValue, setLocalValue] = useState(value === undefined || value === null ? '' : String(value));
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync local value with prop when not editing
    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value === undefined || value === null ? '' : String(value));
        }
    }, [value, isEditing]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (readOnly || disabled) return;
        setLocalValue(e.target.value);
    };

    const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
        setIsEditing(true);
        if (selectOnFocus) {
            e.target.select();
        }
    };

    const commit = () => {
        setIsEditing(false);
        if (localValue !== (value === undefined || value === null ? '' : String(value))) {
            onCommit(localValue);
        }
    };

    const handleBlur = () => {
        commit();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            commit();
            inputRef.current?.blur();
        }
    };

    return (
        <input
            ref={inputRef}
            type={type}
            className={className}
            style={style}
            value={localValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={onClick}
            readOnly={readOnly}
            disabled={disabled}
            placeholder={placeholder}
            maxLength={maxLength}
            title={title}
        />
    );
};

export default LocalInput;
