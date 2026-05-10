import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { optionsApi, schoolsApi } from '../../services/api';
import { Plus, Trash2, Package, School, ChevronDown, ChevronUp } from 'lucide-react';
import notify from '../../lib/notify';
import { useTranslation } from 'react-i18next';

const PRESET_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

function DataList({ title, items, onDelete, onAdd, withColor, onColorChange }) {
    const { t } = useTranslation();
    const [newItem, setNewItem] = useState('');
    const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

    const handleAdd = () => {
        if (!newItem.trim()) return;
        if (withColor) {
            onAdd({ name: newItem, color: newColor });
        } else {
            onAdd(newItem);
        }
        setNewItem('');
        setNewColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4">{title}</h3>
            <div className="flex gap-2 mb-4">
                {withColor && (
                    <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-input cursor-pointer p-1" title="Renk seç" />
                )}
                <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Yeni ekle..."
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                <button onClick={handleAdd} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {items?.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group">
                        <div className="flex items-center gap-2">
                            {withColor && (
                                <input type="color" value={item.color || '#3b82f6'}
                                    onChange={(e) => onColorChange?.(item.id, e.target.value)}
                                    className="w-6 h-6 rounded border border-input cursor-pointer p-0.5" title="Renk değiştir" />
                            )}
                            <span className="text-sm">{item.name}</span>
                        </div>
                        <button onClick={() => onDelete(item.id)}
                            className="p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {items?.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">{t('settingsPage.emptyList')}</div>
                )}
            </div>
        </div>
    );
}

function PackageList({ items, onDelete, onAdd }) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');

    const handleAdd = () => {
        if (!name.trim()) return;
        onAdd({ name: name.trim(), price: parseFloat(price) || 0 });
        setName('');
        setPrice('');
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Package className="w-4 h-4" /> {t('shoots.packages')}</h3>
            <div className="flex gap-2 mb-4">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Paket adı..." className="flex-1 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder="₺ Fiyat" className="w-24 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                <button onClick={handleAdd} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {items?.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group">
                        <span className="text-sm">{item.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-primary">₺{item.price || 0}</span>
                            <button onClick={() => onDelete(item.id)}
                                className="p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
                {items?.length === 0 && <div className="text-center py-4 text-sm text-muted-foreground">{t('settingsPage.packageNo')}</div>}
            </div>
        </div>
    );
}

function SchoolManager({ schools, onCreate, onDelete }) {
    const { t } = useTranslation();
    const [newName, setNewName] = useState('');
    const [newClasses, setNewClasses] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    const handleAdd = () => {
        if (!newName.trim()) return;
        const classArr = newClasses.split(',').map(c => c.trim()).filter(Boolean);
        onCreate({ name: newName.trim(), classes: classArr });
        setNewName('');
        setNewClasses('');
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><School className="w-4 h-4" /> {t('settingsPage.schoolManagement')}</h3>
            <div className="space-y-2 mb-4">
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Okul adı..." className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                <div className="flex gap-2">
                    <input type="text" value={newClasses} onChange={e => setNewClasses(e.target.value)}
                        placeholder="Sınıflar (virgülle): 1-A, 1-B, 2-A..."
                        className="flex-1 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                        onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                    <button onClick={handleAdd} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {schools?.map(school => (
                    <div key={school.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-muted/30">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setExpandedId(expandedId === school.id ? null : school.id)} className="p-0.5">
                                    {expandedId === school.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                <span className="text-sm font-medium">{school.name}</span>
                                {school.classes?.length > 0 && <span className="text-xs text-muted-foreground">({school.classes.length} {t('settingsPage.schoolClasses')})</span>}
                            </div>
                            <button onClick={() => onDelete(school.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {expandedId === school.id && school.classes?.length > 0 && (
                            <div className="px-3 py-2 bg-muted/10 flex flex-wrap gap-1.5">
                                {school.classes.map(c => (
                                    <span key={c} className="text-xs px-2 py-0.5 bg-muted rounded">{c}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {!schools?.length && <div className="text-center py-4 text-sm text-muted-foreground">{t('settingsPage.noSchools')}</div>}
            </div>
        </div>
    );
}

export default function OptionsSettings() {
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });
    const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: () => optionsApi.getLocations().then(r => r.data) });
    const { data: photographers } = useQuery({ queryKey: ['photographers'], queryFn: () => optionsApi.getPhotographers().then(r => r.data) });
    const { data: schools } = useQuery({ queryKey: ['schools'], queryFn: () => schoolsApi.list().then(r => r.data || []) });
    const { data: packages } = useQuery({ queryKey: ['packages'], queryFn: () => optionsApi.getPackages?.().then(r => r.data).catch(() => []) });

    const createShootTypeMutation = useMutation({ mutationFn: (name) => optionsApi.createShootType({ name }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shootTypes'] }); notify.success(t('settingsPage.addShootType')); } });
    const deleteShootTypeMutation = useMutation({ mutationFn: (id) => optionsApi.deleteShootType(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shootTypes'] }); notify.success(t('settingsPage.deleteShootType')); } });
    const createLocationMutation = useMutation({ mutationFn: (name) => optionsApi.createLocation({ name }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); notify.success(t('settingsPage.addLocation')); } });
    const deleteLocationMutation = useMutation({ mutationFn: (id) => optionsApi.deleteLocation(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); notify.success(t('settingsPage.deleteLocation')); } });
    const createPhotographerMutation = useMutation({ mutationFn: (name) => optionsApi.createPhotographer({ name }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['photographers'] }); notify.success(t('settingsPage.addPhotographer')); } });
    const deletePhotographerMutation = useMutation({ mutationFn: (id) => optionsApi.deletePhotographer(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['photographers'] }); notify.success(t('settingsPage.deletePhotographer')); } });
    const createPackageMutation = useMutation({ mutationFn: (data) => optionsApi.createPackage?.(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['packages'] }); notify.success(t('settingsPage.addPackage')); } });
    const deletePackageMutation = useMutation({ mutationFn: (id) => optionsApi.deletePackage?.(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['packages'] }); notify.success(t('settingsPage.deletePackage')); } });
    const createSchoolMutation = useMutation({ mutationFn: (data) => schoolsApi.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schools'] }); notify.success(t('settingsPage.addSchool')); } });
    const deleteSchoolMutation = useMutation({ mutationFn: (id) => schoolsApi.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schools'] }); notify.success(t('settingsPage.deleteSchool')); } });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DataList
                title="Çekim Türleri"
                items={shootTypes}
                withColor
                onAdd={(data) => createShootTypeMutation.mutate(typeof data === 'string' ? data : data.name)}
                onDelete={(id) => deleteShootTypeMutation.mutate(id)}
                onColorChange={(id, color) => {
                    optionsApi.saveShootType({ id, color }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['shootTypes'] });
                    }).catch(() => notify.error('Renk güncellenemedi'));
                }}
            />
            <DataList
                title="Çekim Yerleri"
                items={locations}
                onAdd={(name) => createLocationMutation.mutate(name)}
                onDelete={(id) => deleteLocationMutation.mutate(id)}
            />
            <DataList
                title="Fotoğrafçılar"
                items={photographers}
                onAdd={(name) => createPhotographerMutation.mutate(name)}
                onDelete={(id) => deletePhotographerMutation.mutate(id)}
            />
            <PackageList
                items={packages}
                onAdd={(data) => createPackageMutation.mutate(data)}
                onDelete={(id) => deletePackageMutation.mutate(id)}
            />
            <SchoolManager
                schools={schools}
                onCreate={(data) => createSchoolMutation.mutate(data)}
                onDelete={(id) => deleteSchoolMutation.mutate(id)}
            />
        </div>
    );
}
