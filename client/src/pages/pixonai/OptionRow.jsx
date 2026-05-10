import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, ChevronDown, ChevronUp, Trash2, List, Hash, CheckSquare } from 'lucide-react';

export default function OptionRow({ option, index, onChange, onRemove }) {
    const { t } = useTranslation();

    const OPTION_TYPES = [
        { value: 'select', label: t('pixonai.typeDropdown'), icon: List },
        { value: 'number', label: t('pixonai.typeNumber'), icon: Hash },
        { value: 'checkbox', label: t('pixonai.typeCheckbox'), icon: CheckSquare },
    ];
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                <span className="text-xs text-neutral-400 w-5">{index + 1}.</span>

                <input
                    type="text"
                    value={option.name}
                    onChange={e => onChange({ ...option, name: e.target.value })}
                    placeholder={t('pixonai.optionName')}
                    className="flex-1 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700
                               rounded focus:border-blue-500 outline-none"
                />

                <input
                    type="text"
                    value={option.abbr}
                    onChange={e => onChange({ ...option, abbr: e.target.value })}
                    placeholder={t('pixonai.abbreviation')}
                    className="w-16 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700
                               rounded focus:border-blue-500 outline-none text-center font-mono"
                />

                <input
                    type="number"
                    value={option.price}
                    onChange={e => onChange({ ...option, price: Number(e.target.value) || 0 })}
                    placeholder="₺"
                    className="w-20 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700
                               rounded focus:border-blue-500 outline-none text-right"
                />
                <span className="text-xs text-neutral-500">₺</span>

                <input
                    type="number"
                    value={option.maxSelections ?? 0}
                    onChange={e => onChange({ ...option, maxSelections: Math.max(0, Number(e.target.value) || 0) })}
                    placeholder={t('pixonai.maxSelect').split(' ')[0]}
                    min="0"
                    className="w-14 px-1.5 py-1 text-sm bg-neutral-900 border border-neutral-700
                               rounded focus:border-blue-500 outline-none text-center"
                    title={t('pixonai.maxSelect')}
                />

                <button onClick={() => setExpanded(!expanded)}
                    className="p-1 hover:bg-neutral-700 rounded transition-colors">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <button onClick={onRemove}
                    className="p-1 hover:bg-red-900/50 rounded transition-colors text-red-400">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-neutral-700/50 space-y-2">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-neutral-400 w-16">{t('pages.customers.customerType').split(' ')[0]}:</label>
                        <select
                            value={option.type}
                            onChange={e => onChange({ ...option, type: e.target.value })}
                            className="flex-1 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700
                                       rounded focus:border-blue-500 outline-none"
                        >
                            {OPTION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {option.type === 'select' && (
                        <div className="flex items-start gap-2">
                            <label className="text-xs text-neutral-400 w-16 mt-1">{t('pixonai.values').replace(':', '')}</label>
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={(option.values || []).join(', ')}
                                    onChange={e => onChange({
                                        ...option,
                                        values: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                                    })}
                                    placeholder={t('pixonai.valueSeparator')}
                                    className="w-full px-2 py-1 text-sm bg-neutral-900 border border-neutral-700
                                               rounded focus:border-blue-500 outline-none"
                                />
                                <p className="text-[10px] text-neutral-500 mt-0.5">{t('pixonai.valueSeparatorHint')}</p>
                            </div>
                        </div>
                    )}

                    {option.type === 'number' && (
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-neutral-400 w-16">{t('pixonai.range').replace(':', '')}</label>
                            <input
                                type="number"
                                value={option.min ?? 0}
                                onChange={e => onChange({ ...option, min: Number(e.target.value) })}
                                className="w-20 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 rounded outline-none"
                                placeholder="Min"
                            />
                            <span className="text-xs text-neutral-500">—</span>
                            <input
                                type="number"
                                value={option.max ?? 50}
                                onChange={e => onChange({ ...option, max: Number(e.target.value) })}
                                className="w-20 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 rounded outline-none"
                                placeholder="Max"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
