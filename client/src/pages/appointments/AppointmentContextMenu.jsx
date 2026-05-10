import { useRef, useEffect } from 'react';
import { Check, XCircle, Edit, Calendar, Archive, X } from 'lucide-react';

export default function AppointmentContextMenu({ x, y, appointment, onClose, onAction }) {
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div ref={ref} className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px]" style={{ left: x, top: y }}>
            <button onClick={() => onAction('completed')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> Geldi
            </button>
            <button onClick={() => onAction('no_show')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" /> Gelmedi
            </button>
            <div className="border-t border-border my-1" />
            <button onClick={() => onAction('edit')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                <Edit className="w-4 h-4" /> Düzenle
            </button>
            <button onClick={() => onAction('postpone')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" /> Başka Güne Ertele
            </button>
            <button onClick={() => onAction('archive')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-blue-600">
                <Archive className="w-4 h-4" /> Arşive Aktar
            </button>
            <div className="border-t border-border my-1" />
            <button onClick={() => onAction('delete')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-destructive flex items-center gap-2">
                <X className="w-4 h-4" /> Sil
            </button>
        </div>
    );
}
