import { useState, useMemo, useEffect } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import PricePreview from './PricePreview';
import EditOrderModal from './EditOrderModal';
import { pixonaiApi } from '../../services/api';
import { ListOrdered, X, Star, Settings, Package } from 'lucide-react';

export default function SelectionPanel({ onClose }) {
    const photos = usePhotoSelectorStore(s => s.photos);
    const selectedIndex = usePhotoSelectorStore(s => s.selectedIndex);
    const numberedPhotos = usePhotoSelectorStore(s => s.numberedPhotos);
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const assignNumber = usePhotoSelectorStore(s => s.assignNumber);
    const updateNumberOptions = usePhotoSelectorStore(s => s.updateNumberOptions);
    const removeNumber = usePhotoSelectorStore(s => s.removeNumber);
    const priceList = usePhotoSelectorStore(s => s.priceList);
    const updatePricing = usePhotoSelectorStore(s => s.updatePricing);
    const archiveInfo = usePhotoSelectorStore(s => s.archiveInfo);
    const operationMode = usePhotoSelectorStore(s => s.operationMode);

    const [editOrderOpen, setEditOrderOpen] = useState(false);
    const [selectedPhotoId, setSelectedPhotoId] = useState(null);

    const shootCategory = archiveInfo?.shootCategory || '';
    const isFolderOnly = operationMode === 'folder_only';

    // Dynamic config from Pixonai settings
    const [pixonaiConfig, setPixonaiConfig] = useState(null);
    const [configLoading, setConfigLoading] = useState(false);

    // Fetch pixonai config for this shootCategory
    useEffect(() => {
        if (isFolderOnly || !shootCategory) return;
        setConfigLoading(true);
        pixonaiApi.getConfig(shootCategory)
            .then(result => {
                setPixonaiConfig(result?.config || null);
            })
            .catch(err => {
                console.error('Failed to load Pixonai config:', err);
                setPixonaiConfig(null);
            })
            .finally(() => setConfigLoading(false));
    }, [shootCategory, isFolderOnly]);

    const configOptions = pixonaiConfig?.options || [];
    const configPackages = pixonaiConfig?.packages || [];

    // Current photo for numbering
    const currentPhoto = photos[selectedIndex] || null;
    const currentNumbered = currentPhoto
        ? numberedPhotos.find(np => np.photoId === currentPhoto.id)
        : null;

    // Dynamic option form state — built from config
    const [optionForm, setOptionForm] = useState({});
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [not, setNot] = useState('');

    // folder_only specific
    const [recordName, setRecordName] = useState('');
    const [description, setDescription] = useState('');

    // Initialize form when config loads
    useEffect(() => {
        if (configOptions.length === 0) return;
        const initial = {};
        configOptions.forEach(opt => {
            if (opt.type === 'select') initial[opt.id] = '';
            else if (opt.type === 'number') initial[opt.id] = opt.min ?? 0;
            else if (opt.type === 'checkbox') initial[opt.id] = false;
        });
        setOptionForm(initial);
    }, [configOptions.length]);

    // Load existing options when selecting a numbered photo
    useEffect(() => {
        if (!currentNumbered) {
            setSelectedPackage(null);
            return;
        }
        const details = currentNumbered.optionDetails || {};
        if (details._packageId) {
            setSelectedPackage(details._packageId);
        } else {
            setSelectedPackage(null);
        }
        // Restore form values
        const restored = {};
        configOptions.forEach(opt => {
            if (details[opt.id] !== undefined) {
                restored[opt.id] = details[opt.id];
            } else if (opt.type === 'select') restored[opt.id] = '';
            else if (opt.type === 'number') restored[opt.id] = opt.min ?? 0;
            else if (opt.type === 'checkbox') restored[opt.id] = false;
        });
        setOptionForm(restored);
        setNot(details.not || '');
    }, [currentNumbered?.photoId]);

    // Price calculation
    const priceResult = useMemo(() => {
        if (isFolderOnly) return { breakdown: [], total: 0 };
        // Dynamic price calculation from selected options
        let total = 0;
        const breakdown = [];

        numberedPhotos.forEach(np => {
            const details = np.optionDetails || {};
            let photoTotal = 0;

            if (details._packageId) {
                const pkg = configPackages.find(p => p.id === details._packageId);
                if (pkg) {
                    photoTotal = pkg.price;
                    breakdown.push({ label: `#${np.number} ${pkg.name}`, price: pkg.price });
                }
            } else {
                configOptions.forEach(opt => {
                    const val = details[opt.id];
                    if (opt.type === 'checkbox' && val) {
                        photoTotal += opt.price;
                    } else if (opt.type === 'number' && val > 0) {
                        photoTotal += opt.price * val;
                    } else if (opt.type === 'select' && val) {
                        photoTotal += opt.price;
                    }
                });
                if (photoTotal > 0) {
                    breakdown.push({ label: `#${np.number}`, price: photoTotal });
                }
            }
            total += photoTotal;
        });

        return { breakdown, total };
    }, [numberedPhotos, configOptions, configPackages, isFolderOnly]);

    // Sync pricing to store
    useMemo(() => {
        updatePricing(priceResult.breakdown, priceResult.total);
    }, [priceResult]);

    // Build selected options summary for file naming & archive
    const buildOptionsSummary = (formValues, pkgId) => {
        if (pkgId) {
            const pkg = configPackages.find(p => p.id === pkgId);
            return pkg ? pkg.abbr || pkg.name : '';
        }

        const parts = [];
        configOptions.forEach(opt => {
            const val = formValues[opt.id];
            if (!val) return;
            if (opt.type === 'checkbox' && val) {
                parts.push(opt.abbr || opt.name);
            } else if (opt.type === 'number' && val > 0) {
                parts.push(`${val}${opt.abbr || opt.name}`);
            } else if (opt.type === 'select' && val) {
                parts.push(`${val}`);
            }
        });
        return parts.join('_');
    };

    const handleAssign = () => {
        if (!currentPhoto) return;

        if (isFolderOnly) {
            if (currentNumbered) {
                updateNumberOptions(currentPhoto.id, [], { not, recordName, description });
            } else {
                assignNumber(currentPhoto.id, [], { not, recordName, description });
            }
            return;
        }

        // Build options array for display
        const options = [];
        const optionDetails = { ...optionForm, not };

        if (selectedPackage) {
            const pkg = configPackages.find(p => p.id === selectedPackage);
            if (pkg) {
                options.push(pkg.abbr || pkg.name);
                optionDetails._packageId = selectedPackage;
                optionDetails._packageName = pkg.name;
                optionDetails._packageAbbr = pkg.abbr;
            }
        } else {
            configOptions.forEach(opt => {
                const val = optionForm[opt.id];
                if (opt.type === 'checkbox' && val) options.push(opt.abbr || opt.name);
                else if (opt.type === 'number' && val > 0) options.push(`${val}${opt.abbr}`);
                else if (opt.type === 'select' && val) options.push(val);
            });
        }

        // Store abbreviation summary for file naming
        optionDetails._summary = buildOptionsSummary(optionForm, selectedPackage);

        if (currentNumbered) {
            updateNumberOptions(currentPhoto.id, options, optionDetails);
        } else {
            assignNumber(currentPhoto.id, options, optionDetails);
        }
    };

    // Favorite photos for quick numbering
    const favoritePhotos = photos.filter(p => favorites.has(p.id));
    const numberedIds = new Set(numberedPhotos.map(np => np.photoId));
    const unnumberedFavorites = favoritePhotos.filter(p => !numberedIds.has(p.id));

    return (
        <>
            <div className="fixed inset-0 z-50 flex">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60" onClick={onClose} />

                {/* Panel - right side */}
                <div className="relative ml-auto w-full max-w-md bg-neutral-800 border-l
                                border-neutral-700 flex flex-col shadow-2xl">
                    {/* Header */}
                    <div className="h-12 flex items-center justify-between px-4
                                    border-b border-neutral-700">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <ListOrdered className="w-4 h-4 text-amber-400" />
                            {isFolderOnly ? 'Numaralandırma' : 'Numaralandırma & Seçenekler'}
                        </h2>
                        <button onClick={onClose}
                            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {/* Current photo */}
                        {currentPhoto && (
                            <div className="flex items-center gap-3 p-2 bg-neutral-900 rounded-lg">
                                {currentPhoto.thumbnailPath && (
                                    <img
                                        src={`file://${currentPhoto.thumbnailPath.replace(/\\/g, '/')}`}
                                        className="w-12 h-12 object-cover rounded"
                                        alt=""
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{currentPhoto.currentName}</p>
                                    <p className="text-xs text-neutral-400">
                                        {selectedIndex + 1} / {photos.length}
                                    </p>
                                </div>
                                {currentNumbered && (
                                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded font-mono">
                                        #{currentNumbered.number}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* ===== FOLDER ONLY MODE ===== */}
                        {isFolderOnly ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-neutral-400 mb-1">Kayıt İsmi</label>
                                    <input
                                        type="text"
                                        value={recordName}
                                        onChange={e => setRecordName(e.target.value)}
                                        placeholder="Kayıt ismi girin..."
                                        className="w-full px-3 py-1.5 text-sm rounded-lg bg-neutral-900
                                                   border border-neutral-700 focus:border-amber-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-neutral-400 mb-1">Açıklama (opsiyonel)</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Açıklama ekleyin..."
                                        rows={3}
                                        className="w-full px-3 py-1.5 text-sm rounded-lg bg-neutral-900
                                                   border border-neutral-700 focus:border-amber-500 outline-none resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-neutral-400 mb-1">Not</label>
                                    <input
                                        type="text"
                                        value={not}
                                        onChange={e => setNot(e.target.value)}
                                        placeholder="Opsiyonel not..."
                                        className="w-full px-3 py-1.5 text-sm rounded-lg bg-neutral-900
                                                   border border-neutral-700 focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>
                        ) : (
                            /* ===== DYNAMIC OPTIONS FROM CONFIG ===== */
                            <div className="space-y-3">
                                {configLoading ? (
                                    <p className="text-xs text-neutral-500 text-center py-4">Seçenekler yükleniyor...</p>
                                ) : configOptions.length === 0 && configPackages.length === 0 ? (
                                    <div className="text-center py-6 space-y-2">
                                        <p className="text-xs text-neutral-500">
                                            Bu çekim türü için Pixonai seçenekleri tanımlanmamış.
                                        </p>
                                        <p className="text-[10px] text-neutral-600">
                                            Ayarlar → Pixonai Ayarları'ndan yapılandırın
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Options title */}
                                        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                            Seçenekler {pixonaiConfig?.shootCategoryLabel && `(${pixonaiConfig.shootCategoryLabel})`}
                                        </h3>

                                        {/* Dynamic options */}
                                        {configOptions.map(opt => (
                                            <DynamicOptionField
                                                key={opt.id}
                                                option={opt}
                                                value={optionForm[opt.id]}
                                                onChange={val => setOptionForm(f => ({ ...f, [opt.id]: val }))}
                                                disabled={!!selectedPackage}
                                            />
                                        ))}

                                        {/* Packages */}
                                        {configPackages.length > 0 && (
                                            <div className="space-y-2">
                                                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Package className="w-3 h-3 text-amber-400" />
                                                    Paketler
                                                </h3>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {configPackages.map(pkg => (
                                                        <button
                                                            key={pkg.id}
                                                            onClick={() => setSelectedPackage(
                                                                selectedPackage === pkg.id ? null : pkg.id
                                                            )}
                                                            className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left
                                                                ${selectedPackage === pkg.id
                                                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                                                    : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:border-neutral-600'
                                                                }`}
                                                        >
                                                            <div className="font-medium">{pkg.name}</div>
                                                            {pkg.description && (
                                                                <div className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">
                                                                    {pkg.description}
                                                                </div>
                                                            )}
                                                            <div className="text-amber-400 font-mono mt-1">
                                                                {pkg.price > 0 ? `${pkg.price} ₺` : 'Ücretsiz'}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Not */}
                                        <div>
                                            <label className="block text-xs text-neutral-400 mb-1">Not</label>
                                            <input
                                                type="text"
                                                value={not}
                                                onChange={e => setNot(e.target.value)}
                                                placeholder="Opsiyonel not..."
                                                className="w-full px-3 py-1.5 text-sm rounded-lg bg-neutral-900
                                                           border border-neutral-700 focus:border-amber-500 outline-none"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Assign button */}
                        <button
                            onClick={handleAssign}
                            disabled={!currentPhoto}
                            className="w-full py-2 bg-amber-500 text-neutral-900 rounded-lg
                                       hover:bg-amber-400 font-medium text-sm transition-colors
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {currentNumbered ? 'Seçenekleri Güncelle' : 'Numaralandır'}
                        </button>

                        {currentNumbered && (
                            <button
                                onClick={() => removeNumber(currentPhoto.id)}
                                className="w-full py-2 border border-red-500/30 text-red-400 rounded-lg
                                           hover:bg-red-500/10 text-sm transition-colors"
                            >
                                Numarayı Kaldır
                            </button>
                        )}

                        {/* Unnumbered favorites list */}
                        {unnumberedFavorites.length > 0 && (
                            <div>
                                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                                    <Star className="w-3 h-3 inline mr-1 text-yellow-400" />
                                    Numaralandırılmamış Favoriler ({unnumberedFavorites.length})
                                </h3>
                                <div className="space-y-1">
                                    {unnumberedFavorites.slice(0, 10).map(photo => (
                                        <div key={photo.id}
                                            className="flex items-center gap-2 px-2 py-1 rounded
                                                       hover:bg-neutral-700/50 cursor-pointer text-xs"
                                            onClick={() => {
                                                const idx = photos.findIndex(p => p.id === photo.id);
                                                if (idx >= 0) usePhotoSelectorStore.getState().setSelectedIndex(idx);
                                            }}
                                        >
                                            {photo.thumbnailPath && (
                                                <img
                                                    src={`file://${photo.thumbnailPath.replace(/\\/g, '/')}`}
                                                    className="w-8 h-8 object-cover rounded"
                                                    alt=""
                                                />
                                            )}
                                            <span className="truncate flex-1 text-neutral-300">{photo.currentName}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Edit order button */}
                        {numberedPhotos.length > 0 && (
                            <button
                                onClick={() => setEditOrderOpen(true)}
                                className="w-full py-2 border border-neutral-600 text-neutral-300 rounded-lg
                                           hover:bg-neutral-700 text-sm transition-colors flex items-center
                                           justify-center gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                Sıralama Düzenle ({numberedPhotos.length})
                            </button>
                        )}

                        {/* Price preview */}
                        {priceResult.breakdown.length > 0 && (
                            <PricePreview
                                breakdown={priceResult.breakdown}
                                total={priceResult.total}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Edit order modal */}
            {editOrderOpen && (
                <EditOrderModal
                    numberedPhotos={numberedPhotos}
                    onReorder={(newOrder) => {
                        usePhotoSelectorStore.getState().reorderNumbered(newOrder);
                        setEditOrderOpen(false);
                    }}
                    onCancel={(photoId) => {
                        usePhotoSelectorStore.getState().cancelPhoto(photoId);
                    }}
                    onClose={() => setEditOrderOpen(false)}
                />
            )}
        </>
    );
}

// ========== DYNAMIC OPTION FIELD ==========
function DynamicOptionField({ option, value, onChange, disabled }) {
    const inputClass = `w-full px-3 py-1.5 text-sm rounded-lg bg-neutral-900
                        border border-neutral-700 focus:border-amber-500 outline-none
                        ${disabled ? 'opacity-40 pointer-events-none' : ''}`;

    if (option.type === 'select') {
        return (
            <div>
                <label className="block text-xs text-neutral-400 mb-1">
                    {option.name}
                    {option.abbr && <span className="ml-1 text-neutral-600 font-mono">({option.abbr})</span>}
                </label>
                <select value={value || ''} onChange={e => onChange(e.target.value)} className={inputClass}>
                    <option value="">Seçiniz</option>
                    {(option.values || []).map(v => (
                        <option key={v} value={v}>{v}</option>
                    ))}
                </select>
            </div>
        );
    }

    if (option.type === 'number') {
        return (
            <div>
                <label className="block text-xs text-neutral-400 mb-1">
                    {option.name}
                    {option.abbr && <span className="ml-1 text-neutral-600 font-mono">({option.abbr})</span>}
                    {option.price > 0 && <span className="ml-1 text-amber-500/60">{option.price}₺/adet</span>}
                </label>
                <input
                    type="number"
                    min={option.min ?? 0}
                    max={option.max ?? 50}
                    value={value ?? 0}
                    onChange={e => onChange(parseInt(e.target.value) || 0)}
                    className={inputClass}
                    disabled={disabled}
                />
            </div>
        );
    }

    if (option.type === 'checkbox') {
        return (
            <label className={`flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <input
                    type="checkbox"
                    checked={!!value}
                    onChange={e => onChange(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-600 bg-neutral-900
                               text-amber-500 focus:ring-amber-500"
                    disabled={disabled}
                />
                <span className="text-xs text-neutral-300">
                    {option.name}
                    {option.abbr && <span className="ml-1 text-neutral-600 font-mono">({option.abbr})</span>}
                    {option.price > 0 && <span className="ml-1 text-amber-500/60">+{option.price}₺</span>}
                </span>
            </label>
        );
    }

    return null;
}
