/**
 * Dashboard Cloud Functions
 * Statistics, calendar, and summary data
 *
 * Multi-Tenant: Uses DatabaseHandler for studio-scoped data access
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');

// Helper: build date range boundaries from dateRange string
const buildDateRange = (dateRange = 'month') => {
    const now = new Date();
    let start, end;

    end = new Date(now);
    end.setHours(23, 59, 59, 999);

    switch (dateRange) {
        case 'today':
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            break;
        case 'week': {
            start = new Date(now);
            const day = start.getDay();
            const diff = day === 0 ? 6 : day - 1; // Monday start
            start.setDate(start.getDate() - diff);
            start.setHours(0, 0, 0, 0);
            break;
        }
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
        case 'month':
        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
    }
    return { start, end };
};

/**
 * Get dashboard summary statistics
 * TEK KAYNAK: TÃ¼m veriler archives koleksiyonundan Ã§ekilir
 * PERFORMANS: Tarih bazlÄ± ayrÄ± sorgular â€” tÃ¼m arÅŸivleri belleÄŸe yÃ¼klemez
 */
exports.getDashboardSummary = onCall({ memory: '256MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);

    try {
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // --- Week boundaries (Monday start) ---
        const weekStart = new Date(today);
        const currentDay = weekStart.getDay();
        const diff = currentDay === 0 ? 6 : currentDay - 1;
        weekStart.setDate(weekStart.getDate() - diff);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        // --- Month boundaries ---
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        // Firestore Timestamps
        const tsToday = admin.firestore.Timestamp.fromDate(today);
        const tsTomorrow = admin.firestore.Timestamp.fromDate(tomorrow);
        const tsWeekStart = admin.firestore.Timestamp.fromDate(weekStart);
        const tsWeekEnd = admin.firestore.Timestamp.fromDate(weekEnd);
        const tsMonthStart = admin.firestore.Timestamp.fromDate(monthStart);
        const tsMonthEnd = admin.firestore.Timestamp.fromDate(monthEnd);

        const archivesRef = dbHandler.collection('archives');

        // ============ PARALEL SORGULAR â€” bellek dostu ============
        const [
            todaySnap,
            weekSnap,
            monthSnap,
            pendingSnap,
            totalCountDoc
        ] = await Promise.all([
            archivesRef.where('createdAt', '>=', tsToday).where('createdAt', '<', tsTomorrow).get(),
            archivesRef.where('createdAt', '>=', tsWeekStart).where('createdAt', '<', tsWeekEnd).get(),
            archivesRef.where('createdAt', '>=', tsMonthStart).where('createdAt', '<=', tsMonthEnd).get(),
            archivesRef.where('paymentStatus', 'in', ['partial', 'unpaid', 'pending']).get(),
            dbHandler.collection('counters').doc('archives').get()
        ]);

        // --- BugÃ¼nkÃ¼ veriler ---
        let dailyCash = 0, dailyCard = 0, dailyTransfer = 0;
        let todayAppointments = 0;

        todaySnap.docs.forEach(doc => {
            const data = doc.data();
            dailyCash += data.cashAmount || 0;
            dailyCard += data.cardAmount || 0;
            dailyTransfer += data.transferAmount || 0;
        });

        // --- AylÄ±k gelir ---
        let monthRevenue = 0;
        const monthlyShootTypes = {};
        monthSnap.docs.forEach(doc => {
            const data = doc.data();
            monthRevenue += data.totalAmount || data.price || 0;
            const st = data.shootType || 'DiÄŸer';
            monthlyShootTypes[st] = (monthlyShootTypes[st] || 0) + 1;
        });

        // --- Bekleyen Ã¶demeler ---
        let pendingPaymentsTotal = 0;
        let pendingPaymentsCount = 0;
        const pendingList = [];
        pendingSnap.docs.forEach(doc => {
            const data = doc.data();
            const totalAmount = data.totalAmount || data.price || 0;
            const cashAmount = data.cashAmount || 0;
            const cardAmount = data.cardAmount || 0;
            const transferAmount = data.transferAmount || 0;
            const paidAmount = data.paidAmount || (cashAmount + cardAmount + transferAmount);
            const remaining = totalAmount - paidAmount;
            if (remaining > 0) {
                pendingPaymentsTotal += remaining;
                pendingPaymentsCount++;
                pendingList.push({
                    id: doc.id,
                    customerName: data.customerName || data.fullName || '-',
                    archiveNo: data.archiveNo || data.archiveNumber || '-',
                    remaining,
                    totalAmount
                });
            }
        });

        // --- HaftalÄ±k randevu grafiÄŸi ---
        const dayNames = ['Pzt', 'Sal', 'Ã‡ar', 'Per', 'Cum', 'Cmt', 'Paz'];
        const weeklyDayCounts = [0, 0, 0, 0, 0, 0, 0];
        weekSnap.docs.forEach(doc => {
            const data = doc.data();
            let aptDate = data.appointmentDate?.toDate?.() || (data.appointmentDate ? new Date(data.appointmentDate) : null);
            if (aptDate && !isNaN(aptDate.getTime())) {
                const dayIndex = aptDate.getDay();
                const mappedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
                weeklyDayCounts[mappedIndex]++;
            }
        });
        const weeklyAppointments = dayNames.map((day, index) => ({ day, count: weeklyDayCounts[index] }));

        // --- Toplam arÅŸiv sayÄ±sÄ± ---
        const totalArchives = totalCountDoc.exists ? (totalCountDoc.data().value || 0) : monthSnap.size;

        return {
            success: true,
            data: {
                customers: {
                    daily: todaySnap.size,
                    weekly: weekSnap.size,
                    monthly: monthSnap.size,
                    total: totalArchives,
                    newThisMonth: monthSnap.size
                },
                appointments: { today: todayAppointments, pending: 0 },
                finance: {
                    dailyCash, dailyCard, dailyTransfer,
                    pendingPayments: pendingPaymentsTotal,
                    pendingPaymentsCount,
                    monthRevenue
                },
                shootTypeCounts: monthlyShootTypes,
                pendingList: pendingList.slice(0, 20),
                weeklyAppointments,
                generatedAt: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('Get dashboard summary error:', error.message);
        throw new HttpsError('internal', error.message || 'Unknown error in getDashboardSummary');
    }
});

/**
 * Get filtered stats for a specific dateRange â€” for dashboard date filter buttons
 */
exports.getFilteredStats = onCall({ memory: '256MiB' }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { dateRange = 'month' } = request.data || {};
    const { start, end } = buildDateRange(dateRange);

    const tsStart = admin.firestore.Timestamp.fromDate(start);
    const tsEnd = admin.firestore.Timestamp.fromDate(end);
    const archivesRef = dbHandler.collection('archives');

    try {
        const snap = await archivesRef
            .where('createdAt', '>=', tsStart)
            .where('createdAt', '<=', tsEnd)
            .get();

        let totalRevenue = 0;
        const shootTypeCounts = {};

        // Chart data: [{date, customers, revenue}]
        const chartMap = {};
        snap.docs.forEach(doc => {
            const data = doc.data();
            totalRevenue += data.totalAmount || data.price || 0;
            const st = data.shootType || 'DiÄŸer';
            shootTypeCounts[st] = (shootTypeCounts[st] || 0) + 1;

            const createdAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
            if (createdAt && !isNaN(createdAt.getTime())) {
                let key;
                if (dateRange === 'today') {
                    key = `${createdAt.getHours()}:00`;
                } else if (dateRange === 'year') {
                    key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
                } else {
                    key = createdAt.toISOString().split('T')[0];
                }
                if (!chartMap[key]) chartMap[key] = { customers: 0, revenue: 0 };
                chartMap[key].customers++;
                chartMap[key].revenue += data.totalAmount || data.price || 0;
            }
        });

        const chartData = Object.entries(chartMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v }));

        // Online satÄ±ÅŸlar (ayrÄ± koleksiyon)
        let onlineCount = 0;
        try {
            const onlineSnap = await dbHandler.collection('onlineOrders')
                .where('createdAt', '>=', tsStart)
                .where('createdAt', '<=', tsEnd)
                .get();
            onlineCount = onlineSnap.size;
        } catch (_) { /* koleksiyon yoksa atla */ }

        return {
            success: true,
            data: {
                customerCount: snap.size,
                totalRevenue,
                shootTypeCounts,
                onlineSalesCount: onlineCount,
                chartData,
                dateRange
            }
        };
    } catch (error) {
        console.error('getFilteredStats error:', error.message);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get today's appointments
 */
exports.getTodayAppointments = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString();

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString();

        const appointmentsRef = dbHandler.collection('appointments');
        const snapshot = await appointmentsRef
            .where('appointmentDate', '>=', todayStr)
            .where('appointmentDate', '<', tomorrowStr)
            .orderBy('appointmentDate', 'asc')
            .get();

        const appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, data: appointments };
    } catch (error) {
        console.error('Get today appointments error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get recent archives
 */
exports.getRecentArchives = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { limit = 10 } = request.data || {};

    try {
        const archivesRef = dbHandler.collection('archives');
        const snapshot = await archivesRef
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const archives = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, data: archives };
    } catch (error) {
        console.error('Get recent archives error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get monthly statistics
 */
exports.getMonthlyStats = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { year, month, period } = request.data || {};

    try {
        const currentYear = year || new Date().getFullYear();
        const currentMonth = month !== undefined ? month : new Date().getMonth();

        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        const tsMonthStart = admin.firestore.Timestamp.fromDate(monthStart);
        const tsMonthEnd = admin.firestore.Timestamp.fromDate(monthEnd);

        // Archives for this month (TEK KAYNAK)
        const archivesRef = dbHandler.collection('archives');
        const archivesSnap = await archivesRef
            .where('createdAt', '>=', tsMonthStart)
            .where('createdAt', '<=', tsMonthEnd)
            .get();

        // GÃ¼nlÃ¼k gelir dÃ¶kÃ¼mÃ¼ â€” chart iÃ§in {date, amount} dizisi
        const dailyMap = {};
        const daysInMonth = monthEnd.getDate();

        // TÃ¼m gÃ¼nleri sÄ±fÄ±rla
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            dailyMap[dateStr] = 0;
        }

        let totalRevenue = 0;
        let paidAmount = 0;

        archivesSnap.docs.forEach(doc => {
            const data = doc.data();
            const amount = data.totalAmount || data.price || 0;
            const paid = data.paidAmount || (data.cashAmount || 0) + (data.cardAmount || 0) + (data.transferAmount || 0);

            totalRevenue += amount;
            paidAmount += paid;

            // GÃ¼nlÃ¼k gruplama
            const createdAt = data.createdAt?.toDate?.()
                || (data.createdAt ? new Date(data.createdAt) : null);

            if (createdAt) {
                const dateStr = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
                if (dailyMap[dateStr] !== undefined) {
                    dailyMap[dateStr] += amount;
                }
            }
        });

        // Chart verisi: [{date, amount}]
        const chartData = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, amount]) => ({ date, amount }));

        return {
            success: true,
            data: chartData
        };
    } catch (error) {
        console.error('Get monthly stats error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get calendar view (appointments and shoots for a date range)
 */
exports.getCalendarView = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { startDate, endDate } = request.data || {};

    if (!startDate || !endDate) {
        throw new HttpsError('invalid-argument', 'startDate and endDate are required');
    }

    try {
        // Convert string dates to proper Timestamps for Firestore queries
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const tsStart = admin.firestore.Timestamp.fromDate(start);
        const tsEnd = admin.firestore.Timestamp.fromDate(end);

        const appointmentsRef = dbHandler.collection('appointments');
        const appointmentsSnapshot = await appointmentsRef
            .where('appointmentDate', '>=', tsStart)
            .where('appointmentDate', '<=', tsEnd)
            .orderBy('appointmentDate', 'asc')
            .get();

        const shootsRef = dbHandler.collection('shoots');
        const shootsSnapshot = await shootsRef
            .where('shootDate', '>=', startDate)
            .where('shootDate', '<=', endDate)
            .orderBy('shootDate', 'asc')
            .get();

        const appointments = appointmentsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                type: 'appointment',
                ...data,
                // Serialize Timestamps to ISO strings for frontend compatibility
                appointmentDate: data.appointmentDate?.toDate?.()?.toISOString() || data.appointmentDate,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
                importedAt: data.importedAt?.toDate?.()?.toISOString() || data.importedAt
            };
        });

        const shoots = shootsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'shoot',
            ...doc.data()
        }));

        return {
            success: true,
            data: {
                appointments,
                shoots,
                combined: [...appointments, ...shoots].sort((a, b) => {
                    const dateA = new Date(a.appointmentDate || a.shootDate);
                    const dateB = new Date(b.appointmentDate || b.shootDate);
                    return dateA - dateB;
                })
            }
        };
    } catch (error) {
        console.error('Get calendar view error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get available time slots for a specific date
 */
exports.getAvailableSlots = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { date, duration = 60 } = request.data || {};

    if (!date) {
        throw new HttpsError('invalid-argument', 'date is required');
    }

    try {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const appointmentsRef = dbHandler.collection('appointments');
        const appointmentsSnapshot = await appointmentsRef
            .where('appointmentDate', '>=', dayStart.toISOString())
            .where('appointmentDate', '<=', dayEnd.toISOString())
            .get();

        const shootsRef = dbHandler.collection('shoots');
        const shootsSnapshot = await shootsRef
            .where('shootDate', '>=', dayStart.toISOString())
            .where('shootDate', '<=', dayEnd.toISOString())
            .get();

        // Working hours: 9 AM - 6 PM
        const workStart = 9;
        const workEnd = 18;
        const slotDuration = duration;

        const allSlots = [];
        for (let hour = workStart; hour < workEnd; hour++) {
            for (let minute = 0; minute < 60; minute += slotDuration) {
                const slotTime = new Date(date);
                slotTime.setHours(hour, minute, 0, 0);
                allSlots.push({
                    time: slotTime.toISOString(),
                    hour,
                    minute,
                    available: true
                });
            }
        }

        const occupiedSlots = [];

        appointmentsSnapshot.docs.forEach(doc => {
            const apt = doc.data();
            occupiedSlots.push({
                start: new Date(apt.appointmentDate),
                duration: apt.duration || 60
            });
        });

        shootsSnapshot.docs.forEach(doc => {
            const shoot = doc.data();
            occupiedSlots.push({
                start: new Date(shoot.shootDate),
                duration: shoot.estimatedDuration || 120
            });
        });

        const availableSlots = allSlots.filter(slot => {
            const slotStart = new Date(slot.time);
            const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

            return !occupiedSlots.some(occupied => {
                const occupiedStart = occupied.start;
                const occupiedEnd = new Date(occupiedStart.getTime() + occupied.duration * 60000);
                return (slotStart < occupiedEnd && slotEnd > occupiedStart);
            });
        });

        return {
            success: true,
            data: {
                date,
                availableSlots: availableSlots.map(s => s.time),
                totalSlots: allSlots.length,
                availableCount: availableSlots.length
            }
        };
    } catch (error) {
        console.error('Get available slots error:', error);
        throw new HttpsError('internal', error.message);
    }
});
