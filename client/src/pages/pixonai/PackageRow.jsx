import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Hash, Gift, ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import GiftRow from './GiftRow';

export default function PackageRow({ pkg, index, onChange, onRemove }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    const addGift = () => {
        const gifts = [...(pkg.gifts || []), {
            id: `gift_${Date.now()}`,
            name: '',
            abbr: '',
            quantity: 1,
            maxSelections: 0,
        }];
        onChange({ ...pkg, gifts });
    };

    const updateGift = (idx, updated) => {
        const gifts = (pkg.gifts || []).map((g, i) => i === idx ? updated : g);
        onChange({ ...pkg, gifts });
    };

    const removeGift = (idx) => {
        const gifts = (pkg.gifts || []).filter((_, i) => i !== idx);
        onChange({ ...pkg, gifts });
    };

    const giftCount = (pkg.gifts || []).length;

    return (
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
                <Package className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-xs text-neutral-400 w-5">{index + 1}.</span>

                <input
                    type="text"
                    value={pkg.name}
                    onChange={e => onChange({ ...pkg, name: e.target.value })}
                    placeholder={t('pixonai.packageName')}
                    className="flex-1 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700
                               rounded focus:border-blue-500 outline-none"
                />

                <input
                    type="text"
                    value={pkg.abbr}
                    onChange={e => onChange({ ...pkg, abbr: e.target.value })}
                    placeholder={t('pixonai.packageShort')}
                    className="w-16 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700
                               rounded focus:border-blue-500 outline-none text-center font-mono"
                />

                <div className="flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-neutral-500" />
                    <input
                        type="number"
                        value={pkg.photoCount || ''}
                        onChange={e => onChange({ ...pkg, photoCount: Number(e.target.value) || 0 })}
                        placeholder={t('pixonai.photoCount').split(' ')[0]}
                        min="0"
                        className="w-12 px-1.5 py-1 text-sm bg-neutral-900 border border-neutral-700
                                   rounded focus:border-blue-500 outline-none text-center"
                        title={t('pixonai.photoCount')}
                    />
                </div>

                <input
                    type="number"
                    value={pkg.price}
                    onChange={e => onChange({ ...pkg, price: Number(e.target.value) || 0 })}
                    placeholder="₺"
                    className="w-20 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700
                               rounded focus:border-blue-500 outline-none text-right"
                />
                <span className="text-xs text-neutral-500">₺</span>

                <button onClick={() => setExpanded(!expanded)}
                    className={cn(
                        "p-1 rounded transition-colors flex items-center gap-0.5",
                        expanded ? "bg-green-500/20 text-green-400" : "hover:bg-neutral-700"
                    )}>
                    <Gift className="w-3.5 h-3.5" />
                    {giftCount > 0 && <span className="text-[10px]">{giftCount}</span>}
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <button onClick={onRemove}
                    className="p-1 hover:bg-red-900/50 rounded transition-colors text-red-400">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <div className="px-3 pb-2">
                <input
                    type="text"
                    value={pkg.description}
                    onChange={e => onChange({ ...pkg, description: e.target.value })}
                    placeholder={t('pixonai.packageDesc')}
                    className="w-full px-2 py-1 text-sm bg-neutral-900 border border-neutral-700
                               rounded focus:border-blue-500 outline-none text-neutral-300"
                />
            </div>

            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-neutral-700/50">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-medium text-green-400 flex items-center gap-1">
                            <Gift className="w-3.5 h-3.5" />
                            {t('pixonai.giftName').split(' ')[0]}s
                        </h4>
                        <button onClick={addGift}
                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-green-600/30
                                       hover:bg-green-600/50 text-green-300 rounded transition-colors">
                            <Plus className="w-3 h-3" /> {t('common.add')} {t('pixonai.giftName').toLowerCase()}
                        </button>
                    </div>

                    {giftCount === 0 ? (
                        <p className="text-[10px] text-neutral-500 italic text-center py-2">
                            {t('pixonai.giftName').split(' ')[0]} {t('common.add')}ilmedi
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 px-2 text-[9px] text-neutral-500 uppercase tracking-wider">
                                <span className="w-3.5" />
                                <span className="w-4" />
                                <span className="flex-1">{t('common.search')}</span>
                                <span className="w-14 text-center">{t('pixonai.short')}</span>
                                <span className="w-16 text-center">{t('components.templateEditor.variables')}</span>
                                <span className="w-16 text-center">{t('pixonai.maxSelect').split('(')[0].trim()}</span>
                                <span className="w-3.5" />
                            </div>
                            {(pkg.gifts || []).map((gift, idx) => (
                                <GiftRow
                                    key={gift.id || idx}
                                    gift={gift}
                                    index={idx}
                                    onChange={u => updateGift(idx, u)}
                                    onRemove={() => removeGift(idx)}
                                />
                            ))}
                        </div>
                    )}

                    <p className="text-[9px] text-neutral-600 mt-2">
                        {t('pixonai.unlimitedDesc')}
                    </p>
                </div>
            )}
        </div>
    );
}
