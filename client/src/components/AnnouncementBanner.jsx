/**
 * AnnouncementBanner
 * Firestore 'announcements' koleksiyonunu dinler.
 * Severity: info (mavi), warning (sarı), critical (kırmızı)
 * dismissible:true ise X butonu gösterir ve localStorage'da kaydeder.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import useAuthStore from '../store/authStore';
import { cn } from '../lib/utils';

const DISMISSED_KEY = 'studyo:dismissed_announcements';

function getDismissed() {
    try {
        return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveDismissed(ids) {
    try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
    } catch {
        // ignore
    }
}

const SEVERITY_STYLES = {
    info: {
        wrapper: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800',
        icon: 'text-blue-500',
        text: 'text-blue-900 dark:text-blue-100',
        close: 'text-blue-400 hover:text-blue-700 dark:hover:text-blue-200',
        Icon: Info,
    },
    warning: {
        wrapper: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-700',
        icon: 'text-yellow-500',
        text: 'text-yellow-900 dark:text-yellow-100',
        close: 'text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-200',
        Icon: AlertTriangle,
    },
    critical: {
        wrapper: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
        icon: 'text-red-500',
        text: 'text-red-900 dark:text-red-100',
        close: 'text-red-400 hover:text-red-700 dark:hover:text-red-200',
        Icon: AlertCircle,
    },
};

export default function AnnouncementBanner() {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const [announcements, setAnnouncements] = useState([]);
    const [dismissed, setDismissed] = useState(() => getDismissed());

    useEffect(() => {
        if (!user?.studioId) return;

        const now = Timestamp.now();
        const ref = collection(db, 'announcements');
        // Zaman aralığı filtresi: startsAt <= now < endsAt
        const q = query(ref, where('startsAt', '<=', now));

        const unsub = onSnapshot(q, (snap) => {
            const active = [];
            snap.forEach((doc) => {
                const d = { id: doc.id, ...doc.data() };
                if (!d.endsAt || d.endsAt.toMillis() <= Date.now()) return;
                if (d.target !== 'all' && !d.target?.includes(user.studioId)) return;
                active.push(d);
            });
            // severity sırası: critical > warning > info
            const order = { critical: 0, warning: 1, info: 2 };
            active.sort((a, b) => (order[a.severity] ?? 2) - (order[b.severity] ?? 2));
            setAnnouncements(active);
        }, (err) => {
            console.warn('[AnnouncementBanner] Firestore error:', err);
        });

        return () => unsub();
    }, [user?.studioId]);

    const visible = announcements.filter((a) => !dismissed.includes(a.id));

    if (visible.length === 0) return null;

    const handleDismiss = (id) => {
        const next = [...dismissed, id];
        setDismissed(next);
        saveDismissed(next);
    };

    return (
        <div className="flex flex-col gap-1 w-full">
            {visible.map((ann) => {
                const sev = SEVERITY_STYLES[ann.severity] || SEVERITY_STYLES.info;
                const { Icon } = sev;
                return (
                    <div
                        key={ann.id}
                        role="alert"
                        className={cn(
                            'flex items-start gap-3 px-4 py-2.5 border-b text-sm',
                            sev.wrapper
                        )}
                    >
                        <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', sev.icon)} aria-hidden="true" />
                        <p className={cn('flex-1', sev.text)}>{ann.message}</p>
                        {ann.dismissible && (
                            <button
                                onClick={() => handleDismiss(ann.id)}
                                aria-label={t('announcement.dismiss')}
                                className={cn('shrink-0 p-0.5 rounded', sev.close)}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
