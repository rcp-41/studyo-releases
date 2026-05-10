import { useState } from 'react';
import { Camera, Save, X, Settings2, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import OptionRow from './OptionRow';
import PackageRow from './PackageRow';

const CONFIG_TYPES = [
    { value: 'yearly', label: 'Yıllık', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { value: 'set', label: 'Set', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { value: 'portrait', label: 'Vesikalık/Biyometrik', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { value: 'custom', label: 'Özel', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
];

export default function ConfigEditModal({ config, shootTypes, schools, onSave, onClose, saving }) {
    const isNew = !config?.id;

    const [form, setForm] = useState({
        shootCategoryId: config?.shootCategoryId || '',
        shootCategoryLabel: config?.shootCategoryLabel || '',
        type: config?.type || 'yearly',
        schoolId: config?.schoolId || '',
        className: config?.className || '',
        options: config?.options || [],
        packages: config?.packages || [],
    });

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
        setForm(f => ({ ...f, options: f.options.map((o, i) => i === idx ? updated : o) }));
    };

    const removeOption = (idx) => {
        setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
    };

    const addPackage = () => {
        setForm(f => ({
            ...f,
            packages: [...f.packages, {
                id: `pkg_${Date.now()}`,
                name: '',
                abbr: '',
                price: 0,
                photoCount: 0,
                description: '',
                gifts: [],
            }]
        }));
    };

    const updatePackage = (idx, updated) => {
        setForm(f => ({ ...f, packages: f.packages.map((p, i) => i === idx ? updated : p) }));
    };

    const removePackage = (idx) => {
        setForm(f => ({ ...f, packages: f.packages.filter((_, i) => i !== idx) }));
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
        onSave({ ...(config?.id ? { id: config.id } : {}), ...form });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl
                            w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl mx-4">

                <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                        <Camera className="w-5 h-5 text-blue-400" />
                        {isNew ? 'Yeni Pixonai Yapılandırması' : `${form.shootCategoryLabel} Düzenle`}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-neutral-700 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
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

                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-1">Yapılandırma Türü</label>
                            <select
                                value={form.type}
                                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700
                                           rounded-lg focus:border-blue-500 outline-none"
                            >
                                {CONFIG_TYPES.map(ct => (
                                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-neutral-500 mt-0.5">
                                {form.type === 'yearly' && 'Yıllık: Favori sayısına göre paket eşleştirme + hediye sistemi'}
                                {form.type === 'set' && 'Set: Baro, Mezuniyet seti — her fotoğrafa hediye atama'}
                                {form.type === 'portrait' && 'Vesikalık/Biyometrik: Tüm fotoğraflara sınırsız hediye seçimi'}
                                {form.type === 'custom' && 'Özel: Serbest yapılandırma'}
                            </p>
                        </div>
                    </div>

                    {form.type === 'yearly' && schools && schools.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">Okul</label>
                                <select
                                    value={form.schoolId}
                                    onChange={e => setForm(f => ({ ...f, schoolId: e.target.value, className: '' }))}
                                    className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700
                                               rounded-lg focus:border-blue-500 outline-none"
                                >
                                    <option value="">— Okul seçin —</option>
                                    {schools.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            {form.schoolId && (() => {
                                const school = schools.find(s => s.id === form.schoolId);
                                const classes = school?.classes || [];
                                return (
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-300 mb-1">Sınıf</label>
                                        {classes.length > 0 ? (
                                            <select
                                                value={form.className}
                                                onChange={e => setForm(f => ({ ...f, className: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700
                                                           rounded-lg focus:border-blue-500 outline-none"
                                            >
                                                <option value="">Seçin...</option>
                                                {classes.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={form.className}
                                                onChange={e => setForm(f => ({ ...f, className: e.target.value }))}
                                                placeholder="Ör: 4-A"
                                                className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700
                                                           rounded-lg focus:border-blue-500 outline-none"
                                            />
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

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
                            <p className="text-xs text-neutral-500 italic py-4 text-center">Henüz seçenek eklenmedi</p>
                        ) : (
                            <div className="space-y-2">
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
                                <span className="text-[10px] text-neutral-500 font-normal ml-1">(fotoğraf sayısı + hediyeler)</span>
                            </h3>
                            <button onClick={addPackage}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-600
                                           hover:bg-amber-500 rounded-lg transition-colors">
                                <Plus className="w-3 h-3" /> Paket Ekle
                            </button>
                        </div>

                        {form.packages.length === 0 ? (
                            <p className="text-xs text-neutral-500 italic py-4 text-center">Henüz paket eklenmedi</p>
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
