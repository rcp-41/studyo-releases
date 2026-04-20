import { useState, useRef } from 'react';
import { Scan, Upload, X, Loader2, CheckCircle, AlertCircle, FolderSearch } from 'lucide-react';
import { toast } from 'sonner';
import usePhotoSelectorStore from '../stores/photoSelectorStore';

const THRESHOLD = 0.5; // Euclidean distance threshold (lower = stricter)

/**
 * FaceRecognition component
 * Lets the user pick a reference image, then searches the current folder for photos
 * that contain a matching face using face-api.js (running in Electron main process).
 */
export default function FaceRecognition({ onClose }) {
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [referenceFile, setReferenceFile] = useState(null);
    const [referencePreview, setReferencePreview] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState(null); // null | { matches: [], totalScanned: number }
    const [error, setError] = useState(null);

    const fileInputRef = useRef(null);
    const photos = usePhotoSelectorStore(s => s.photos);
    const setFilter = usePhotoSelectorStore(s => s.setFilter ?? null);

    const faceRecognition = window.electron?.faceRecognition;

    // ── Load models ──────────────────────────────────────────────────
    const handleLoadModels = async () => {
        if (!faceRecognition) {
            setError('Yüz tanıma sadece Electron uygulamasında çalışır.');
            return;
        }
        setModelsLoading(true);
        setError(null);
        try {
            const res = await faceRecognition.loadModels({});
            if (res.success) {
                setModelsLoaded(true);
                toast.success('Modeller yüklendi');
            } else {
                setError(res.error || 'Modeller yüklenemedi');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setModelsLoading(false);
        }
    };

    // ── Pick reference image ──────────────────────────────────────────
    const handlePickReference = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show local preview
        const url = URL.createObjectURL(file);
        setReferencePreview(url);
        setReferenceFile(file.path || file.name);
        setResults(null);
        setError(null);
    };

    // ── Scan folder ──────────────────────────────────────────────────
    const handleScan = async () => {
        if (!referenceFile) {
            toast.error('Önce referans fotoğraf seçin');
            return;
        }
        if (!modelsLoaded) {
            toast.error('Önce modelleri yükleyin');
            return;
        }
        if (!faceRecognition) {
            setError('Yüz tanıma sadece Electron uygulamasında çalışır.');
            return;
        }

        setScanning(true);
        setError(null);
        setResults(null);

        try {
            // 1. Get descriptor for reference image
            const descRes = await faceRecognition.getDescriptor({ filePath: referenceFile });
            if (!descRes.success) throw new Error(descRes.error);
            if (!descRes.descriptor) throw new Error('Referans fotoğrafta yüz bulunamadı');

            // 2. Search through all current photos
            const allPaths = photos.map(p => p.path || p.filePath).filter(Boolean);
            const matchRes = await faceRecognition.findMatches({
                referenceDescriptor: descRes.descriptor,
                filePaths: allPaths,
                threshold: THRESHOLD,
            });
            if (!matchRes.success) throw new Error(matchRes.error);

            setResults({
                matches: matchRes.matches,
                totalScanned: allPaths.length,
            });

            toast.success(`${matchRes.matches.length} eşleşme bulundu`);
        } catch (err) {
            setError(err.message);
            toast.error('Tarama hatası: ' + err.message);
        } finally {
            setScanning(false);
        }
    };

    // ── Apply filter to show only matching photos ─────────────────────
    const handleShowMatches = () => {
        if (!results) return;
        const matchPaths = new Set(results.matches.map(m => m.filePath));
        // Use store filter if available
        if (typeof setFilter === 'function') {
            setFilter(p => matchPaths.has(p.path || p.filePath));
        }
        toast.success('Eşleşen fotoğraflar gösteriliyor');
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />

            <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 text-neutral-100 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Scan className="w-5 h-5 text-amber-400" />
                        <h2 className="text-lg font-semibold">Yüz Tanıma</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg" aria-label="Kapat">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step 1: Load Models */}
                <div className={`rounded-xl border p-4 space-y-3 transition-colors ${modelsLoaded ? 'border-green-500/30 bg-green-500/5' : 'border-neutral-700 bg-neutral-800/50'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {modelsLoaded
                                ? <CheckCircle className="w-4 h-4 text-green-400" />
                                : <span className="w-5 h-5 rounded-full bg-neutral-600 flex items-center justify-center text-xs font-bold">1</span>}
                            <span className="text-sm font-medium">AI Modelleri Yükle</span>
                        </div>
                        {!modelsLoaded && (
                            <button
                                onClick={handleLoadModels}
                                disabled={modelsLoading}
                                className="px-3 py-1.5 bg-amber-500 text-neutral-900 rounded-lg text-sm font-medium hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {modelsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {modelsLoading ? 'Yükleniyor...' : 'Yükle'}
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-neutral-500">
                        {modelsLoaded
                            ? 'Modeller hazır. Yüz tanıma kullanılabilir.'
                            : 'SSD MobileNet + Landmark + Recognition modelleri yüklenir (~10 MB).'}
                    </p>
                </div>

                {/* Step 2: Reference photo */}
                <div className={`rounded-xl border p-4 space-y-3 transition-colors ${referenceFile ? 'border-blue-500/30 bg-blue-500/5' : 'border-neutral-700 bg-neutral-800/50'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {referenceFile
                                ? <CheckCircle className="w-4 h-4 text-blue-400" />
                                : <span className="w-5 h-5 rounded-full bg-neutral-600 flex items-center justify-center text-xs font-bold">2</span>}
                            <span className="text-sm font-medium">Referans Fotoğraf Seç</span>
                        </div>
                        <button
                            onClick={handlePickReference}
                            className="px-3 py-1.5 border border-neutral-600 rounded-lg text-sm hover:bg-neutral-700 flex items-center gap-1.5"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {referenceFile ? 'Değiştir' : 'Seç'}
                        </button>
                    </div>

                    {referencePreview && (
                        <img
                            src={referencePreview}
                            alt="Referans"
                            className="w-24 h-24 object-cover rounded-lg border border-neutral-600"
                        />
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>

                {/* Step 3: Scan */}
                <div className="rounded-xl border border-neutral-700 bg-neutral-800/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FolderSearch className="w-4 h-4 text-neutral-400" />
                            <span className="text-sm font-medium">Klasörü Tara</span>
                        </div>
                        <button
                            onClick={handleScan}
                            disabled={!modelsLoaded || !referenceFile || scanning}
                            className="px-3 py-1.5 bg-amber-500 text-neutral-900 rounded-lg text-sm font-medium hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                            {scanning ? 'Taranıyor...' : 'Tara'}
                        </button>
                    </div>

                    <p className="text-xs text-neutral-500">
                        {photos.length} fotoğraf taranacak · Eşik: {THRESHOLD}
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="rounded-xl border border-neutral-700 bg-neutral-800/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                                {results.matches.length > 0
                                    ? `${results.matches.length} / ${results.totalScanned} eşleşme bulundu`
                                    : 'Eşleşme bulunamadı'}
                            </span>
                            {results.matches.length > 0 && (
                                <button
                                    onClick={handleShowMatches}
                                    className="px-3 py-1.5 bg-amber-500 text-neutral-900 rounded-lg text-sm font-medium hover:bg-amber-400"
                                >
                                    Göster
                                </button>
                            )}
                        </div>

                        {results.matches.length > 0 && (
                            <ul className="space-y-1 max-h-36 overflow-y-auto text-xs text-neutral-400">
                                {results.matches.map(m => (
                                    <li key={m.filePath} className="flex justify-between gap-2 font-mono">
                                        <span className="truncate">{m.filePath.split(/[\\/]/).pop()}</span>
                                        <span className="shrink-0 text-amber-400">{m.distance.toFixed(3)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
