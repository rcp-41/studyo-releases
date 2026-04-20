import { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Onayla',
    cancelText = 'Vazgeç',
    danger = false,
    requireText = null
}) {
    const [typedText, setTypedText] = useState('');
    const confirmBtnRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!open) {
            setTypedText('');
            return;
        }
        const t = setTimeout(() => {
            if (requireText && inputRef.current) {
                inputRef.current.focus();
            } else if (confirmBtnRef.current) {
                confirmBtnRef.current.focus();
            }
        }, 50);
        return () => clearTimeout(t);
    }, [open, requireText]);

    useEffect(() => {
        if (!open) return;
        function onKey(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
            } else if (e.key === 'Enter') {
                if (requireText) {
                    if (typedText === requireText) {
                        e.preventDefault();
                        onConfirm?.();
                    }
                } else {
                    if (e.target?.tagName !== 'INPUT' && e.target?.tagName !== 'TEXTAREA') {
                        e.preventDefault();
                        onConfirm?.();
                    }
                }
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, onConfirm, requireText, typedText]);

    if (!open) return null;

    const canConfirm = !requireText || typedText === requireText;

    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {danger && <AlertTriangle size={20} color="#ef4444" />}
                        {title || 'Onay'}
                    </h2>
                    <button className="modal-close" onClick={onClose} aria-label="Kapat">
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    {message && (
                        <p style={{ marginBottom: requireText ? '16px' : 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                            {message}
                        </p>
                    )}
                    {requireText && (
                        <>
                            <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
                                Bu işlem geri alınamaz. Devam etmek için aşağıya <strong>{requireText}</strong> yazın.
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="form-input"
                                    value={typedText}
                                    onChange={e => setTypedText(e.target.value)}
                                    placeholder={requireText}
                                    autoComplete="off"
                                />
                            </div>
                        </>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        {cancelText}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        type="button"
                        className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
                        disabled={!canConfirm}
                        onClick={() => { if (canConfirm) onConfirm?.(); }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
