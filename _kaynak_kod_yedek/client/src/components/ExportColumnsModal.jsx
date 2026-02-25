import { useState } from 'react';
import { X, CheckSquare, Square, Download, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../services/excelExport';

/**
 * Modal for selecting which columns to include in Excel export
 * @param {Object} props
 * @param {Array} props.allColumns - [{ key, label }]
 * @param {Array} props.data - data rows
 * @param {string} props.fileName - export file name
 * @param {Function} props.onClose
 */
export default function ExportColumnsModal({ allColumns, data, fileName, onClose }) {
    const [selected, setSelected] = useState(new Set(allColumns.map(c => c.key)));

    const toggle = (key) => {
        const next = new Set(selected);
        if (next.has(key)) next.delete(key); else next.add(key);
        setSelected(next);
    };

    const toggleAll = () => {
        if (selected.size === allColumns.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(allColumns.map(c => c.key)));
        }
    };

    const handleExport = () => {
        const cols = allColumns.filter(c => selected.has(c.key));
        if (!cols.length) return;
        exportToExcel(data, cols, fileName);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" /> Excel Dışa Aktarım
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                <p className="text-sm text-muted-foreground mb-3">Dışa aktarılacak sütunları seçin:</p>

                <div className="space-y-1 max-h-[300px] overflow-auto mb-4">
                    <button onClick={toggleAll}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm font-medium">
                        {selected.size === allColumns.length
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 text-muted-foreground" />}
                        Tümünü Seç
                    </button>
                    <hr className="border-border" />
                    {allColumns.map(col => (
                        <button key={col.key} onClick={() => toggle(col.key)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded hover:bg-muted/50 text-sm">
                            {selected.has(col.key)
                                ? <CheckSquare className="w-4 h-4 text-primary" />
                                : <Square className="w-4 h-4 text-muted-foreground" />}
                            {col.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                    <button onClick={handleExport} disabled={selected.size === 0}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" /> İndir ({selected.size})
                    </button>
                </div>
            </div>
        </div>
    );
}
