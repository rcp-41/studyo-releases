/**
 * E6 — Real Revenue Dashboard
 * Callable: getRevenueDashboard({ from, to, groupBy: 'studio'|'plan'|'month' })
 * Source: collectionGroup `payments` under organizations/{orgId}/studios/{sId}/payments
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

function assertCreator(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');
}

exports.getRevenueDashboard = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const {
        from,
        to,
        groupBy = 'month',
    } = request.data || {};

    const fromDate = from ? new Date(from) : new Date(Date.now() - 365 * 86400000);
    const toDate = to ? new Date(to) : new Date();

    const fromTs = admin.firestore.Timestamp.fromDate(fromDate);
    const toTs = admin.firestore.Timestamp.fromDate(toDate);

    // CollectionGroup query across all studios
    let query = db.collectionGroup('payments')
        .where('createdAt', '>=', fromTs)
        .where('createdAt', '<=', toTs)
        .orderBy('createdAt', 'asc');

    const snap = await query.get();

    let total = 0;
    const breakdown = {};
    const monthlyTotals = {};
    const studioTotals = {};
    const planTotals = {};

    for (const doc of snap.docs) {
        const data = doc.data();
        const amount = typeof data.amount === 'number' ? data.amount : 0;
        const currency = data.currency || 'TRY';
        // Only sum TRY for now; multi-currency TODO
        if (currency !== 'TRY') continue;

        total += amount;

        // Studio breakdown — path: orgs/{o}/studios/{s}/payments/{p}
        const pathParts = doc.ref.path.split('/');
        const studioId = pathParts[3] || 'unknown';
        studioTotals[studioId] = (studioTotals[studioId] || 0) + amount;

        // Plan breakdown
        const plan = data.plan || 'unknown';
        planTotals[plan] = (planTotals[plan] || 0) + amount;

        // Monthly breakdown
        const ts = data.createdAt?.toDate?.() || new Date(data.createdAt);
        const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amount;
    }

    // Build grouped breakdown per requested dimension
    let breakdownResult = {};
    if (groupBy === 'studio') breakdownResult = studioTotals;
    else if (groupBy === 'plan') breakdownResult = planTotals;
    else breakdownResult = monthlyTotals;

    // Growth %: compare last two months in monthly data
    const months = Object.keys(monthlyTotals).sort();
    let growth = null;
    if (months.length >= 2) {
        const prev = monthlyTotals[months[months.length - 2]] || 0;
        const curr = monthlyTotals[months[months.length - 1]] || 0;
        growth = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;
    }

    // Top 10 studios by revenue
    const top10Studios = Object.entries(studioTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([studioId, amount]) => ({ studioId, amount }));

    return {
        total,
        currency: 'TRY',
        groupBy,
        breakdown: breakdownResult,
        monthly: monthlyTotals,
        top10Studios,
        growthPercent: growth,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        count: snap.size,
    };
});
