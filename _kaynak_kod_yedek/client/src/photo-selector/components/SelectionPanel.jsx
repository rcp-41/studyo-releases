import { useState, useMemo } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import PricePreview from './PricePreview';
import EditOrderModal from './EditOrderModal';
import { calculatePrices, generateAutoDescription } from '../utils/priceCalculator';
import { X, ListOrdered, Settings, Star } from 'lucide-react';

const OLCU_OPTIONS = ['6x9', '10x15', '13x18', '15x21', '18x24', '20x25', '20x30', '30x40', '50x70'];
const VESIKALIK_KULLANIM = ['Pasaport', 'Vize', 'İş', 'Askeri', 'Özel'];

export default function SelectionPanel({ onClose }) {
    const photos = usePhotoSelectorStore(s => s.getFilteredPhotos());
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const selectedIndex = usePhotoSelectorStore(s => s.selectedIndex);
    const numberedPhotos = usePhotoSelectorStore(s => s.numberedPhotos);
    const assignNumber = usePhotoSelectorStore(s => s.assignNumber);
    const updateNumberOptions = usePhotoSelectorStore(s => s.updateNumberOptions);
    const removeNumber = usePhotoSelectorStore(s => s.removeNumber);
    const priceList = usePhotoSelectorStore(s => s.priceList);
    const updatePricing = usePhotoSelectorStore(s => s.updatePricing);
    const archiveInfo = usePhotoSelectorStore(s => s.archiveInfo);

    const [editOrderOpen, setEditOrderOpen] = useState(false);
    const [selectedPhotoId, setSelectedPhotoId] = useState(null);

    const shootCategory = archiveInfo?.shootCategory || 'vesikalik_biyometrik';

    // Current photo for numbering
    const currentPhoto = photos[selectedIndex] || null;
    const currentNumbered = currentPhoto
        ? numberedPhotos.find(np => np.photoId === currentPhoto.id)
        : null;

    // Option form state
    const [optionForm, setOptionForm] = useState({
        tur: '',
        kullanilarakYer: '',
        olcu: '15x21',
        ekOlcu: 'yok',
        adet: '4',
        cogaltmaAdet: 0,
        cogaltmaOlcu: '15x21',
        hediye: false,
        cerceve: false,
        fotoblok: false,
        kanvas: false,
        not: '',
        manuelFiyat: 0,
    });

    // Price calculation
    const priceResult = useMemo(() => {
        return calculatePrices(numberedPhotos, priceList, shootCategory);
    }, [numberedPhotos, priceList, shootCategory]);

    // Sync pricing to store
    useMemo(() => {
        updatePricing(priceResult.breakdown, priceResult.total);
    }, [priceResult]);

    const handleAssign = () => {
        if (!currentPhoto) return;

        const options = [];
        if (optionForm.tur) options.push(optionForm.tur);
        if (optionForm.olcu && optionForm.olcu !== 'yok') options.push(optionForm.olcu);
        if (optionForm.cerceve) options.push('cerceve');
        if (optionForm.fotoblok) options.push('fotoblok');
        if (optionForm.kanvas) options.push('kanvas');

        if (currentNumbered) {
            updateNumberOptions(currentPhoto.id, options, { ...optionForm });
        } else {
            assignNumber(currentPhoto.id, options, { ...optionForm });
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
                            Numaralandırma & Seçenekler
                        </h2>
                        <button onClick={onClose}
                            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto ps-scrollbar p-4 space-y-4">
                        {/* Current photo info */}
                        {currentPhoto && (
                            <div className="bg-neutral-900 rounded-lg p-3 border border-neutral-700">
                                <div className="flex items-center gap-3">
                                    {currentPhoto.thumbnailPath && (
                                        <img
                                            src={`file:///${currentPhoto.thumbnailPath.replace(/\\/g, '/')}`}
                                            className="w-16 h-16 object-cover rounded"
                                            alt=""
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {currentPhoto.currentName}
                                        </p>
                                        <p className="text-xs text-neutral-500">
                                            {selectedIndex + 1} / {photos.length}
                                        </p>
                                        {currentNumbered && (
                                            <p className="text-xs text-amber-400 mt-1">
                                                #{currentNumbered.orderNumber} numaralı
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Category-specific options */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                Seçenekler ({shootCategory.replace(/_/g, ' ')})
                            </h3>

                            {/* Tür - varies by category */}
                            {shootCategory === 'yillik' && (
                                <SelectField
                                    label="Tür"
                                    value={optionForm.tur}
                                    onChange={v => setOptionForm(f => ({ ...f, tur: v }))}
                                    options={['Yıllık', 'Vesikalık', 'Biyometrik', 'Dijital']}
                                />
                            )}

                            {shootCategory === 'vesikalik_biyometrik' && (
                                <>
                                    <SelectField
                                        label="Kullanılacak Yer"
                                        value={optionForm.kullanilarakYer}
                                        onChange={v => setOptionForm(f => ({ ...f, kullanilarakYer: v }))}
                                        options={VESIKALIK_KULLANIM}
                                    />
                                    <SelectField
                                        label="Adet"
                                        value={optionForm.adet}
                                        onChange={v => setOptionForm(f => ({ ...f, adet: v }))}
                                        options={['4', '6', '8', '12']}
                                    />
                                </>
                            )}

                            {/* Ölçü - common */}
                            {shootCategory !== 'vesikalik_biyometrik' && (
                                <SelectField
                                    label="Ölçü"
                                    value={optionForm.olcu}
                                    onChange={v => setOptionForm(f => ({ ...f, olcu: v }))}
                                    options={OLCU_OPTIONS}
                                />
                            )}

                            {/* Ek Ölçü */}
                            <SelectField
                                label="Ek Ölçü"
                                value={optionForm.ekOlcu}
                                onChange={v => setOptionForm(f => ({ ...f, ekOlcu: v }))}
                                options={['yok', ...OLCU_OPTIONS]}
                            />

                            {/* Çoğaltma */}
                            <div>
                                <label className="block text-xs text-neutral-400 mb-1">Çoğaltma Adet</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    value={optionForm.cogaltmaAdet}
                                    onChange={e => setOptionForm(f => ({ ...f, cogaltmaAdet: parseInt(e.target.value) || 0 }))}
                                    className="w-full px-3 py-1.5 text-sm rounded-lg bg-neutral-900
                                               border border-neutral-700 focus:border-amber-500 outline-none"
                                />
                            </div>

                            {/* Hediye - only yillik */}
                            {shootCategory === 'yillik' && (
                                <CheckboxField
                                    label="Hediye"
                                    checked={optionForm.hediye}
                                    onChange={v => setOptionForm(f => ({ ...f, hediye: v }))}
                                />
                            )}

                            {/* Çerçeve / Fotoblok / Kanvas */}
                            <div className="flex gap-3">
                                <CheckboxField
                                    label="Çerçeve"
                                    checked={optionForm.cerceve}
                                    onChange={v => setOptionForm(f => ({ ...f, cerceve: v }))}
                                />
                                <CheckboxField
                                    label="Fotoblok"
                                    checked={optionForm.fotoblok}
                                    onChange={v => setOptionForm(f => ({ ...f, fotoblok: v }))}
                                />
                                <CheckboxField
                                    label="Kanvas"
                                    checked={optionForm.kanvas}
                                    onChange={v => setOptionForm(f => ({ ...f, kanvas: v }))}
                                />
                            </div>

                            {/* Manuel fiyat - etkinlik */}
                            {shootCategory === 'etkinlik' && (
                                <div>
                                    <label className="block text-xs text-neutral-400 mb-1">Manuel Fiyat</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={optionForm.manuelFiyat}
                                        onChange={e => setOptionForm(f => ({ ...f, manuelFiyat: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-3 py-1.5 text-sm rounded-lg bg-neutral-900
                                                   border border-neutral-700 focus:border-amber-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Not */}
                            <div>
                                <label className="block text-xs text-neutral-400 mb-1">Not</label>
                                <input
                                    type="text"
                                    value={optionForm.not}
                                    onChange={e => setOptionForm(f => ({ ...f, not: e.target.value }))}
                                    placeholder="Opsiyonel not..."
                                    className="w-full px-3 py-1.5 text-sm rounded-lg bg-neutral-900
                                               border border-neutral-700 focus:border-amber-500 outline-none"
                                />
                            </div>
                        </div>

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

function SelectField({ label, value, onChange, options }) {
    return (
        <div>
            <label className="block text-xs text-neutral-400 mb-1">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-neutral-900
                           border border-neutral-700 focus:border-amber-500 outline-none"
            >
                <option value="">Seçiniz</option>
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function CheckboxField({ label, checked, onChange }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-900
                           text-amber-500 focus:ring-amber-500"
            />
            <span className="text-xs text-neutral-300">{label}</span>
        </label>
    );
}
