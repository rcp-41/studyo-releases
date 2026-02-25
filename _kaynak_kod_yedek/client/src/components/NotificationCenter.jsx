import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, Calendar, DollarSign, Camera, Check, CheckCheck, Trash2 } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

const iconMap = {
    appointment: Calendar,
    payment: DollarSign,
    shoot: Camera,
    default: Bell
};

const colorMap = {
    appointment: 'bg-blue-500/10 text-blue-500',
    payment: 'bg-green-500/10 text-green-500',
    shoot: 'bg-purple-500/10 text-purple-500',
    default: 'bg-primary/10 text-primary'
};

export default function NotificationCenter() {
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const navigate = useNavigate();

    // Mock notifications (will be replaced by real API)
    const [notifications, setNotifications] = useState(() => {
        const saved = localStorage.getItem('studyo-notifications');
        if (saved) return JSON.parse(saved);
        return [
            { id: '1', type: 'appointment', title: 'Yaklaşan Randevu', message: '14:00 — Ahmet Yılmaz Düğün Çekimi', time: new Date().toISOString(), read: false, href: '/appointments' },
            { id: '2', type: 'payment', title: 'Ödeme Alındı', message: '₺2,500 — Fatma Kara, Nişan', time: new Date(Date.now() - 3600000).toISOString(), read: false, href: '/finance' },
            { id: '3', type: 'shoot', title: 'Yeni Sipariş', message: 'Online sipariş — Bebek Çekimi paketi', time: new Date(Date.now() - 7200000).toISOString(), read: true, href: '/wc-clients' }
        ];
    });

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('studyo-notifications', JSON.stringify(notifications));
    }, [notifications]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const handleClick = (notif) => {
        markAsRead(notif.id);
        if (notif.href) navigate(notif.href);
        setOpen(false);
    };

    return (
        <div className="relative" ref={panelRef}>
            <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-muted rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <h3 className="font-semibold text-sm">Bildirimler</h3>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button onClick={markAllRead} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground" title="Tümünü okundu işaretle">
                                    <CheckCheck className="w-4 h-4" />
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-muted rounded-lg">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Notification list */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-border">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">Bildirim yok</div>
                        ) : (
                            notifications.map(notif => {
                                const Icon = iconMap[notif.type] || iconMap.default;
                                const color = colorMap[notif.type] || colorMap.default;

                                return (
                                    <div key={notif.id}
                                        className={cn('flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 group',
                                            !notif.read && 'bg-primary/5')}>
                                        <div className={cn('p-2 rounded-lg shrink-0 mt-0.5', color)} onClick={() => handleClick(notif)}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0" onClick={() => handleClick(notif)}>
                                            <p className={cn('text-sm truncate', !notif.read ? 'font-semibold' : 'font-medium')}>{notif.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">{formatDate(notif.time)}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            {!notif.read && (
                                                <button onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                                    className="p-1 hover:bg-primary/10 rounded" title="Okundu işaretle">
                                                    <Check className="w-3 h-3" />
                                                </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
                                                className="p-1 hover:bg-red-500/10 text-red-500 rounded" title="Sil">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
