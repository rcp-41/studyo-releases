import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { optionsApi } from '../../services/api';
import { UserCog } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PhotographerSelector({ currentPhotographer, onSelect }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { data: photographers } = useQuery({
        queryKey: ['photographers'],
        queryFn: () => optionsApi.getPhotographers().then(r => r.data),
        enabled: open
    });

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-sm rounded hover:bg-muted transition-colors"
                title={t('shootDetail.changePhotographer')}
            >
                <span className="font-medium">{currentPhotographer?.fullName || t('shootDetail.noPhotographerAssigned')}</span>
                <UserCog className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {open && (
                <div className="absolute z-20 top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
                    {photographers?.map(p => (
                        <button
                            key={p.id}
                            onClick={() => { onSelect(p.id); setOpen(false); }}
                            className={cn(
                                'w-full text-left px-3 py-1.5 text-sm hover:bg-muted',
                                currentPhotographer?.id === p.id && 'bg-muted font-medium'
                            )}
                        >
                            {p.name || p.fullName}
                        </button>
                    ))}
                    {!photographers?.length && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">{t('shootDetail.noPhotographers')}</p>
                    )}
                </div>
            )}
        </div>
    );
}
