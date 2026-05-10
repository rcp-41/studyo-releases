import { Gift, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function GiftRow({ gift, index, onChange, onRemove }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-900/50 rounded-lg border border-neutral-700/50">
            <Gift className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            <span className="text-[10px] text-neutral-500 w-4">{index + 1}.</span>

            <input
                type="text"
                value={gift.name}
                onChange={e => onChange({ ...gift, name: e.target.value })}
                placeholder={t('pixonai.giftName')}
                className="flex-1 px-2 py-0.5 text-xs bg-neutral-800 border border-neutral-700
                           rounded focus:border-green-500 outline-none"
            />

            <input
                type="text"
                value={gift.abbr}
                onChange={e => onChange({ ...gift, abbr: e.target.value })}
                placeholder={t('pixonai.short')}
                className="w-14 px-1.5 py-0.5 text-xs bg-neutral-800 border border-neutral-700
                           rounded focus:border-green-500 outline-none text-center font-mono"
            />

            <div className="flex items-center gap-1">
                <label className="text-[10px] text-neutral-500">{t('components.templateEditor.variables')}:</label>
                <input
                    type="number"
                    value={gift.quantity}
                    onChange={e => onChange({ ...gift, quantity: Number(e.target.value) || 1 })}
                    min="1"
                    className="w-10 px-1 py-0.5 text-xs bg-neutral-800 border border-neutral-700
                               rounded focus:border-green-500 outline-none text-center"
                />
            </div>

            <div className="flex items-center gap-1">
                <label className="text-[10px] text-neutral-500">{t('pixonai.maxSelect').split(' ')[0]}:</label>
                <input
                    type="number"
                    value={gift.maxSelections}
                    onChange={e => onChange({ ...gift, maxSelections: Number(e.target.value) || 0 })}
                    min="0"
                    className="w-10 px-1 py-0.5 text-xs bg-neutral-800 border border-neutral-700
                               rounded focus:border-green-500 outline-none text-center"
                    title={t('pixonai.unlimitedDesc')}
                />
            </div>

            <button onClick={onRemove}
                className="p-0.5 hover:bg-red-900/50 rounded transition-colors text-red-400/50 hover:text-red-400">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
