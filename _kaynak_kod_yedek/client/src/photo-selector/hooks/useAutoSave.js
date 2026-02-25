import { useEffect, useRef } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import { serializeToIni } from '../utils/iniManager';

const DEBOUNCE_MS = 2000;
const INTERVAL_MS = 30000;

export default function useAutoSave() {
    const isDirty = usePhotoSelectorStore(s => s.isDirty);
    const markSaved = usePhotoSelectorStore(s => s.markSaved);
    const debounceRef = useRef(null);
    const intervalRef = useRef(null);

    const performSave = async () => {
        const state = usePhotoSelectorStore.getState();
        if (!state.isDirty || !state.archiveInfo?.folderPath) return;

        try {
            const iniData = serializeToIni(state);
            const result = await window.electron?.photoSelector?.writeIni({
                folderPath: state.archiveInfo.folderPath,
                data: iniData,
            });
            if (result?.success) markSaved();
        } catch (err) {
            console.error('Auto-save failed:', err);
        }
    };

    // Dirty state değişiminde debounced kayıt
    useEffect(() => {
        if (isDirty) {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(performSave, DEBOUNCE_MS);
        }
        return () => clearTimeout(debounceRef.current);
    }, [isDirty]);

    // 30 saniyede bir periyodik kayıt
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            if (usePhotoSelectorStore.getState().isDirty) performSave();
        }, INTERVAL_MS);
        return () => clearInterval(intervalRef.current);
    }, []);

    // Pencere kapatılmadan önce kayıt
    useEffect(() => {
        const handleBeforeClose = async () => {
            await performSave();
            window.electron?.photoSelector?.confirmClose();
        };
        window.electron?.photoSelector?.onBeforeClose?.(handleBeforeClose);
    }, []);

    return { performSave };
}
