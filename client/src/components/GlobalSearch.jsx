import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { archivesApi, appointmentsApi, customersApi, shootsApi } from '../services/api';
import { Search, X, Archive, Calendar, UsersRound, Camera, Loader2, Command } from 'lucide-react';
import { cn } from '../lib/utils';

export default function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIdx, setActiveIdx] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Ctrl+K shortcut
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        if (open) {
            setQuery('');
            setActiveIdx(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const debouncedQuery = useDebounce(query, 300);

    const { data: results, isLoading } = useQuery({
        queryKey: ['globalSearch', debouncedQuery],
        queryFn: async () => {
            if (!debouncedQuery || debouncedQuery.length < 2) return [];
            const [archives, customers] = await Promise.allSettled([
                archivesApi.list({ search: debouncedQuery, limit: 5 }).then(r => r.data?.map(a => ({
                    type: 'archive', id: a.id, label: a.archiveNo || a.customerName, sub: a.customerName, icon: Archive, href: `/archives/${a.id}`
                })) || []),
                customersApi.list({ search: debouncedQuery, limit: 5 }).then(r => r.data?.map(c => ({
                    type: 'customer', id: c.id, label: c.fullName, sub: c.phone || c.email, icon: UsersRound, href: `/customers/${c.id}`
                })) || [])
            ]);
            return [
                ...(archives.status === 'fulfilled' ? archives.value : []),
                ...(customers.status === 'fulfilled' ? customers.value : [])
            ];
        },
        enabled: open && debouncedQuery.length >= 2
    });

    const items = results || [];

    const handleSelect = useCallback((item) => {
        navigate(item.href);
        setOpen(false);
    }, [navigate]);

    // Keyboard navigation
    useEffect(() => {
        if (!open || items.length === 0) return;
        const handler = (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % items.length); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + items.length) % items.length); }
            if (e.key === 'Enter' && items[activeIdx]) { e.preventDefault(); handleSelect(items[activeIdx]); }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, items, activeIdx, handleSelect]);

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors">
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Ara...</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded">
                    <Command className="w-3 h-3" />K
                </kbd>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[100]">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="relative mx-auto mt-[15vh] w-full max-w-lg">
                <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                    {/* Search input */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                        <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                        <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                            placeholder="Arşiv, müşteri, randevu ara..."
                            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
                        {query && <button onClick={() => setQuery('')} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>}
                        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted border border-border rounded text-muted-foreground">ESC</kbd>
                    </div>

                    {/* Results */}
                    <div className="max-h-72 overflow-y-auto">
                        {isLoading && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        )}

                        {!isLoading && debouncedQuery.length >= 2 && items.length === 0 && (
                            <div className="py-8 text-center text-sm text-muted-foreground">Sonuç bulunamadı</div>
                        )}

                        {!isLoading && items.length > 0 && (
                            <div className="py-2">
                                {items.map((item, idx) => (
                                    <button key={`${item.type}-${item.id}`} onClick={() => handleSelect(item)}
                                        className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                            idx === activeIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}>
                                        <item.icon className="w-4 h-4 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.label}</p>
                                            {item.sub && <p className="text-xs text-muted-foreground truncate">{item.sub}</p>}
                                        </div>
                                        <span className="text-[10px] uppercase text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                                            {item.type === 'archive' ? 'Arşiv' : item.type === 'customer' ? 'Müşteri' : item.type}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {!isLoading && debouncedQuery.length < 2 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">En az 2 karakter yazın</div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">↑↓ Gezin</span>
                        <span className="flex items-center gap-1">↵ Seç</span>
                        <span className="flex items-center gap-1">ESC Kapat</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Simple debounce hook
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}
