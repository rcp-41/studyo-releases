import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pixonaiApi, optionsApi } from '../services/api';
import { cn } from '../lib/utils';
import {
    Camera, Plus, Trash2, Edit3, Save, X, Package, GripVertical,
    ChevronDown, ChevronUp, Settings2, List, Hash, CheckSquare, Type
} from 'lucide-react';
import toast from 'react-hot-toast';

// Option type definitions
const OPTION_TYPES = [
    { value: 'select', label: 'Dropdown (Seçim Listesi)', icon: List },
    { value: 'number', label: 'Sayı Girişi', icon: Hash },
    { value: 'checkbox', label: 'Checkbox (Evet/Hayır)', icon: CheckSquare },
];

// ========== OPTION ROW ==========
function OptionRow({ option, index, onChange, onRemove }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                <span className="text-xs text-neutral-400 w-5">{index + 1}.</span>

                <input
                    type="text"
                    value={option.name}
                    onChange={e => onChange({ ...option, name: e.target.value })}
                    placeholder="Seçenek adı"
                    className="flex-1 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 
                               rounded focus:border-blue-500 outline-none"
                />

                <input
                    type="text"
                    value={option.abbr}
                    onChange={e => onChange({ ...option, abbr: e.target.value })}
                    placeholder="Kısaltma"
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

                <button onClick={() => setExpanded(!expanded)}
                    className="p-1 hover:bg-neutral-700 rounded transition-colors">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <button onClick={onRemove}
                    className="p-1 hover:bg-red-900/50 rounded transition-colors text-red-400">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-neutral-700/50 space-y-2">
                    {/* Type */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-neutral-400 w-16">Tip:</label>
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

                    {/* Values for select type */}
                    {option.type === 'select' && (
                        <div className="flex items-start gap-2">
                            <label className="text-xs text-neutral-400 w-16 mt-1">Değerler:</label>
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={(option.values || []).join(', ')}
                                    onChange={e => onChange({
                                        ...option,
                                        values: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                                    })}
                                    placeholder="Virgülle ayır: Yıllık, Vesikalık, Dijital"
                                    className="w-full px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 
                                               rounded focus:border-blue-500 outline-none"
                                />
                                <p className="text-[10px] text-neutral-500 mt-0.5">Virgülle ayırarak değerleri girin</p>
                            </div>
                        </div>
                    )}

                    {/* Min/Max for number type */}
                    {option.type === 'number' && (
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-neutral-400 w-16">Aralık:</label>
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

// ========== PACKAGE ROW ==========
function PackageRow({ pkg, index, onChange, onRemove }) {
    return (
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2 space-y-2">
            <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-xs text-neutral-400 w-5">{index + 1}.</span>

                <input
                    type="text"
                    value={pkg.name}
                    onChange={e => onChange({ ...pkg, name: e.target.value })}
                    placeholder="Paket adı"
                    className="flex-1 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 
                               rounded focus:border-blue-500 outline-none"
                />

                <input
                    type="text"
                    value={pkg.abbr}
                    onChange={e => onChange({ ...pkg, abbr: e.target.value })}
                    placeholder="Kısalt."
                    className="w-16 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 
                               rounded focus:border-blue-500 outline-none text-center font-mono"
                />

                <input
                    type="number"
                    value={pkg.price}
                    onChange={e => onChange({ ...pkg, price: Number(e.target.value) || 0 })}
                    placeholder="₺"
                    className="w-20 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 
                               rounded focus:border-blue-500 outline-none text-right"
                />
                <span className="text-xs text-neutral-500">₺</span>

                <button onClick={onRemove}
                    className="p-1 hover:bg-red-900/50 rounded transition-colors text-red-400">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <input
                type="text"
                value={pkg.description}
                onChange={e => onChange({ ...pkg, description: e.target.value })}
                placeholder="Paket açıklaması (örn: 3 poz 15x21 + 1 adet 6'lı vesikalık)"
                className="w-full px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 
                           rounded focus:border-blue-500 outline-none text-neutral-300"
            />
        </div>
    );
}

// ========== CONFIG EDIT MODAL ==========
function ConfigEditModal({ config, shootTypes, onSave, onClose, saving }) {
    const isNew = !config?.id;

    const [form, setForm] = useState({
        shootCategoryId: config?.shootCategoryId || '',
        shootCategoryLabel: config?.shootCategoryLabel || '',
        options: config?.options || [],
        packages: config?.packages || [],
    });

    // Auto-set label when category is selected
    const handleCategoryChange = (categoryId) => {
        const st = shootTypes?.find(s => s.id === categoryId || s.name === categoryId);
        setForm(f => ({
            ...f,
            shootCategoryId: categoryId,
            shootCategoryLabel: st?.name || categoryId,
        }));
    };

    const addOption = () => {
        setForm(f => ({
            ...f,
            options: [...f.options, {
                id: `opt_${Date.now()}`,
                name: '',
                abbr: '',
                price: 0,
                type: 'select',
                values: [],
                min: 0,
                max: 50,
            }]
        }));
    };

    const updateOption = (idx, updated) => {
        setForm(f => ({
            ...f,
            options: f.options.map((o, i) => i === idx ? updated : o)
        }));
    };

    const removeOption = (idx) => {
        setForm(f => ({
            ...f,
            options: f.options.filter((_, i) => i !== idx)
        }));
    };

    const addPackage = () => {
        setForm(f => ({
            ...f,
            packages: [...f.packages, {
                id: `pkg_${Date.now()}`,
                name: '',
                abbr: '',
                price: 0,
                description: '',
            }]
        }));
    };

    const updatePackage = (idx, updated) => {
        setForm(f => ({
            ...f,
            packages: f.packages.map((p, i) => i === idx ? updated : p)
        }));
    };

    const removePackage = (idx) => {
        setForm(f => ({
            ...f,
            packages: f.packages.filter((_, i) => i !== idx)
        }));
    };

    const handleSubmit = () => {
        if (!form.shootCategoryId) {
            toast.error('Lütfen bir çekim türü seçin');
            return;
        }
        if (form.options.length === 0 && form.packages.length === 0) {
            toast.error('En az bir seçenek veya paket ekleyin');
            return;
        }
        onSave({
            ...(config?.id ? { id: config.id } : {}),
            ...form,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl 
                            w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl mx-4">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                        <Camera className="w-5 h-5 text-blue-400" />
                        {isNew ? 'Yeni Pixonai Yapılandırması' : `${form.shootCategoryLabel} Düzenle`}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-neutral-700 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                    {/* Category Selection */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1">Çekim Türü</label>
                        {isNew ? (
                            <select
                                value={form.shootCategoryId}
                                onChange={e => handleCategoryChange(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 
                                           rounded-lg focus:border-blue-500 outline-none"
                            >
                                <option value="">Seçiniz...</option>
                                {shootTypes?.map(st => (
                                    <option key={st.id} value={st.name}>{st.name}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 
                                            rounded-lg text-neutral-300">
                                {form.shootCategoryLabel}
                            </div>
                        )}
                    </div>

                    {/* Options Section */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-1.5">
                                <Settings2 className="w-4 h-4 text-blue-400" />
                                Seçenekler
                            </h3>
                            <button onClick={addOption}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 
                                           hover:bg-blue-500 rounded-lg transition-colors">
                                <Plus className="w-3 h-3" /> Seçenek Ekle
                            </button>
                        </div>

                        {form.options.length === 0 ? (
                            <p className="text-xs text-neutral-500 italic py-4 text-center">
                                Henüz seçenek eklenmedi
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {/* Column headers */}
                                <div className="flex items-center gap-2 px-3 text-[10px] text-neutral-500 uppercase tracking-wider">
                                    <span className="w-4" />
                                    <span className="w-5" />
                                    <span className="flex-1">İsim</span>
                                    <span className="w-16 text-center">Kısaltma</span>
                                    <span className="w-20 text-right">Fiyat</span>
                                    <span className="w-4" />
                                    <span className="w-6" />
                                    <span className="w-6" />
                                </div>
                                {form.options.map((opt, idx) => (
                                    <OptionRow
                                        key={opt.id || idx}
                                        option={opt}
                                        index={idx}
                                        onChange={u => updateOption(idx, u)}
                                        onRemove={() => removeOption(idx)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Packages Section */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-1.5">
                                <Package className="w-4 h-4 text-amber-400" />
                                Paketler
                            </h3>
                            <button onClick={addPackage}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-600 
                                           hover:bg-amber-500 rounded-lg transition-colors">
                                <Plus className="w-3 h-3" /> Paket Ekle
                            </button>
                        </div>

                        {form.packages.length === 0 ? (
                            <p className="text-xs text-neutral-500 italic py-4 text-center">
                                Henüz paket eklenmedi
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {form.packages.map((pkg, idx) => (
                                    <PackageRow
                                        key={pkg.id || idx}
                                        pkg={pkg}
                                        index={idx}
                                        onChange={u => updatePackage(idx, u)}
                                        onRemove={() => removePackage(idx)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-700">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors">
                        İptal
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 
                                   hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors font-medium">
                        <Save className="w-4 h-4" />
                        {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ========== MAIN PAGE ==========
export default function PixonaiSettings() {
    const queryClient = useQueryClient();
    const [editConfig, setEditConfig] = useState(null); // null = closed, {} = new, {id,...} = edit
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Fetch configs
    const { data: configsData, isLoading } = useQuery({
        queryKey: ['pixonaiConfigs'],
        queryFn: () => pixonaiApi.getConfigs(),
    });
    const configs = configsData?.configs || [];

    // Fetch shoot types for category dropdown
    const { data: shootTypes } = useQuery({
        queryKey: ['shootTypes'],
        queryFn: () => optionsApi.getShootTypes().then(r => r.data || r),
    });

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: (data) => pixonaiApi.saveConfig(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pixonaiConfigs'] });
            toast.success('Yapılandırma kaydedildi');
            setEditConfig(null);
        },
        onError: (error) => {
            console.error('Save config error:', error);
            const msg = error.message?.includes('already-exists')
                ? 'Bu kategori için zaten bir yapılandırma mevcut'
                : 'Kaydetme başarısız';
            toast.error(msg);
        }
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id) => pixonaiApi.deleteConfig(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pixonaiConfigs'] });
            toast.success('Yapılandırma silindi');
            setDeleteConfirm(null);
        },
        onError: () => {
            toast.error('Silme başarısız');
        }
    });

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Camera className="w-6 h-6 text-blue-400" />
                        Pixonai Ayarları
                    </h1>
                    <p className="text-sm text-neutral-400 mt-1">
                        Her çekim türü için fotoğraf seçim seçeneklerini ve paketlerini yapılandırın
                    </p>
                </div>
                <button
                    onClick={() => setEditConfig({})}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 
                               rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Yapılandırma Ekle
                </button>
            </div>

            {/* Config List */}
            {isLoading ? (
                <div className="text-center py-12 text-neutral-400">Yükleniyor...</div>
            ) : configs.length === 0 ? (
                <div className="text-center py-16 bg-neutral-800/30 rounded-xl border border-neutral-700/50">
                    <Camera className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-400 text-sm">Henüz yapılandırma eklenmemiş</p>
                    <p className="text-neutral-500 text-xs mt-1">
                        "Yapılandırma Ekle" butonuna basarak başlayın
                    </p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {configs.map(config => (
                        <div key={config.id}
                            className="flex items-center gap-4 px-5 py-4 bg-neutral-800/50 
                                       border border-neutral-700 rounded-xl hover:border-neutral-600 transition-colors">

                            {/* Icon */}
                            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Camera className="w-5 h-5 text-blue-400" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-white">
                                    {config.shootCategoryLabel}
                                </h3>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                    {config.options?.length || 0} seçenek · {config.packages?.length || 0} paket
                                </p>
                                {/* Abbreviation preview */}
                                {(config.options?.length > 0 || config.packages?.length > 0) && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {config.options?.slice(0, 5).map(opt => (
                                            <span key={opt.id} className="px-1.5 py-0.5 text-[10px] bg-neutral-700 
                                                                          rounded text-neutral-300 font-mono">
                                                {opt.abbr || opt.name}
                                            </span>
                                        ))}
                                        {config.packages?.slice(0, 3).map(pkg => (
                                            <span key={pkg.id} className="px-1.5 py-0.5 text-[10px] bg-amber-900/50 
                                                                          rounded text-amber-300 font-mono">
                                                {pkg.abbr || pkg.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                                <button onClick={() => setEditConfig(config)}
                                    className="p-2 hover:bg-neutral-700 rounded-lg transition-colors text-neutral-400 hover:text-white">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteConfirm(config)}
                                    className="p-2 hover:bg-red-900/50 rounded-lg transition-colors text-neutral-400 hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editConfig !== null && (
                <ConfigEditModal
                    config={editConfig}
                    shootTypes={shootTypes}
                    onSave={data => saveMutation.mutate(data)}
                    onClose={() => setEditConfig(null)}
                    saving={saveMutation.isPending}
                />
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
                    <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl 
                                    p-6 max-w-sm mx-4 shadow-2xl">
                        <h3 className="text-base font-semibold mb-2">Yapılandırmayı Sil</h3>
                        <p className="text-sm text-neutral-400 mb-4">
                            <strong>{deleteConfirm.shootCategoryLabel}</strong> yapılandırmasını silmek istediğinize emin misiniz?
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1.5 text-sm hover:bg-neutral-800 rounded-lg transition-colors">
                                İptal
                            </button>
                            <button onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                                disabled={deleteMutation.isPending}
                                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 rounded-lg transition-colors">
                                {deleteMutation.isPending ? 'Siliniyor...' : 'Sil'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
