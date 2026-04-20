/**
 * Finance Cloud Functions
 * Payments, daily cash, expenses, overdue tracking
 *
 * Multi-Tenant: Uses DatabaseHandler for studio-scoped data access
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');
const { expenseSchema, validate } = require('./validators/schemas');

const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// Money helpers — sum/compare in integer cents to avoid float drift.
// Storage stays as decimal TRY for backward compatibility.
const toCents = (amount) => Math.round(Number(amount || 0) * 100);
const fromCents = (cents) => cents / 100;

// Helper: normalize any date value (Timestamp, string, Date) to ISO string
const toISOString = (val) => {
    if (!val) return new Date().toISOString();
    if (val.toDate) return val.toDate().toISOString(); // Firestore Timestamp
    if (val instanceof Date) return val.toISOString();
    return String(val);
};

// Helper: check if user has finance access (admin or creator)
const isFinanceAuthorized = (request) => {
    const role = request.auth?.token?.role;
    return role === 'admin' || role === 'creator';
};

// Helper: get date range boundaries
const getDateRange = (range) => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start;
    switch (range) {
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
        case 'month':
        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
    }
    return { start, end };
};

/**
 * Get payments for a date range
 */
exports.getPayments = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (!isFinanceAuthorized(request)) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { range = 'month' } = request.data || {};
    const { start, end } = getDateRange(range);

    try {
        // Query with Timestamps (legacy data uses Timestamps)
        const tsStart = Timestamp.fromDate(start);
        const tsEnd = Timestamp.fromDate(end);

        const [tsSnap, isoSnap] = await Promise.all([
            dbHandler.collection('payments')
                .where('date', '>=', tsStart)
                .where('date', '<=', tsEnd)
                .orderBy('date', 'desc')
                .get(),
            dbHandler.collection('payments')
                .where('date', '>=', start.toISOString())
                .where('date', '<=', end.toISOString())
                .orderBy('date', 'desc')
                .get()
        ]);

        // Merge and deduplicate
        const seen = new Set();
        const payments = [];
        for (const snap of [tsSnap, isoSnap]) {
            for (const doc of snap.docs) {
                if (seen.has(doc.id)) continue;
                seen.add(doc.id);
                const data = doc.data();
                payments.push({
                    id: doc.id,
                    ...data,
                    date: toISOString(data.date)
                });
            }
        }

        // Sort descending by date
        payments.sort((a, b) => new Date(b.date) - new Date(a.date));

        return { payments };
    } catch (error) {
        console.error('getPayments error:', error);
        throw new HttpsError('internal', 'Ödeme listesi alınamadı.');
    }
});

/**
 * Get daily cash summary
 */
exports.getDailyCash = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (!isFinanceAuthorized(request)) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { date } = request.data || {};
    const targetDate = date || new Date().toISOString().split('T')[0];

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    try {
        // Get opening balance for this day
        const balanceDoc = await dbHandler.collection('dailyBalances').doc(targetDate).get();
        const openingBalance = balanceDoc.exists ? (balanceDoc.data().openingBalance || 0) : 0;

        // Get payments for the day (support both Timestamp and ISO string formats)
        const tsStart = Timestamp.fromDate(dayStart);
        const tsEnd = Timestamp.fromDate(dayEnd);

        const [tsSnap, isoSnap] = await Promise.all([
            dbHandler.collection('payments')
                .where('date', '>=', tsStart)
                .where('date', '<=', tsEnd)
                .get(),
            dbHandler.collection('payments')
                .where('date', '>=', dayStart.toISOString())
                .where('date', '<=', dayEnd.toISOString())
                .get()
        ]);

        const seen = new Set();

        // Sum in integer cents to avoid float drift
        let cashCents = 0, cardCents = 0, transferCents = 0;
        for (const snap of [tsSnap, isoSnap]) {
            for (const doc of snap.docs) {
                if (seen.has(doc.id)) continue;
                seen.add(doc.id);
                const p = doc.data();
                const cents = toCents(p.amount);
                switch (p.method) {
                    case 'cash': cashCents += cents; break;
                    case 'credit_card': cardCents += cents; break;
                    case 'transfer': transferCents += cents; break;
                }
            }
        }

        const [expTsSnap, expIsoSnap] = await Promise.all([
            dbHandler.collection('expenses')
                .where('date', '>=', tsStart)
                .where('date', '<=', tsEnd)
                .get(),
            dbHandler.collection('expenses')
                .where('date', '>=', dayStart.toISOString())
                .where('date', '<=', dayEnd.toISOString())
                .get()
        ]);

        const expSeen = new Set();
        let totalExpensesCents = 0;
        for (const snap of [expTsSnap, expIsoSnap]) {
            for (const doc of snap.docs) {
                if (expSeen.has(doc.id)) continue;
                expSeen.add(doc.id);
                totalExpensesCents += toCents(doc.data().amount);
            }
        }

        return {
            openingBalance,
            cashIncome: fromCents(cashCents),
            cardIncome: fromCents(cardCents),
            transferIncome: fromCents(transferCents),
            totalExpenses: fromCents(totalExpensesCents)
        };
    } catch (error) {
        console.error('getDailyCash error:', error);
        throw new HttpsError('internal', 'Günlük kasa bilgisi alınamadı.');
    }
});

/**
 * Set opening balance for a day
 */
exports.setOpeningBalance = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (!isFinanceAuthorized(request)) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { date, openingBalance } = request.data || {};

    if (!date || openingBalance === undefined) {
        throw new HttpsError('invalid-argument', 'date and openingBalance are required');
    }

    try {
        await dbHandler.collection('dailyBalances').doc(date).set({
            openingBalance: Number(openingBalance),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid
        }, { merge: true });

        return { success: true };
    } catch (error) {
        console.error('setOpeningBalance error:', error);
        throw new HttpsError('internal', 'Açılış bakiyesi güncellenemedi.');
    }
});

/**
 * Get expenses for a date range
 */
exports.getExpenses = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (!isFinanceAuthorized(request)) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { range = 'month' } = request.data || {};
    const { start, end } = getDateRange(range);

    try {
        // Query with both Timestamps and ISO strings
        const tsStart = Timestamp.fromDate(start);
        const tsEnd = Timestamp.fromDate(end);

        const [tsSnap, isoSnap] = await Promise.all([
            dbHandler.collection('expenses')
                .where('date', '>=', tsStart)
                .where('date', '<=', tsEnd)
                .orderBy('date', 'desc')
                .get(),
            dbHandler.collection('expenses')
                .where('date', '>=', start.toISOString())
                .where('date', '<=', end.toISOString())
                .orderBy('date', 'desc')
                .get()
        ]);

        const seen = new Set();
        const expenses = [];
        for (const snap of [tsSnap, isoSnap]) {
            for (const doc of snap.docs) {
                if (seen.has(doc.id)) continue;
                seen.add(doc.id);
                const data = doc.data();
                expenses.push({
                    id: doc.id,
                    ...data,
                    date: toISOString(data.date)
                });
            }
        }
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        return { expenses };
    } catch (error) {
        console.error('getExpenses error:', error);
        throw new HttpsError('internal', 'Gider listesi alınamadı.');
    }
});

/**
 * Add a new expense
 */
exports.addExpense = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (!isFinanceAuthorized(request)) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    // Zod validation
    const validated = validate(expenseSchema, request.data || {}, 'gider');
    const { date, category, subCategory, description, amount, note } = validated;

    if (category === 'other' && !description) {
        throw new HttpsError('invalid-argument', '"Diğer" kategorisinde açıklama zorunludur');
    }

    try {
        const expenseData = {
            date,
            category,
            subCategory: subCategory || '',
            description: description || '',
            amount: Number(amount),
            note: note || '',
            createdBy: request.auth.uid,
            createdAt: FieldValue.serverTimestamp()
        };

        const docRef = await dbHandler.collection('expenses').add(expenseData);

        return { id: docRef.id, success: true };
    } catch (error) {
        console.error('addExpense error:', error);
        throw new HttpsError('internal', 'Gider kaydedilemedi.');
    }
});

/**
 * Get cash register entries for a specific date
 * Kayıtsız işlemler: Amatör baskı, biyometrik çoğaltma, çerçeve vb.
 * Supports both income and expense entries.
 */
exports.getCashRegisterEntries = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { date } = request.data || {};
    const targetDate = date || new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul' }).split(' ')[0];

    // Turkey is UTC+3, so midnight in Turkey = 21:00 UTC previous day
    const dayStart = new Date(targetDate + 'T00:00:00+03:00');
    const dayEnd = new Date(targetDate + 'T23:59:59.999+03:00');

    const tsStart = admin.firestore.Timestamp.fromDate(dayStart);
    const tsEnd = admin.firestore.Timestamp.fromDate(dayEnd);

    try {
        const snap = await dbHandler.collection('cashEntries')
            .where('createdAt', '>=', tsStart)
            .where('createdAt', '<=', tsEnd)
            .orderBy('createdAt', 'desc')
            .get();

        const entries = [];
        // Sum in integer cents to avoid float drift
        const summaryCents = { cash: 0, card: 0, transfer: 0, total: 0, totalIncome: 0, totalExpense: 0 };

        snap.docs.forEach(doc => {
            const d = doc.data();
            const direction = d.direction || 'income';
            const items = (d.items || []).map(item => ({
                type: item.type || '',
                description: item.description || '',
                totalPrice: Number(item.totalPrice) || 0,
                paymentMethod: item.paymentMethod || 'cash',
                date: item.date || '',
                category: item.category || ''
            }));

            const entry = {
                id: doc.id,
                items,
                direction,
                totalAmount: Number(d.totalAmount) || 0,
                note: d.note || '',
                operatorId: d.operatorId || '',
                syncedId: d.syncedPaymentId || d.syncedExpenseId || null,
                createdAt: d.createdAt?.toDate?.()?.toISOString() || null
            };
            entries.push(entry);

            const amountCents = toCents(entry.totalAmount);
            if (direction === 'income') {
                summaryCents.totalIncome += amountCents;
                if (items.length > 0) {
                    const method = items[0].paymentMethod;
                    if (method === 'cash') summaryCents.cash += amountCents;
                    else if (method === 'credit_card') summaryCents.card += amountCents;
                    else if (method === 'transfer') summaryCents.transfer += amountCents;
                }
            } else {
                summaryCents.totalExpense += amountCents;
            }
            summaryCents.total += (direction === 'income' ? amountCents : -amountCents);
        });

        const summary = {
            cash: fromCents(summaryCents.cash),
            card: fromCents(summaryCents.card),
            transfer: fromCents(summaryCents.transfer),
            total: fromCents(summaryCents.total),
            totalIncome: fromCents(summaryCents.totalIncome),
            totalExpense: fromCents(summaryCents.totalExpense)
        };

        return { entries, summary, date: targetDate };
    } catch (error) {
        console.error('getCashRegisterEntries error:', error);
        throw new HttpsError('internal', 'Kasa kayıtları alınamadı.');
    }
});

/**
 * Create a cash register entry (kayıtsız işlem)
 * Supports both income and expense directions.
 * Income entries sync to 'payments' collection.
 * Expense entries sync to 'expenses' collection.
 */
exports.createCashEntry = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { items, note, direction = 'income' } = request.data || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new HttpsError('invalid-argument', 'items array required');
    }
    if (direction !== 'income' && direction !== 'expense') {
        throw new HttpsError('invalid-argument', 'direction must be income or expense');
    }

    // Sum in integer cents to avoid float drift
    const totalAmountCents = items.reduce((sum, item) => sum + toCents(item.totalPrice), 0);
    const totalAmount = fromCents(totalAmountCents);
    const firstItem = items[0] || {};
    const itemDate = firstItem.date || new Date().toISOString().split('T')[0];

    try {
        console.log('[createCashEntry] direction:', direction, 'totalAmount:', totalAmount, 'itemDate:', itemDate);
        console.log('[createCashEntry] firstItem:', JSON.stringify(firstItem));
        console.log('[createCashEntry] studioId:', dbHandler.studioId);

        const cashEntryData = {
            items,
            totalAmount,
            direction,
            note: note || '',
            operatorId: request.auth.uid,
            createdAt: FieldValue.serverTimestamp()
        };

        // Sync to finance collection based on direction
        if (direction === 'income') {
            const paymentData = {
                source: 'cashRegister',
                customerName: firstItem.description || firstItem.type || 'Kayıtsız İşlem',
                archiveNumber: '',
                amount: totalAmount,
                method: firstItem.paymentMethod || 'cash',
                note: note || '',
                date: new Date(itemDate + 'T12:00:00+03:00').toISOString(),
                createdBy: request.auth.uid,
                createdAt: FieldValue.serverTimestamp()
            };
            console.log('[createCashEntry] Syncing INCOME to payments:', JSON.stringify(paymentData));
            const paymentRef = await dbHandler.collection('payments').add(paymentData);
            cashEntryData.syncedPaymentId = paymentRef.id;
            console.log('[createCashEntry] Synced payment ID:', paymentRef.id);
        } else {
            const expenseData = {
                source: 'cashRegister',
                date: new Date(itemDate + 'T12:00:00+03:00').toISOString(),
                category: firstItem.category || 'other',
                subCategory: '',
                description: firstItem.description || firstItem.type || 'Kasa Gideri',
                amount: totalAmount,
                note: note || '',
                createdBy: request.auth.uid,
                createdAt: FieldValue.serverTimestamp()
            };
            console.log('[createCashEntry] Syncing EXPENSE to expenses:', JSON.stringify(expenseData));
            const expenseRef = await dbHandler.collection('expenses').add(expenseData);
            cashEntryData.syncedExpenseId = expenseRef.id;
            console.log('[createCashEntry] Synced expense ID:', expenseRef.id);
        }

        const docRef = await dbHandler.collection('cashEntries').add(cashEntryData);
        console.log('[createCashEntry] Created cashEntry ID:', docRef.id, 'with syncedPaymentId:', cashEntryData.syncedPaymentId || 'none', 'syncedExpenseId:', cashEntryData.syncedExpenseId || 'none');

        return { success: true, id: docRef.id, totalAmount };
    } catch (error) {
        console.error('createCashEntry error:', error);
        throw new HttpsError('internal', 'Kasa kaydı oluşturulamadı.');
    }
});

/**
 * Update a cash register entry
 * Also updates the synced payment/expense record.
 */
exports.updateCashEntry = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { id, items, note, direction } = request.data || {};

    if (!id) throw new HttpsError('invalid-argument', 'Entry ID required');
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new HttpsError('invalid-argument', 'items array required');
    }

    // Sum in integer cents to avoid float drift
    const totalAmountCents = items.reduce((sum, item) => sum + toCents(item.totalPrice), 0);
    const totalAmount = fromCents(totalAmountCents);
    const firstItem = items[0] || {};
    const itemDate = firstItem.date || new Date().toISOString().split('T')[0];

    try {
        // Read existing entry to get synced IDs
        const existingDoc = await dbHandler.collection('cashEntries').doc(id).get();
        const existing = existingDoc.exists ? existingDoc.data() : {};
        const existingDirection = existing.direction || 'income';
        const effectiveDirection = direction || existingDirection;

        const updateData = {
            items,
            totalAmount,
            direction: effectiveDirection,
            note: note || '',
            updatedAt: FieldValue.serverTimestamp()
        };

        // If direction changed, delete old synced record and create new one
        if (existingDirection !== effectiveDirection) {
            // Delete old synced record
            if (existing.syncedPaymentId) {
                await dbHandler.collection('payments').doc(existing.syncedPaymentId).delete().catch(() => { });
                updateData.syncedPaymentId = admin.firestore.FieldValue.delete();
            }
            if (existing.syncedExpenseId) {
                await dbHandler.collection('expenses').doc(existing.syncedExpenseId).delete().catch(() => { });
                updateData.syncedExpenseId = admin.firestore.FieldValue.delete();
            }
            // Create new synced record
            if (effectiveDirection === 'income') {
                const paymentRef = await dbHandler.collection('payments').add({
                    source: 'cashRegister',
                    customerName: firstItem.description || firstItem.type || 'Kayıtsız İşlem',
                    archiveNumber: '',
                    amount: totalAmount,
                    method: firstItem.paymentMethod || 'cash',
                    note: note || '',
                    date: new Date(itemDate + 'T12:00:00+03:00').toISOString(),
                    createdBy: request.auth.uid,
                    createdAt: FieldValue.serverTimestamp()
                });
                updateData.syncedPaymentId = paymentRef.id;
            } else {
                const expenseRef = await dbHandler.collection('expenses').add({
                    source: 'cashRegister',
                    date: new Date(itemDate + 'T12:00:00+03:00').toISOString(),
                    category: firstItem.category || 'other',
                    subCategory: '',
                    description: firstItem.description || firstItem.type || 'Kasa Gideri',
                    amount: totalAmount,
                    note: note || '',
                    createdBy: request.auth.uid,
                    createdAt: FieldValue.serverTimestamp()
                });
                updateData.syncedExpenseId = expenseRef.id;
            }
        } else {
            // Same direction — update the synced record in place
            if (effectiveDirection === 'income' && existing.syncedPaymentId) {
                await dbHandler.collection('payments').doc(existing.syncedPaymentId).update({
                    customerName: firstItem.description || firstItem.type || 'Kayıtsız İşlem',
                    amount: totalAmount,
                    method: firstItem.paymentMethod || 'cash',
                    note: note || '',
                    date: new Date(itemDate + 'T12:00:00+03:00').toISOString(),
                    updatedAt: FieldValue.serverTimestamp()
                }).catch(() => { });
            } else if (effectiveDirection === 'expense' && existing.syncedExpenseId) {
                await dbHandler.collection('expenses').doc(existing.syncedExpenseId).update({
                    category: firstItem.category || 'other',
                    description: firstItem.description || firstItem.type || 'Kasa Gideri',
                    amount: totalAmount,
                    note: note || '',
                    date: new Date(itemDate + 'T12:00:00+03:00').toISOString(),
                    updatedAt: FieldValue.serverTimestamp()
                }).catch(() => { });
            }
        }

        await dbHandler.collection('cashEntries').doc(id).update(updateData);

        return { success: true, id, totalAmount };
    } catch (error) {
        console.error('updateCashEntry error:', error);
        throw new HttpsError('internal', 'Kasa kaydı güncellenemedi.');
    }
});

/**
 * Delete a cash register entry
 * Also deletes the synced payment/expense record.
 */
exports.deleteCashEntry = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { id } = request.data || {};

    if (!id) throw new HttpsError('invalid-argument', 'Entry ID required');

    try {
        // Read existing to find synced record
        const existingDoc = await dbHandler.collection('cashEntries').doc(id).get();
        if (existingDoc.exists) {
            const existing = existingDoc.data();
            // Delete synced finance record
            if (existing.syncedPaymentId) {
                await dbHandler.collection('payments').doc(existing.syncedPaymentId).delete().catch(() => { });
            }
            if (existing.syncedExpenseId) {
                await dbHandler.collection('expenses').doc(existing.syncedExpenseId).delete().catch(() => { });
            }
        }

        await dbHandler.collection('cashEntries').doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error('deleteCashEntry error:', error);
        throw new HttpsError('internal', 'Kasa kaydı silinemedi.');
    }
});

/**
 * Get overdue payments (archives with remaining balance)
 */
exports.getOverduePayments = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (!isFinanceAuthorized(request)) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        // Get archives that have remaining balance > 0
        const snapshot = await dbHandler.collection('archives')
            .where('paymentStatus', 'in', ['partial', 'unpaid'])
            .get();

        const now = new Date();
        const overdue = [];

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const totalAmount = data.totalAmount || data.packagePrice || 0;
            const paidAmount = data.paidAmount || 0;
            // Compute remaining in integer cents to avoid float drift, then convert back
            const remainingCents = toCents(totalAmount) - toCents(paidAmount);
            const remaining = fromCents(remainingCents);

            if (remainingCents <= 0) return;

            const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt || now);
            const daysPassed = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

            overdue.push({
                id: doc.id,
                customerName: data.customerName || data.fullName || '-',
                phone: data.phone || data.customerPhone || '-',
                archiveNumber: data.archiveNumber || doc.id.substring(0, 8),
                totalAmount,
                paidAmount,
                remaining,
                daysPassed,
                createdAt: createdAt.toISOString()
            });
        });

        // Sort by days passed descending
        overdue.sort((a, b) => b.daysPassed - a.daysPassed);

        return { overdue };
    } catch (error) {
        console.error('getOverduePayments error:', error);
        throw new HttpsError('internal', 'Geciken ödemeler alınamadı.');
    }
});

/**
 * Get Finance Summary
 * Aggregates total income (by method), total expenses and net profit
 * for a given date range string: 'today' | 'week' | 'month'
 */
exports.getFinanceSummary = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (!isFinanceAuthorized(request)) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { range = 'month' } = request.data || {};
    const { start, end } = getDateRange(range);

    try {
        const [paymentsSnap, expensesSnap] = await Promise.all([
            dbHandler.collection('payments')
                .where('date', '>=', start.toISOString())
                .where('date', '<=', end.toISOString())
                .get(),
            dbHandler.collection('expenses')
                .where('date', '>=', start.toISOString())
                .where('date', '<=', end.toISOString())
                .get()
        ]);

        // Sum in integer cents to avoid float drift
        let cashCents = 0, cardCents = 0, transferCents = 0, otherCents = 0;
        paymentsSnap.docs.forEach(doc => {
            const p = doc.data();
            const cents = toCents(p.amount);
            switch (p.method) {
                case 'cash': cashCents += cents; break;
                case 'credit_card': cardCents += cents; break;
                case 'transfer': transferCents += cents; break;
                default: otherCents += cents;
            }
        });

        const totalIncomeCents = cashCents + cardCents + transferCents + otherCents;

        // Expenses grouped by category (cents)
        const expenseByCategoryCents = {};
        let totalExpensesCents = 0;
        expensesSnap.docs.forEach(doc => {
            const e = doc.data();
            const cents = toCents(e.amount);
            totalExpensesCents += cents;
            const cat = e.category || 'other';
            expenseByCategoryCents[cat] = (expenseByCategoryCents[cat] || 0) + cents;
        });

        const expenseByCategory = {};
        for (const [k, v] of Object.entries(expenseByCategoryCents)) {
            expenseByCategory[k] = fromCents(v);
        }

        return {
            success: true,
            summary: {
                range,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                income: {
                    total: fromCents(totalIncomeCents),
                    cash: fromCents(cashCents),
                    card: fromCents(cardCents),
                    transfer: fromCents(transferCents),
                    other: fromCents(otherCents)
                },
                expenses: {
                    total: fromCents(totalExpensesCents),
                    byCategory: expenseByCategory
                },
                netProfit: fromCents(totalIncomeCents - totalExpensesCents)
            }
        };
    } catch (error) {
        console.error('getFinanceSummary error:', error);
        throw new HttpsError('internal', 'Finans özeti alınamadı.');
    }
});

