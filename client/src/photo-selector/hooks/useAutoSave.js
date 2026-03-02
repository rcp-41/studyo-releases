import { useEffect, useRef, useCallback } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import { serializeToIni } from '../utils/iniManager';

const DEBOUNCE_MS = 2000;
const INTERVAL_MS = 30000;

export default function useAutoSave() {
    const isDirty = usePhotoSelectorStore(s => s.isDirty);
    const markSaved = usePhotoSelectorStore(s => s.markSaved);
    const debounceRef = useRef(null);
    const intervalRef = useRef(null);
    const beforeCloseHandlerRef = useRef(null);

    // Stable save function via useCallback + getState() to always read fresh state
    const performSave = useCallback(async () => {
        const state = usePhotoSelectorStore.getState();
        if (!state.isDirty || !state.archiveInfo?.folderPath) return;

        try {
            const iniData = serializeToIni(state);
            if (!iniData) {
                console.warn('[AutoSave] serializeToIni returned null, skipping save');
                return;
            }
            const result = await window.electron?.photoSelector?.writeIni({
                folderPath: state.archiveInfo.folderPath,
                data: iniData,
            });

            const notes = state.numberedPhotos
                .filter(np => !np.isCancelled && (np.optionDetails?.not || np.optionDetails?.description))
                .map(np => ({ orderNumber: np.orderNumber, text: np.optionDetails.not || np.optionDetails.description }));

            if (notes.length > 0 && window.electron?.photoSelector?.createNotes) {
                await window.electron.photoSelector.createNotes({
                    folderPath: state.archiveInfo.folderPath,
                    archiveNo: state.archiveInfo.archiveNo || 'Not',
                    notes
                });
            }

            if (result?.success) {
                markSaved();
            } else if (result && !result.success) {
                console.error('[AutoSave] Write failed:', result.error);
            }
        } catch (err) {
            console.error('[AutoSave] Save failed:', err);
        }
    }, [markSaved]);

    // Dirty state değişiminde debounced kayıt
    useEffect(() => {
        if (isDirty) {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(performSave, DEBOUNCE_MS);
        }
        return () => clearTimeout(debounceRef.current);
    }, [isDirty, performSave]);

    // 30 saniyede bir periyodik kayıt
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            if (usePhotoSelectorStore.getState().isDirty) performSave();
        }, INTERVAL_MS);
        return () => clearInterval(intervalRef.current);
    }, [performSave]);

    // Pencere kapatılmadan önce kayıt (with proper cleanup)
    useEffect(() => {
        const handleBeforeClose = async () => {
            await performSave();
            window.electron?.photoSelector?.confirmClose();
        };

        // Store handler ref for cleanup
        beforeCloseHandlerRef.current = handleBeforeClose;
        window.electron?.photoSelector?.onBeforeClose?.(handleBeforeClose);

        return () => {
            // Remove the beforeClose listener on unmount
            if (window.electron?.photoSelector?.removeBeforeClose) {
                window.electron.photoSelector.removeBeforeClose(beforeCloseHandlerRef.current);
            }
        };
    }, [performSave]);

    return { performSave };
}
