import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

const LANGUAGES = [
    { code: 'tr', label: 'TR', name: 'Türkçe' },
    { code: 'en', label: 'EN', name: 'English' },
];

const STORAGE_KEY = 'studyo:language';

export default function LanguageSwitcher({ className, compact = false }) {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const currentCode = (i18n.language || 'tr').split('-')[0];
    const current = LANGUAGES.find((l) => l.code === currentCode) || LANGUAGES[0];

    useEffect(() => {
        const onDocClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const changeLanguage = (code) => {
        i18n.changeLanguage(code);
        try {
            localStorage.setItem(STORAGE_KEY, code);
        } catch (_) {
            // ignore
        }
        setOpen(false);
    };

    return (
        <div ref={ref} className={cn('relative inline-block', className)}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={cn(
                    'flex items-center gap-1.5 rounded-lg border border-border bg-card/60 hover:bg-muted transition-colors',
                    compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
                )}
                aria-label="Language"
            >
                <Globe className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                <span className="font-medium">{current.label}</span>
                <ChevronDown className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            </button>

            {open && (
                <div className="absolute right-0 mt-1 min-w-[7rem] bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
                    {LANGUAGES.map((lang) => {
                        const active = lang.code === currentCode;
                        return (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => changeLanguage(lang.code)}
                                className={cn(
                                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors',
                                    active && 'bg-muted/60 text-primary font-medium'
                                )}
                            >
                                <span>{lang.name}</span>
                                <span className="text-xs text-muted-foreground">{lang.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
