import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import ExportColumnsModal from '../ExportColumnsModal';
import { SkeletonDashboard } from '../Skeleton';

export function SummaryCard({ label, value, color, bg }) {
    return (
        <div className={cn('rounded-lg p-3', bg)}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-lg font-bold', color)}>{value}</p>
        </div>
    );
}

export function Loading() {
    return <SkeletonDashboard />;
}

export function exportPdf(data, columns, fileName, t) {
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(14);
    doc.text(fileName.replace(/_/g, ' ').toUpperCase(), 14, 20);
    doc.setFontSize(9);
    doc.text(`${t('pages.reports.createdAt')}: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

    const startY = 35;
    const colWidth = (doc.internal.pageSize.width - 28) / columns.length;
    let y = startY;

    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 4, doc.internal.pageSize.width - 28, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    columns.forEach((col, i) => {
        doc.text(col.label, 14 + i * colWidth, y);
    });

    doc.setFont('helvetica', 'normal');
    data.forEach((row) => {
        y += 7;
        if (y > doc.internal.pageSize.height - 20) {
            doc.addPage();
            y = 20;
        }
        columns.forEach((col, i) => {
            doc.text(String(row[col.key] ?? ''), 14 + i * colWidth, y);
        });
    });

    doc.save(`${fileName}.pdf`);
}

export function DataTable({ data, columns, fileName }) {
    const { t } = useTranslation();
    const [showExport, setShowExport] = useState(false);

    return (
        <>
            <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                    <span className="text-sm text-muted-foreground">{data.length} {t('pages.reports.records')}</span>
                    <div className="flex gap-2">
                        <button onClick={() => setShowExport(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                            <Download className="w-3.5 h-3.5" /> {t('pages.reports.excel')}
                        </button>
                        <button onClick={() => exportPdf(data, columns, fileName, t)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                            <FileText className="w-3.5 h-3.5" /> {t('pages.reports.pdf')}
                        </button>
                    </div>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                        <tr>
                            {columns.map(c => (
                                <th key={c.key} className="text-left px-4 py-2 font-medium">{c.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {data.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/20">
                                {columns.map(c => (
                                    <td key={c.key} className="px-4 py-2">{row[c.key] ?? '-'}</td>
                                ))}
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} className="text-center py-6 text-muted-foreground">
                                    {t('pages.reports.noData')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showExport && (
                <ExportColumnsModal
                    allColumns={columns}
                    data={data}
                    fileName={fileName}
                    onClose={() => setShowExport(false)}
                />
            )}
        </>
    );
}
