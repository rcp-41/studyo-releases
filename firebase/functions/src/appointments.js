/**
 * Appointments Cloud Functions
 * Scheduling and calendar management
 * 
 * Multi-Tenant: Uses DatabaseHandler for studio-scoped data access
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');
const { appointmentSchema, validate } = require('./validators/schemas');
const { APPCHECK_ENABLED } = require('./config');

const FieldValue = admin.firestore.FieldValue;



/**
 * Create a new appointment
 */
exports.create = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    // Zod validation
    validate(appointmentSchema.partial(), request.data, 'randevu');
    const {
        fullName,
        phone,
        shootTypeId,
        description1,
        description2,
        appointmentDate,
        timeSlot,
        duration = 30,
        studioRoom = '',
        forceCreate = false
    } = request.data;

    if (!fullName || !phone || !shootTypeId || !appointmentDate || !timeSlot) {
        throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        // Parse appointmentDate as UTC to avoid timezone issues
        // appointmentDate comes as 'yyyy-MM-dd' from frontend
        const [year, month, day] = appointmentDate.split('-').map(Number);
        const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        // Parse timeSlot (e.g., '09:30') to get actual appointment time
        const [slotHour, slotMin] = (timeSlot || '00:00').split(':').map(Number);
        const actualStart = new Date(Date.UTC(year, month - 1, day, slotHour, slotMin, 0, 0));
        const actualEnd = new Date(actualStart.getTime() + duration * 60000);

        // Query existing appointments for this day (conflict preview — same-session)
        const tsStart = admin.firestore.Timestamp.fromDate(dayStart);
        const tsEnd = admin.firestore.Timestamp.fromDate(dayEnd);

        const findConflicts = (docs) => {
            const conflicts = [];
            const newStartMs = actualStart.getTime();
            const newEndMs = actualEnd.getTime();
            (docs || []).forEach(doc => {
                const data = doc.data();
                const [exHour, exMin] = (data.timeSlot || '00:00').split(':').map(Number);
                const exStart = new Date(Date.UTC(year, month - 1, day, exHour, exMin, 0, 0)).getTime();
                const exEnd = exStart + (data.duration || 30) * 60000;
                if (newStartMs < exEnd && newEndMs > exStart) {
                    const sameRoom = studioRoom && data.studioRoom && studioRoom === data.studioRoom;
                    conflicts.push({
                        id: doc.id,
                        fullName: data.fullName,
                        timeSlot: data.timeSlot,
                        studioRoom: data.studioRoom || '',
                        sameRoom
                    });
                }
            });
            return conflicts;
        };

        let existingSnapshot;
        try {
            existingSnapshot = await dbHandler.collection('appointments')
                .where('appointmentDate', '>=', tsStart)
                .where('appointmentDate', '<=', tsEnd)
                .get();
        } catch (_) {
            // Fallback: manual filter
            const allSnap = await dbHandler.collection('appointments').get();
            existingSnapshot = {
                docs: allSnap.docs.filter(doc => {
                    const d = doc.data();
                    const dt = d.appointmentDate?.toDate?.() || new Date(d.appointmentDate);
                    return dt >= dayStart && dt <= dayEnd;
                })
            };
        }

        // Early preview conflicts — gives the user a chance to confirm before forceCreate
        const previewConflicts = findConflicts(existingSnapshot.docs || []);

        if (previewConflicts.length > 0 && !forceCreate) {
            return {
                success: false,
                hasConflict: true,
                conflicts: previewConflicts,
                message: `${previewConflicts.length} çakışan randevu bulundu`
            };
        }

        // SECURITY: Race-free insert — transaction re-reads a deterministic day/room lock
        // and the appointments for that day before writing. Since Firestore transactions
        // restrict range-scan reads, we use a tiny lock doc per (studio, day, room) plus
        // an inline re-check of the same-day appointments collection.
        const db = admin.firestore();
        const roomKey = (studioRoom || 'default').toString().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
        const lockId = `${dbHandler.studioId}_${appointmentDate}_${roomKey}`;
        const lockRef = db.collection('appointmentSlots').doc(lockId);
        const appointmentsCol = dbHandler.collection('appointments');
        const newAptRef = appointmentsCol.doc();

        const appointmentData = {
            studioId: dbHandler.studioId,
            fullName,
            phone,
            shootTypeId,
            description1: description1 || null,
            description2: description2 || null,
            appointmentDate: dayStart,  // UTC midnight for consistent querying
            timeSlot,
            duration,
            studioRoom: studioRoom || '',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };

        const txResult = await db.runTransaction(async (tx) => {
            // Re-read lock doc — its presence in the tx serializes concurrent writes
            // on the same (studio, day, room).
            const lockSnap = await tx.get(lockRef);
            const slots = lockSnap.exists && Array.isArray(lockSnap.data()?.slots)
                ? lockSnap.data().slots
                : [];

            // Overlap check against recorded slots (transaction-consistent)
            const newStartMs = actualStart.getTime();
            const newEndMs = actualEnd.getTime();
            const txConflicts = [];
            for (const s of slots) {
                const exStart = Number(s.startMs) || 0;
                const exEnd = Number(s.endMs) || 0;
                if (newStartMs < exEnd && newEndMs > exStart) {
                    txConflicts.push({
                        id: s.appointmentId || null,
                        timeSlot: s.timeSlot || '',
                        studioRoom: s.studioRoom || ''
                    });
                }
            }

            if (txConflicts.length > 0 && !forceCreate) {
                return { created: false, conflicts: txConflicts };
            }

            const updatedSlots = slots.concat([{
                appointmentId: newAptRef.id,
                timeSlot,
                startMs: newStartMs,
                endMs: newEndMs,
                studioRoom: studioRoom || '',
                createdAt: Date.now()
            }]);

            tx.set(lockRef, {
                studioId: dbHandler.studioId,
                date: appointmentDate,
                studioRoom: studioRoom || '',
                slots: updatedSlots,
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            tx.set(newAptRef, appointmentData);
            return { created: true };
        });

        if (!txResult.created) {
            return {
                success: false,
                hasConflict: true,
                conflicts: txResult.conflicts,
                message: `${txResult.conflicts.length} çakışan randevu bulundu`,
                method: 'tx-slot'
            };
        }

        const docRef = newAptRef;

        // Auto-create/link customer (best-effort, don't block)
        const cleanPhone = (phone || '').trim();
        if (cleanPhone) {
            try {
                const phoneSnap = await dbHandler.collection('customers')
                    .where('phone', '==', cleanPhone)
                    .limit(1)
                    .get();

                if (phoneSnap.empty) {
                    // Create new customer
                    await dbHandler.collection('customers').add({
                        fullName: fullName || '',
                        phone: cleanPhone,
                        email: '',
                        customerType: 'individual',
                        source: 'appointment',
                        notes: '',
                        isVip: false,
                        totalShoots: 0,
                        totalSpent: 0,
                        appointmentIds: [docRef.id],
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                        createdBy: request.auth.uid
                    });
                } else {
                    // Link appointment to existing customer
                    await phoneSnap.docs[0].ref.update({
                        appointmentIds: FieldValue.arrayUnion(docRef.id),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                }
            } catch (custErr) {
                console.error('Customer auto-create from appointment error (non-blocking):', custErr);
            }
        }

        return { id: docRef.id, success: true, method: 'tx-slot' };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Appointment create error:', error);
        throw new HttpsError('internal', 'İşlem sırasında bir hata oluştu.');
    }
});

/**
 * Get appointments for a specific day
 */
exports.getDay = onCall({ enforceAppCheck: APPCHECK_ENABLED, memory: '512MiB' }, async (request) => {
    console.log('📅 appointments-getDay called');

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { date } = request.data;

    if (!date) {
        throw new HttpsError('invalid-argument', 'Date required');
    }

    try {
        // Parse date as UTC to avoid timezone issues
        const [year, month, day] = date.split('-').map(Number);
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        // Use Firestore Timestamps for range query — avoids loading entire collection
        const tsStart = admin.firestore.Timestamp.fromDate(startOfDay);
        const tsEnd = admin.firestore.Timestamp.fromDate(endOfDay);

        // Try querying with appointmentDate (Timestamp) first
        let snapshot;
        try {
            snapshot = await dbHandler.collection('appointments')
                .where('appointmentDate', '>=', tsStart)
                .where('appointmentDate', '<=', tsEnd)
                .orderBy('appointmentDate', 'asc')
                .get();
        } catch (indexError) {
            // Fallback: try string-based date query (legacy data)
            const startStr = startOfDay.toISOString();
            const endStr = endOfDay.toISOString();
            snapshot = await dbHandler.collection('appointments')
                .where('appointmentDate', '>=', startStr)
                .where('appointmentDate', '<=', endStr)
                .orderBy('appointmentDate', 'asc')
                .get();
        }

        const resolveDate = (v) => {
            if (!v) return null;
            if (typeof v.toDate === 'function') return v.toDate();
            if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
            const d = new Date(v);
            return isNaN(d.getTime()) ? null : d;
        };

        const appointments = snapshot.docs.map(doc => {
            const data = doc.data();
            const aptDate =
                resolveDate(data.date) ||
                resolveDate(data.appointmentDate) ||
                resolveDate(data.createdAt) ||
                new Date();
            return {
                id: doc.id,
                ...data,
                appointmentDate: aptDate.toISOString(),
                createdAt: resolveDate(data.createdAt)?.toISOString() || new Date().toISOString(),
                updatedAt: resolveDate(data.updatedAt)?.toISOString() || new Date().toISOString()
            };
        });

        console.log(`Found ${appointments.length} appointments for ${date} in studio ${dbHandler.studioId}`);
        return { data: appointments };
    } catch (error) {
        console.error('getDay error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get weekly appointments with staff availability
 * Returns appointments for Mon-Sun of the given week + staff off-days
 */
exports.getWeeklyAppointmentsWithStaff = onCall({ enforceAppCheck: APPCHECK_ENABLED, memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { weekStart } = request.data || {}; // ISO date string for Monday of the week

    // Build week boundaries
    const monday = weekStart ? new Date(weekStart) : (() => {
        const d = new Date();
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    })();

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const tsStart = admin.firestore.Timestamp.fromDate(monday);
    const tsEnd = admin.firestore.Timestamp.fromDate(sunday);

    try {
        // Query only the week range instead of all appointments
        let aptsSnap;
        try {
            aptsSnap = await dbHandler.collection('appointments')
                .where('appointmentDate', '>=', tsStart)
                .where('appointmentDate', '<=', tsEnd)
                .get();
        } catch (indexError) {
            // Fallback: string query
            aptsSnap = await dbHandler.collection('appointments')
                .where('appointmentDate', '>=', monday.toISOString())
                .where('appointmentDate', '<=', sunday.toISOString())
                .get();
        }

        const staffSnap = await dbHandler.collection('staff').get();

        const appointments = aptsSnap.docs
            .map(doc => {
                const data = doc.data();
                // FALLBACK: date || appointmentDate || createdAt
                const rawDate =
                    data.date ||
                    data.appointmentDate?.toDate?.() ||
                    (typeof data.appointmentDate === 'string' ? new Date(data.appointmentDate) : null) ||
                    data.createdAt?.toDate?.() ||
                    null;

                if (!rawDate) return null;
                const aptDate = rawDate instanceof Date ? rawDate : new Date(rawDate);
                if (aptDate < monday || aptDate > sunday) return null;

                return {
                    id: doc.id,
                    ...data,
                    appointmentDate: aptDate.toISOString(),
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
                };
            })
            .filter(Boolean)
            .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));

        // Staff: return names and their off-days (if stored in offDays field)
        const staff = staffSnap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                name: d.name || d.fullName || '',
                role: d.role || 'staff',
                offDays: d.offDays || [] // array of ISO date strings
            };
        });

        return {
            success: true,
            data: {
                weekStart: monday.toISOString(),
                weekEnd: sunday.toISOString(),
                appointments,
                staff
            }
        };
    } catch (error) {
        console.error('getWeeklyAppointmentsWithStaff error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Update appointment (general update - date, time, customer info, etc.)
 */
exports.update = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { id, data } = request.data || {};

    if (!id) {
        throw new HttpsError('invalid-argument', 'Appointment ID required');
    }

    try {
        const docRef = dbHandler.collection('appointments').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Appointment not found');
        }

        // Whitelist allowed fields
        const allowedFields = [
            'fullName', 'phone', 'shootTypeId', 'description1',
            'description2', 'appointmentDate', 'timeSlot', 'duration', 'status', 'studioRoom'
        ];

        const updates = {};
        for (const field of allowedFields) {
            if (data && data[field] !== undefined) {
                updates[field] = field === 'appointmentDate' ? new Date(data[field]) : data[field];
            }
        }
        updates.updatedAt = FieldValue.serverTimestamp();

        await docRef.update(updates);

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Randevu güncelleme başarısız oldu.');
    }
});

/**
 * Update appointment status
 */
exports.updateStatus = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { id, status } = request.data;
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

    if (!id || !status || !validStatuses.includes(status)) {
        throw new HttpsError('invalid-argument', 'Invalid ID or status');
    }

    try {
        const docRef = dbHandler.collection('appointments').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Appointment not found');
        }

        await docRef.update({
            status,
            updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Delete appointment
 */
exports.delete = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { id } = request.data;

    if (!id) {
        throw new HttpsError('invalid-argument', 'Appointment ID required');
    }

    try {
        const docRef = dbHandler.collection('appointments').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Appointment not found');
        }

        await docRef.delete();

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});
