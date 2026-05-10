import ExcelJS from 'exceljs';

export async function exportToExcel(data, columns, fileName = 'export') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Veri');

    ws.columns = columns.map(col => {
        const maxLen = Math.max(
            col.label.length,
            ...data.map(row => String(row[col.key] ?? '').length)
        );
        return { header: col.label, key: col.key, width: Math.min(maxLen + 2, 40) };
    });

    data.forEach(row => {
        const obj = {};
        columns.forEach(col => { obj[col.key] = row[col.key] ?? ''; });
        ws.addRow(obj);
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

export function exportToCsv(data, columns, fileName = 'export') {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
        columns.map(c => {
            const val = String(row[c.key] ?? '').replace(/"/g, '""');
            return `"${val}"`;
        }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
