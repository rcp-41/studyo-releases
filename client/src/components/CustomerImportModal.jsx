import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../services/api';
import { cn } from '../lib/utils';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATE_COLUMNS = ['İsim', 'Telefon', 'Email', 'Tür', 'Kaynak', 'Not'];
const FIELD_MAP = {
    'İsim': 'name', 'isim': 'name', 'name': 'name', 'ad': 'name',
    'Telefon': 'phone', 'telefon': 'phone', 'phone': 'phone', 'tel': 'phone',
    'Email': 'email', 'email': 'email', 'e-posta': 'email', 'eposta': 'email',
    'Tür': 'type', 'tür': 'type', 'type': 'type', 'tip': 'type',
    'Kaynak': 'source', 'kaynak': 'source', 'source': 'source',
    'Not': 'notes', 'not': 'notes', 'notes': 'notes', 'açıklama': 'notes'
};

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
        const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, i) => {
            const field = FIELD_MAP[h] || FIELD_MAP[h.toLowerCase()];
            if (field) obj[field] = values[i] || '';
        });
        return obj;
    }).filter(r => r.name); // At least a name is required

    return { headers, rows };
}

function downloadTemplate() {
    const BOM = '\uFEFF';
    const csv = BOM + TEMPLATE_COLUMNS.join(';') + '\n'
        + 'Ahmet Yılmaz;05551234567;ahmet@mail.com;Bireysel;Web;Örnek kayıt\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'musteri-sablonu.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default function CustomerImportModal({ isOpen, onClose }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef(null);
    const queryClient = useQueryClient();

    const handleFile = (f) => {
        if (!f) return;
        setFile(f);
        setResult(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const parsed = parseCSV(text);
            setPreview(parsed);
        };
        reader.readAsText(f, 'UTF-8');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer?.files?.[0];
        if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) {
            handleFile(f);
        } else {
            toast.error('Lütfen CSV dosyası yükleyin');
        }
    };

    const handleImport = async () => {
        if (!preview?.rows?.length) return;
        setImporting(true);
        let success = 0, failed = 0;

        try {
            for (const row of preview.rows) {
                try {
                    await customersApi.create({
                        name: row.name,
                        phone: row.phone || '',
                        email: row.email || '',
                        type: row.type || 'Bireysel',
                        source: row.source || 'Import',
                        notes: row.notes || ''
                    });
                    success++;
                } catch {
                    failed++;
                }
            }
            setResult({ success, failed, total: preview.rows.length });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success(`${success} müşteri başarıyla içeri aktarıldı`);
        } catch (err) {
            toast.error('İçeri aktarma sırasında hata oluştu');
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setPreview(null);
        setResult(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">Müşteri İçeri Aktar</h2>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Step 1: Template */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                            <p className="text-sm font-medium">1. Şablonu indir</p>
                            <p className="text-xs text-muted-foreground">CSV şablonunu doldurup yükleyin</p>
                        </div>
                        <button onClick={downloadTemplate}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                            <Download className="w-4 h-4" /> Şablon İndir
                        </button>
                    </div>

                    {/* Step 2: Upload */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileRef.current?.click()}
                        className={cn(
                            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        )}
                    >
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium">2. CSV dosyasını sürükleyin veya tıklayın</p>
                        <p className="text-xs text-muted-foreground mt-1">Desteklenen: .csv, .txt (UTF-8, ; veya , ayraç)</p>
                        {file && <p className="text-xs text-primary mt-2">📁 {file.name}</p>}
                        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                            onChange={(e) => handleFile(e.target.files?.[0])} />
                    </div>

                    {/* Step 3: Preview */}
                    {preview && preview.rows.length > 0 && (
                        <div>
                            <p className="text-sm font-medium mb-2">3. Önizleme ({preview.rows.length} kayıt bulundu)</p>
                            <div className="border border-border rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left px-3 py-2 font-medium">#</th>
                                            <th className="text-left px-3 py-2 font-medium">İsim</th>
                                            <th className="text-left px-3 py-2 font-medium">Telefon</th>
                                            <th className="text-left px-3 py-2 font-medium">Email</th>
                                            <th className="text-left px-3 py-2 font-medium">Tür</th>
                                            <th className="text-left px-3 py-2 font-medium">Kaynak</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.rows.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="border-t border-border">
                                                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                                                <td className="px-3 py-2 font-medium">{row.name}</td>
                                                <td className="px-3 py-2">{row.phone}</td>
                                                <td className="px-3 py-2">{row.email}</td>
                                                <td className="px-3 py-2">{row.type}</td>
                                                <td className="px-3 py-2">{row.source}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.rows.length > 5 && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                                        ...ve {preview.rows.length - 5} kayıt daha
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {preview && preview.rows.length === 0 && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-lg text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            Dosyada geçerli kayıt bulunamadı. Sütun adlarını kontrol edin.
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className={cn('flex items-center gap-2 p-3 rounded-lg text-sm',
                            result.failed > 0 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-green-500/10 text-green-600')}>
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            {result.success}/{result.total} müşteri başarıyla aktarıldı.
                            {result.failed > 0 && ` ${result.failed} kayıt başarısız oldu.`}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-5 border-t border-border">
                    <button onClick={handleClose} className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm">
                        Kapat
                    </button>
                    <button onClick={handleImport}
                        disabled={!preview?.rows?.length || importing || !!result}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm">
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {importing ? 'Aktarılıyor...' : 'İçeri Aktar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
