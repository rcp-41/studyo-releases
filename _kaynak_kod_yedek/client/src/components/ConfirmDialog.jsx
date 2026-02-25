import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Genel onay diyaloğu - silme ve tehlikeli işlemler için
 * Usage:
 *   <ConfirmDialog
 *     open={showDialog}
 *     title="Kaydı Sil"
 *     message="Bu işlem geri alınamaz. Devam etmek istiyor musunuz?"
 *     confirmLabel="Evet, Sil"
 *     variant="danger"
 *     onConfirm={() => handleDelete()}
 *     onCancel={() => setShowDialog(false)}
 *   />
 */
export default function ConfirmDialog({
    open,
    title = 'Emin misiniz?',
    message = 'Bu işlem geri alınamaz.',
    confirmLabel = 'Onayla',
    cancelLabel = 'İptal',
    variant = 'danger', // 'danger' | 'warning' | 'info'
    onConfirm,
    onCancel,
    loading = false
}) {
    // Close on ESC
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape' && open && !loading) {
                onCancel?.();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, loading, onCancel]);

    if (!open) return null;

    const variantClasses = {
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        warning: 'bg-amber-500 text-white hover:bg-amber-600',
        info: 'bg-primary text-primary-foreground hover:bg-primary/90'
    };

    const iconColors = {
        danger: 'text-destructive',
        warning: 'text-amber-500',
        info: 'text-primary'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!loading ? onCancel : undefined}
            />

            {/* Dialog */}
            <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 fade-in duration-200">
                {/* Close button */}
                <button
                    onClick={onCancel}
                    disabled={loading}
                    className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted disabled:opacity-50"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Icon */}
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-full bg-muted ${iconColors[variant]}`}>
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                </div>

                {/* Message */}
                <p className="text-muted-foreground mb-6 ml-12">{message}</p>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${variantClasses[variant]}`}
                    >
                        {loading ? 'İşleniyor...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
