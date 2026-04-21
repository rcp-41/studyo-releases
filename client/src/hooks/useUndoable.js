import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * useUndoable — wrap a destructive mutation in an undo-grace-period toast.
 *
 * Usage:
 *   const undoDelete = useUndoable({
 *     onConfirm: (payload) => api.delete(payload.id),
 *     onUndo: (payload)   => restoreRowLocally(payload),
 *     message: `'${label}' silindi`,
 *     undoLabel: 'Geri Al',
 *     delayMs: 8000
 *   });
 *   undoDelete.trigger({ id, label, snapshot });
 *
 * Lifecycle for a single trigger():
 *   1. Caller has already applied the optimistic UI change (e.g. removed the row).
 *   2. We show a sonner `loading` toast with a "Geri Al" action and a `duration` equal
 *      to the grace period (so the toast visually progresses / auto-dismisses).
 *   3. We start an internal timer for `delayMs`.
 *   4a. If the user clicks "Geri Al" before the timer fires → we clear the timer,
 *       call `onUndo(payload)` (caller restores the row), and dismiss the toast.
 *   4b. If the timer fires → we call `onConfirm(payload)`; the toast flips to success
 *       on fulfillment or to error on rejection. `onConfirm` may return a Promise.
 *
 * Concurrency:
 *   • Every trigger gets a unique toast id → several in-flight undos can co-exist
 *     (rapid-fire multi-delete works correctly).
 *   • Pending timers are tracked in a Map keyed by toast id; `cancel(id)` / unmount
 *     clear them cleanly.
 *   • If the component unmounts while items are pending, we commit them synchronously
 *     (fire `onConfirm` for each) so the user's intent isn't lost when they navigate
 *     away. Timers are always cleared to prevent "setState on unmounted".
 */
export default function useUndoable({
    onConfirm,
    onUndo,
    message,
    undoLabel = 'Geri Al',
    delayMs = 8000
} = {}) {
    // Keep the latest callbacks in refs so we don't re-create `trigger` identity on
    // every parent render (which would otherwise churn useEffect deps in callers).
    const onConfirmRef = useRef(onConfirm);
    const onUndoRef = useRef(onUndo);
    const messageRef = useRef(message);
    const undoLabelRef = useRef(undoLabel);
    const delayMsRef = useRef(delayMs);

    onConfirmRef.current = onConfirm;
    onUndoRef.current = onUndo;
    messageRef.current = message;
    undoLabelRef.current = undoLabel;
    delayMsRef.current = delayMs;

    // Pending = toast id → { timerId, payload, cancelled }
    const pendingRef = useRef(new Map());
    const [isPending, setIsPending] = useState(false);

    const updatePendingFlag = useCallback(() => {
        setIsPending(pendingRef.current.size > 0);
    }, []);

    const finalize = useCallback((id) => {
        pendingRef.current.delete(id);
        updatePendingFlag();
    }, [updatePendingFlag]);

    const cancel = useCallback((id) => {
        const entry = id != null ? pendingRef.current.get(id) : null;
        // If a specific id is requested but not found, bail.
        if (id != null && !entry) return false;

        const runCancel = (tid, record) => {
            if (record.cancelled) return;
            record.cancelled = true;
            if (record.timerId) clearTimeout(record.timerId);
            try {
                onUndoRef.current?.(record.payload);
            } catch (err) {
                // Swallow — undo should never crash callers.
                console.error('[useUndoable] onUndo threw:', err);
            }
            toast.dismiss(tid);
            finalize(tid);
        };

        if (id != null) {
            runCancel(id, entry);
            return true;
        }
        // Cancel everything pending.
        for (const [tid, record] of pendingRef.current.entries()) {
            runCancel(tid, record);
        }
        return true;
    }, [finalize]);

    const commit = useCallback(async (id) => {
        const entry = pendingRef.current.get(id);
        if (!entry || entry.cancelled) return;
        const { payload, message: entryMessage } = entry;
        const effectiveMessage = entryMessage || messageRef.current;
        try {
            const resultMaybePromise = onConfirmRef.current?.(payload);
            if (resultMaybePromise && typeof resultMaybePromise.then === 'function') {
                // Flip the toast into a loading/success chain.
                toast.promise(resultMaybePromise, {
                    id,
                    loading: effectiveMessage || 'İşleniyor...',
                    success: effectiveMessage || 'Tamamlandı',
                    error: 'İşlem başarısız'
                });
                await resultMaybePromise;
            } else {
                // Synchronous confirm — just show success.
                toast.success(effectiveMessage || 'Tamamlandı', { id });
            }
        } catch (err) {
            console.error('[useUndoable] onConfirm threw:', err);
            toast.error('İşlem başarısız', { id });
        } finally {
            finalize(id);
        }
    }, [finalize]);

    /**
     * trigger(payload, options?)
     *   payload — forwarded to onConfirm / onUndo.
     *   options.message — per-call override of the toast label (falls back to the hook's
     *     constructor-time `message`). Supports the common case of "X silindi" where X
     *     varies per row without having to pass the message through the payload shape.
     */
    const trigger = useCallback((payload, options = {}) => {
        // Each trigger gets a unique toast id so multiple in-flight undos co-exist.
        const id = `undoable-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const currentDelay = delayMsRef.current;
        const effectiveMessage = options.message || messageRef.current;

        const timerId = setTimeout(() => {
            commit(id);
        }, currentDelay);

        pendingRef.current.set(id, { timerId, payload, cancelled: false, message: effectiveMessage });
        updatePendingFlag();

        toast.loading(effectiveMessage || 'Siliniyor...', {
            id,
            // Keep the toast visible for the full grace window so the user sees the
            // countdown progress bar. Sonner auto-dismisses on `duration` expiry, so
            // we add a tiny buffer to ensure the dismiss doesn't race the commit toast.
            duration: currentDelay + 500,
            action: {
                label: undoLabelRef.current,
                onClick: () => cancel(id)
            }
        });

        return id;
    }, [cancel, commit, updatePendingFlag]);

    // On unmount, commit any outstanding items so the user's destructive intent
    // isn't silently dropped if they navigate away. (We previously considered
    // "cancel everything" but that would restore rows the user explicitly deleted;
    // committing matches what would have happened had they waited.)
    useEffect(() => {
        return () => {
            const entries = Array.from(pendingRef.current.entries());
            for (const [id, record] of entries) {
                if (record.cancelled) continue;
                if (record.timerId) clearTimeout(record.timerId);
                try {
                    onConfirmRef.current?.(record.payload);
                } catch (err) {
                    console.error('[useUndoable] onConfirm during unmount threw:', err);
                }
                toast.dismiss(id);
            }
            pendingRef.current.clear();
        };
    }, []);

    return { trigger, cancel, isPending };
}
