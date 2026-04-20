import { useState, useEffect } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * ConfirmDialog — Radix AlertDialog wrapper for destructive/confirm flows.
 *
 * New (preferred) API:
 *   <ConfirmDialog
 *     open={bool}
 *     onOpenChange={(open) => ...}
 *     title="..."
 *     description="..."
 *     confirmText="Onayla"
 *     cancelText="Vazgeç"
 *     onConfirm={() => ...}
 *     destructive={true}
 *     requireText="SIL"        // user must type this exact text to enable confirm
 *   />
 *
 * Legacy-compatible props (still supported for existing callers):
 *   message, confirmLabel, cancelLabel, variant ('danger'|'warning'|'info'),
 *   loading, onCancel
 *
 * Radix handles Esc-to-close, focus-trap and `role="alertdialog"` automatically.
 */
export default function ConfirmDialog({
    open,
    onOpenChange,
    title = 'Emin misiniz?',
    description,
    message, // legacy alias for description
    confirmText,
    confirmLabel, // legacy
    cancelText,
    cancelLabel, // legacy
    onConfirm,
    onCancel, // legacy — fired on close/cancel
    destructive,
    variant, // legacy: 'danger' | 'warning' | 'info'
    requireText,
    loading = false
}) {
    // Resolve aliases
    const resolvedDescription = description ?? message ?? 'Bu işlem geri alınamaz.';
    const resolvedConfirm = confirmText ?? confirmLabel ?? 'Onayla';
    const resolvedCancel = cancelText ?? cancelLabel ?? 'Vazgeç';
    const isDestructive = destructive ?? (variant ? variant === 'danger' : true);

    // requireText gating
    const [typed, setTyped] = useState('');
    useEffect(() => {
        if (!open) setTyped('');
    }, [open]);

    const requireSatisfied = !requireText || typed.trim() === requireText;
    const confirmDisabled = loading || !requireSatisfied;

    // Bridge legacy onCancel -> onOpenChange(false)
    const handleOpenChange = (nextOpen) => {
        if (loading) return; // prevent closing while confirming
        if (!nextOpen && onCancel) onCancel();
        onOpenChange?.(nextOpen);
    };

    const iconColor = isDestructive
        ? 'text-destructive'
        : variant === 'warning'
            ? 'text-amber-500'
            : 'text-primary';

    const confirmBtnClasses = isDestructive
        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
        : variant === 'warning'
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : 'bg-primary text-primary-foreground hover:bg-primary/90';

    return (
        <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
            <AlertDialog.Portal>
                <AlertDialog.Overlay
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                />
                <AlertDialog.Content
                    className={cn(
                        'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-6',
                        'bg-card border border-border rounded-xl shadow-2xl',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                        'duration-200 focus:outline-none'
                    )}
                >
                    <div className="flex items-start gap-3 mb-4">
                        <div className={cn('p-2 rounded-full bg-muted shrink-0', iconColor)}>
                            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="flex-1 pt-1">
                            <AlertDialog.Title className="text-lg font-semibold leading-tight">
                                {title}
                            </AlertDialog.Title>
                        </div>
                    </div>

                    <AlertDialog.Description className="text-sm text-muted-foreground mb-5 ml-12">
                        {resolvedDescription}
                    </AlertDialog.Description>

                    {requireText && (
                        <div className="mb-5 ml-12">
                            <label htmlFor="confirm-require-input" className="block text-xs font-medium text-muted-foreground mb-1.5">
                                Devam etmek için <span className="font-mono font-semibold text-foreground">{requireText}</span> yazın
                            </label>
                            <input
                                id="confirm-require-input"
                                type="text"
                                value={typed}
                                onChange={(e) => setTyped(e.target.value)}
                                autoComplete="off"
                                autoFocus
                                aria-invalid={!requireSatisfied}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm"
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <AlertDialog.Cancel asChild>
                            <button
                                type="button"
                                disabled={loading}
                                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                            >
                                {resolvedCancel}
                            </button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action asChild>
                            <button
                                type="button"
                                onClick={(e) => {
                                    // Keep dialog open while requireText is unsatisfied.
                                    if (confirmDisabled) {
                                        e.preventDefault();
                                        return;
                                    }
                                    onConfirm?.();
                                }}
                                disabled={confirmDisabled}
                                className={cn(
                                    'px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                                    confirmBtnClasses
                                )}
                            >
                                {loading ? 'İşleniyor...' : resolvedConfirm}
                            </button>
                        </AlertDialog.Action>
                    </div>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
}
