import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * PasswordInput — native input with a trailing eye-toggle.
 *
 * Props:
 *   value, onChange          controlled input
 *   placeholder, id, className
 *   ...rest                   forwarded to <input>
 *
 * Matches the project's input aesthetic: `bg-background border border-input
 * focus:border-primary rounded-lg py-2 px-3 text-sm`.
 */
const PasswordInput = forwardRef(function PasswordInput(
    { value, onChange, placeholder, id, className, ...rest },
    ref
) {
    const [show, setShow] = useState(false);
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
        <div className={cn('relative', className)}>
            <input
                ref={ref}
                id={inputId}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full pl-3 pr-10 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm disabled:opacity-50"
                {...rest}
            />
            <button
                type="button"
                onClick={() => setShow((s) => !s)}
                tabIndex={-1}
                aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
                aria-pressed={show}
                aria-controls={inputId}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
                {show ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
            </button>
        </div>
    );
});

export default PasswordInput;
