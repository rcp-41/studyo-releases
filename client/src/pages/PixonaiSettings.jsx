import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pixonaiApi, optionsApi, schoolsApi } from '../services/api';
import { Camera, Plus, Trash2, Edit3, Package } from 'lucide-react';
import notify from '../lib/notify';
import ConfigEditModal from './pixonai/ConfigEditModal';

const CONFIG_TYPES = [
    { value: 'yearly', label: 'Yıllık', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { value: 'set', label: 'Set', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { value: 'portrait', label: 'Vesikalık/Biyometrik', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { value: 'custom', label: 'Özel', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
];

export default function PixonaiSettings() {
    const queryClient = useQueryClient();
    const [editConfig, setEditConfig] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const { data: configsData, isLoading } = useQuery({
        queryKey: ['pixonaiConfigs'],
        queryFn: () => pixonaiApi.getConfigs(),
    });
    const configs = configsData?.configs || [];

    const { data: shootTypes } = useQuery({
        queryKey: ['shootTypes'],
        queryFn: () => optionsApi.getShootTypes().then(r => r.data || r),
    });

    const { data: schools } = useQuery({
        queryKey: ['schools'],
        queryFn: () => schoolsApi.list().then(r => r.data || []),
    });

    const saveMutation = useMutation({
        mutationFn: (data) => pixonaiApi.saveConfig(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pixonaiConfigs'] });
            notify.success('Yapılandırma kaydedildi');
            setEditConfig(null);
        },
        onError: (error) => {
            const msg = error.message?.includes('already-exists')
                ? 'Bu kategori için zaten bir yapılandırma mevcut'
                : 'Kaydetme başarısız';
            notify.error(msg);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => pixonaiApi.deleteConfig(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pixonaiConfigs'] });
            notify.success('Yapılandırma silindi');
            setDeleteConfirm(null);
        },
        onError: () => notify.error('Silme başarısız')
    });

    const getTypeBadge = (type) => {
        const ct = CONFIG_TYPES.find(c => c.value === type);
        if (!ct) return null;
        return (
            <span className={`px-1.5 py-0.5 text-[10px] rounded border ${ct.color}`}>
                {ct.label}
            </span>
        );
    };

    const getTotalGifts = (config) =>
        (config.packages || []).reduce((acc, pkg) => acc + (pkg.gifts?.length || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Camera className="w-6 h-6 text-blue-400" />
                        Pixonai Ayarları
                    </h1>
                    <p className="text-sm text-neutral-400 mt-1">
                        Her çekim türü için fotoğraf seçim seçeneklerini, paketlerini ve hediyelerini yapılandırın
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

            {isLoading ? (
                <div className="text-center py-12 text-neutral-400">Yükleniyor...</div>
            ) : configs.length === 0 ? (
                <div className="text-center py-16 bg-neutral-800/30 rounded-xl border border-neutral-700/50">
                    <Camera className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-400 text-sm">Henüz yapılandırma eklenmemiş</p>
                    <p className="text-neutral-500 text-xs mt-1">&quot;Yapılandırma Ekle&quot; butonuna basarak başlayın</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {configs.map(config => (
                        <div key={config.id}
                            className="flex items-center gap-4 px-5 py-4 bg-neutral-800/50
                                       border border-neutral-700 rounded-xl hover:border-neutral-600 transition-colors">

                            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Camera className="w-5 h-5 text-blue-400" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-white">{config.shootCategoryLabel}</h3>
                                    {getTypeBadge(config.type)}
                                </div>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                    {config.options?.length || 0} seçenek · {config.packages?.length || 0} paket · {getTotalGifts(config)} hediye
                                </p>
                                {config.packages?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {config.packages.map(pkg => (
                                            <span key={pkg.id} className="px-1.5 py-0.5 text-[10px] bg-amber-900/50
                                                                          rounded text-amber-300 font-mono flex items-center gap-0.5">
                                                <Package className="w-2.5 h-2.5" />
                                                {pkg.name}
                                                {pkg.photoCount > 0 && <span className="text-amber-500">({pkg.photoCount})</span>}
                                                {(pkg.gifts?.length || 0) > 0 && (
                                                    <span className="text-green-400 ml-0.5">+{pkg.gifts.length}</span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

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

            {editConfig !== null && (
                <ConfigEditModal
                    config={editConfig}
                    shootTypes={shootTypes}
                    schools={schools}
                    onSave={data => saveMutation.mutate(data)}
                    onClose={() => setEditConfig(null)}
                    saving={saveMutation.isPending}
                />
            )}

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
