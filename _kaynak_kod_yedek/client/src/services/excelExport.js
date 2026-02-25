/**
 * Excel Export Utility
 * Uses SheetJS (xlsx) for Excel file generation
 */
import * as XLSX from 'xlsx';

/**
 * Export data to Excel with selected columns
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of { key, label } column definitions
 * @param {string} fileName - File name without extension
 */
export function exportToExcel(data, columns, fileName = 'export') {
    const ws = XLSX.utils.json_to_sheet(data.map(row => {
        const obj = {};
        columns.forEach(col => {
            obj[col.label] = row[col.key] ?? '';
        });
        return obj;
    }));

    // Auto-width columns
    const colWidths = columns.map(col => {
        const maxLen = Math.max(
            col.label.length,
            ...data.map(row => String(row[col.key] ?? '').length)
        );
        return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Veri');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**
 * Export to CSV (simpler alternative)
 */
export function exportToCsv(data, columns, fileName = 'export') {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
        columns.map(c => {
            const val = String(row[c.key] ?? '').replace(/"/g, '""');
            return `"${val}"`;
        }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
