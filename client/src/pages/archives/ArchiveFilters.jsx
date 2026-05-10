/**
 * ArchiveFilters — Filtre paneli (çekim türü, yer, okul, durum).
 * Archives.jsx'ten ayrıştırıldı (Görev 4).
 *
 * Props:
 *   shootTypes, locations, schools  — dropdown verileri
 *   filterShootType, filterLocation, filterSchool, filterStatus — değerler
 *   onChange(field, value)          — değer değiştirme callback'i
 *   onClear()                       — tüm filtreleri temizle
 */

import { SlidersHorizontal, X } from 'lucide-react';

const WORKFLOW_STATUSES = {
    selection_pending: 'Seçim Yapılacak',
    preparing: 'Hazırlanıyor',
    printing: 'Basılacak',
    ready: 'Hazır',
    delivered: 'Teslim Edildi',
};

export default function ArchiveFilters({
    shootTypes,
    locations,
    schools,
    filterShootType,
    filterLocation,
    filterSchool,
    filterStatus,
    onChange,
    onClear,
}) {
    const hasActive = filterShootType || filterLocation || filterSchool || filterStatus;

    return (
        <div className="bg-muted/30 border border-border rounded-xl p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Filtreler</span>
                {hasActive && (
                    <button
                        onClick={onClear}
                        className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                        <X className="w-3 h-3" /> Temizle
                    </button>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select
                    value={filterShootType}
                    onChange={e => onChange('filterShootType', e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-background border border-input outline-none text-xs"
                >
                    <option value="">Tüm Çekim Türleri</option>
                    {shootTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                <select
                    value={filterLocation}
                    onChange={e => onChange('filterLocation', e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-background border border-input outline-none text-xs"
                >
                    <option value="">Tüm Yerler</option>
                    {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>

                {schools && schools.length > 0 && (
                    <select
                        value={filterSchool}
                        onChange={e => onChange('filterSchool', e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-background border border-input outline-none text-xs"
                    >
                        <option value="">Tüm Okullar</option>
                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                )}

                <select
                    value={filterStatus}
                    onChange={e => onChange('filterStatus', e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-background border border-input outline-none text-xs"
                >
                    <option value="">Tüm Durumlar</option>
                    {Object.entries(WORKFLOW_STATUSES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}
