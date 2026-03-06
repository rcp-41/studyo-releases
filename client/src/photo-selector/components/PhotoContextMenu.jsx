/**
 * PhotoContextMenu — Right-click context menu for gift assignment and numbering
 * Shows dynamic options based on active package gifts
 */
import { useEffect, useRef } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import { Gift, Hash, Minus, Star, Copy } from 'lucide-react';

export default function PhotoContextMenu({ x, y, photoId, onClose }) {
    const menuRef = useRef(null);
    const activePackage = usePhotoSelectorStore(s => s.activePackage);
    const giftAssignments = usePhotoSelectorStore(s => s.giftAssignments);
    const numberedPhotos = usePhotoSelectorStore(s => s.numberedPhotos);
    const assignGift = usePhotoSelectorStore(s => s.assignGift);
    const removeGift = usePhotoSelectorStore(s => s.removeGift);
    const assignNumber = usePhotoSelectorStore(s => s.assignNumber);
    const removeNumber = usePhotoSelectorStore(s => s.removeNumber);
    const nextOrderNumber = usePhotoSelectorStore(s => s.nextOrderNumber);
    const shootCategoryType = usePhotoSelectorStore(s => s.shootCategoryType);
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const toggleFavorite = usePhotoSelectorStore(s => s.toggleFavorite);

    const isNumbered = numberedPhotos.some(np => np.photoId === photoId && !np.isCancelled);
    const isFavorite = favorites.has(photoId);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    // Position adjustment to stay within viewport
    useEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (rect.right > vw) {
            menuRef.current.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > vh) {
            menuRef.current.style.top = `${y - rect.height}px`;
        }
    }, [x, y]);

    const handleFavorite = () => {
        toggleFavorite(photoId);
        onClose();
    };

    const handleNumberToggle = () => {
        if (isNumbered) {
            removeNumber(photoId);
        } else {
            assignNumber(photoId);
        }
        onClose();
    };

    const handleGiftToggle = (giftAbbr) => {
        const assigned = giftAssignments[giftAbbr] || [];
        if (assigned.includes(photoId)) {
            removeGift(photoId, giftAbbr);
        } else {
            assignGift(photoId, giftAbbr);
        }
        onClose();
    };

    const isPacketless = shootCategoryType === 'none' || !shootCategoryType;

    return (
        <div
            ref={menuRef}
            className="ps-context-menu"
            style={{ left: x, top: y }}
        >
            {/* Favorite Toggle */}
            <button
                className={`ps-context-item ${isFavorite ? 'active' : ''}`}
                onClick={handleFavorite}
            >
                <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span>{isFavorite ? 'Favoriden Çıkar' : 'Favoriye Ekle'}</span>
            </button>

            <div className="ps-context-separator" />

            {/* Number Toggle */}
            <button
                className={`ps-context-item ${isNumbered ? 'active' : ''}`}
                onClick={handleNumberToggle}
            >
                {isNumbered ? (
                    <>
                        <Minus className="w-3.5 h-3.5 text-red-400" />
                        <span>Numarayı Kaldır</span>
                    </>
                ) : (
                    <>
                        <Hash className="w-3.5 h-3.5 text-green-400" />
                        <span>Numaralandır ({String(nextOrderNumber).padStart(2, '0')})</span>
                    </>
                )}
            </button>

            {/* Package Gifts */}
            {!isPacketless && activePackage?.gifts?.length > 0 && (
                <>
                    <div className="ps-context-separator" />
                    <div className="ps-context-label">
                        <Gift className="w-3 h-3" /> Hediyeler
                    </div>
                    {activePackage.gifts.map(gift => {
                        const assigned = giftAssignments[gift.abbr] || [];
                        const isAssigned = assigned.includes(photoId);
                        const isFull = assigned.length >= gift.maxSelections && !isAssigned;

                        return (
                            <button
                                key={gift.abbr}
                                className={`ps-context-item ${isAssigned ? 'active' : ''} ${isFull ? 'disabled' : ''}`}
                                onClick={() => handleGiftToggle(gift.abbr)}
                                disabled={isFull}
                            >
                                <span className={`ps-context-check ${isAssigned ? 'checked' : ''}`}>
                                    {isAssigned ? '✓' : '○'}
                                </span>
                                <span className="flex-1">{gift.name}</span>
                                <span className="ps-context-gift-code">[{gift.abbr}]</span>
                                <span className="text-[10px] text-neutral-500 ml-1">
                                    {assigned.length}/{gift.maxSelections}
                                </span>
                            </button>
                        );
                    })}
                </>
            )}
        </div>
    );
}
