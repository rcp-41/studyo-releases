/**
 * Reports Cloud Functions
 * Generate reports from archives data
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');

const buildDateRange = (dateRange, customStart, customEnd) => {
    if (customStart && customEnd) {
        return { start: new Date(customStart), end: new Date(customEnd) };
    }
    const now = new Date();
    let start, end = new Date(now);
    end.setHours(23, 59, 59, 999);

    switch (dateRange) {
        case 'daily':
            start = new Date(now); start.setHours(0, 0, 0, 0); break;
        case 'weekly': {
            start = new Date(now);
            const day = start.getDay();
            start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
            start.setHours(0, 0, 0, 0); break;
        }
        case 'annual':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); break;
        case 'monthly':
        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    return { start, end };
};

/**
 * Generate Report
 * type: 'daily' | 'monthly' | 'annual' | 'shootType' | 'custom'
 */
exports.generateReport = onCall({ memory: '256MiB' }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');
    if (request.auth.token.role !== 'admin') throw new HttpsError('permission-denied', 'Admin access required');

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { type = 'monthly', dateRange = 'monthly', startDate, endDate } = request.data || {};

    const { start, end } = buildDateRange(dateRange, startDate, endDate);
    const tsStart = admin.firestore.Timestamp.fromDate(start);
    const tsEnd = admin.firestore.Timestamp.fromDate(end);

    try {
        const snap = await dbHandler.collection('archives')
            .where('createdAt', '>=', tsStart)
            .where('createdAt', '<=', tsEnd)
            .orderBy('createdAt', 'asc')
            .get();

        const archives = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                archiveNo: d.archiveNumber || d.archiveId || doc.id,
                customerName: d.fullName || d.customerName || '-',
                phone: d.phone || d.customerPhone || '-',
                shootType: d.shootTypeName || d.shootType?.name || 'Belirtilmemiş',
                location: d.locationName || d.location?.name || '-',
                photographerName: d.photographerName || d.photographer?.name || 'Belirtilmemiş',
                totalAmount: d.totalAmount || d.price || 0,
                paidAmount: d.paidAmount || ((d.cashAmount || 0) + (d.cardAmount || 0) + (d.transferAmount || 0)),
                cashAmount: d.cashAmount || 0,
                cardAmount: d.cardAmount || 0,
                transferAmount: d.transferAmount || 0,
                paymentStatus: d.paymentStatus || 'unknown',
                status: d.status || '-',
                createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt || '-',
                schoolId: d.schoolId || null,
                className: d.className || null
            };
        });

        // Summary stats
        const totalRevenue = archives.reduce((s, a) => s + a.totalAmount, 0);
        const totalPaid = archives.reduce((s, a) => s + a.paidAmount, 0);
        const totalCash = archives.reduce((s, a) => s + a.cashAmount, 0);
        const totalCard = archives.reduce((s, a) => s + a.cardAmount, 0);
        const totalTransfer = archives.reduce((s, a) => s + a.transferAmount, 0);
        const pendingAmount = totalRevenue - totalPaid;

        // Shoot type breakdown
        const byShootType = {};
        archives.forEach(a => {
            const st = a.shootType || 'Diğer';
            if (!byShootType[st]) byShootType[st] = { count: 0, revenue: 0 };
            byShootType[st].count++;
            byShootType[st].revenue += a.totalAmount;
        });

        // Daily breakdown for chart
        const byDate = {};
        archives.forEach(a => {
            const dateKey = a.createdAt ? a.createdAt.split('T')[0] : 'unknown';
            if (!byDate[dateKey]) byDate[dateKey] = { count: 0, revenue: 0, cash: 0, card: 0, transfer: 0 };
            byDate[dateKey].count++;
            byDate[dateKey].revenue += a.totalAmount;
            byDate[dateKey].cash += a.cashAmount;
            byDate[dateKey].card += a.cardAmount;
            byDate[dateKey].transfer += a.transferAmount;
        });
        const dailyBreakdown = Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v }));

        // CSV data
        const csvRows = [
            ['Arşiv No', 'Müşteri', 'Telefon', 'Çekim Türü', 'Yer', 'Tutar', 'Ödenen', 'Nakit', 'Kart', 'EFT', 'Ödeme Durumu', 'Tarih'],
            ...archives.map(a => [
                a.archiveNo, a.customerName, a.phone, a.shootType, a.location,
                a.totalAmount, a.paidAmount, a.cashAmount, a.cardAmount, a.transferAmount,
                a.paymentStatus, a.createdAt
            ])
        ];
        const csvContent = csvRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

        return {
            success: true,
            data: {
                type,
                dateRange: { start: start.toISOString(), end: end.toISOString() },
                summary: {
                    totalRecords: archives.length,
                    totalRevenue, totalPaid, pendingAmount,
                    totalCash, totalCard, totalTransfer
                },
                byShootType,
                dailyBreakdown,
                records: archives,
                csv: csvContent
            }
        };
    } catch (error) {
        console.error('generateReport error:', error);
        throw new HttpsError('internal', error.message);
    }
});
