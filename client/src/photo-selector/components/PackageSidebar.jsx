/**
 * PackageSidebar — Right sidebar showing package info, gifts, and numbered photos
 * Visible when in favorites mode and there's an active pixonai config
 */
import { useMemo, useEffect } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import { Package, Gift, Hash, Save, X, Image, Tag } from 'lucide-react';

export default function PackageSidebar({ onSaveNumbering }) {
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const photos = usePhotoSelectorStore(s => s.photos);
    const pixonaiConfig = usePhotoSelectorStore(s => s.pixonaiConfig);
    const activePackage = usePhotoSelectorStore(s => s.activePackage);
    const giftAssignments = usePhotoSelectorStore(s => s.giftAssignments);
    const numberedPhotos = usePhotoSelectorStore(s => s.numberedPhotos);
    const shootCategoryType = usePhotoSelectorStore(s => s.shootCategoryType);
    const setActivePackage = usePhotoSelectorStore(s => s.setActivePackage);

    const favCount = favorites.size;

    // Auto-match package based on favorite count
    useEffect(() => {
        if (!pixonaiConfig || !pixonaiConfig.packages?.length) {
            if (activePackage) setActivePackage(null);
            return;
        }

        // Find package whose photoCount matches favCount
        const matched = pixonaiConfig.packages.find(p => p.photoCount === favCount);
        if (matched && matched.id !== activePackage?.id) {
            setActivePackage(matched);
        } else if (!matched && activePackage) {
            // No matching package — find closest or clear
            setActivePackage(null);
        }
    }, [favCount, pixonaiConfig]);

    // Build numbered photos display list
    const numberedList = useMemo(() => {
        return numberedPhotos
            .filter(np => !np.isCancelled)
            .sort((a, b) => a.orderNumber - b.orderNumber)
            .map(np => {
                const photo = photos.find(p => p.id === np.photoId);
                // Build shortcode string from gift assignments
                const giftCodes = [];
                if (activePackage?.gifts) {
                    activePackage.gifts.forEach(gift => {
                        const assigned = giftAssignments[gift.abbr] || [];
                        if (assigned.includes(np.photoId)) {
                            giftCodes.push(gift.abbr);
                        }
                    });
                }
                return {
                    ...np,
                    photo,
                    giftCodes,
                    displayName: `${String(np.orderNumber).padStart(2, '0')}${giftCodes.length ? ' - ' + giftCodes.join(' - ') : ''}`,
                };
            });
    }, [numberedPhotos, photos, giftAssignments, activePackage]);

    const isPacketless = shootCategoryType === 'none' || !shootCategoryType;

    return (
        <div className="ps-sidebar">
            {/* Header */}
            <div className="ps-sidebar-header">
                <Package className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-sm">
                    {isPacketless ? 'Numaralandırma' : 'Paket & Numaralandırma'}
                </span>
            </div>

            {/* Package Info */}
            {!isPacketless && (
                <div className="ps-sidebar-section">
                    {activePackage ? (
                        <>
                            <div className="ps-sidebar-pkg-badge">
                                <Tag className="w-3.5 h-3.5" />
                                <span>{activePackage.name}</span>
                                <span className="ps-sidebar-price">
                                    {activePackage.price?.toLocaleString('tr-TR')}₺
                                </span>
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">
                                {activePackage.description}
                            </p>

                            {/* Gift List */}
                            {activePackage.gifts?.length > 0 && (
                                <div className="ps-sidebar-gifts">
                                    <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Gift className="w-3 h-3" /> Hediyeler
                                    </h4>
                                    {activePackage.gifts.map(gift => {
                                        const assigned = giftAssignments[gift.abbr] || [];
                                        const isComplete = assigned.length >= gift.maxSelections;

                                        return (
                                            <div key={gift.abbr} className={`ps-sidebar-gift-row ${isComplete ? 'complete' : ''}`}>
                                                <span className={`ps-sidebar-gift-check ${isComplete ? 'checked' : ''}`}>
                                                    {isComplete ? '✓' : '○'}
                                                </span>
                                                <span className="flex-1 text-xs">
                                                    {gift.name}
                                                </span>
                                                <span className="ps-sidebar-gift-code">[{gift.abbr}]</span>
                                                <span className="text-[10px] text-neutral-500">
                                                    {assigned.length}/{gift.maxSelections}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-xs text-neutral-500 text-center py-3">
                            {favCount > 0 ? (
                                <>
                                    <span className="text-amber-400 font-semibold">{favCount}</span> favoriniz var
                                    {pixonaiConfig?.packages?.length > 0 && (
                                        <p className="mt-1 text-neutral-600">
                                            Eşleşen paket bulunamadı
                                        </p>
                                    )}
                                </>
                            ) : (
                                'Fotoğrafları favoriye ekleyin'
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Numbered Photos List */}
            <div className="ps-sidebar-section flex-1 overflow-hidden flex flex-col">
                <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 shrink-0">
                    <Hash className="w-3 h-3" />
                    Numaralandırılan ({numberedList.length})
                </h4>
                <div className="flex-1 overflow-y-auto space-y-1">
                    {numberedList.length === 0 ? (
                        <p className="text-xs text-neutral-600 text-center py-4">
                            Henüz numara verilmedi
                        </p>
                    ) : (
                        numberedList.map(item => {
                            const thumbSrc = item.photo?.thumbnailPath
                                ? `file:///${item.photo.thumbnailPath.replace(/\\/g, '/')}`
                                : null;
                            return (
                                <div key={item.photoId} className="ps-sidebar-numbered-row">
                                    {thumbSrc ? (
                                        <img src={thumbSrc} className="w-8 h-8 rounded object-cover shrink-0" alt="" />
                                    ) : (
                                        <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center shrink-0">
                                            <Image className="w-3.5 h-3.5 text-neutral-600" />
                                        </div>
                                    )}
                                    <span className="ps-sidebar-numbered-name">
                                        {item.displayName}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Save Button */}
            {numberedList.length > 0 && (
                <div className="ps-sidebar-footer">
                    <button
                        className="ps-sidebar-save-btn"
                        onClick={onSaveNumbering}
                    >
                        <Save className="w-4 h-4" />
                        Numaralandırmayı Kaydet
                    </button>
                </div>
            )}
        </div>
    );
}
