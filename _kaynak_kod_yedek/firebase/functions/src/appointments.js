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

const FieldValue = admin.firestore.FieldValue;



/**
 * Create a new appointment
 */
exports.create = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
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
        // Conflict detection
        const aptDate = new Date(appointmentDate);
        const dayStart = new Date(aptDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(aptDate);
        dayEnd.setHours(23, 59, 59, 999);

        const existingSnapshot = await dbHandler.collection('appointments')
            .where('appointmentDate', '>=', dayStart)
            .where('appointmentDate', '<=', dayEnd)
            .get();

        const conflicts = [];
        const newStart = aptDate.getTime();
        const newEnd = newStart + duration * 60000;

        existingSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const existStart = (data.appointmentDate?.toDate?.() || new Date(data.appointmentDate)).getTime();
            const existEnd = existStart + (data.duration || 30) * 60000;

            if (newStart < existEnd && newEnd > existStart) {
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

        if (conflicts.length > 0 && !forceCreate) {
            return {
                success: false,
                hasConflict: true,
                conflicts,
                message: `${conflicts.length} çakışan randevu bulundu`
            };
        }

        const appointmentData = {
            studioId: dbHandler.studioId,
            fullName,
            phone,
            shootTypeId,
            description1: description1 || null,
            description2: description2 || null,
            appointmentDate: new Date(appointmentDate),
            timeSlot,
            duration,
            studioRoom: studioRoom || '',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };

        const docRef = await dbHandler.collection('appointments').add(appointmentData);

        return { id: docRef.id, success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get appointments for a specific day
 */
exports.getDay = onCall({ enforceAppCheck: false }, async (request) => {
    console.log('📅 appointments-getDay called');

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { date } = request.data;

    if (!date) {
        throw new HttpsError('invalid-argument', 'Date required');
    }

    try {
        const snapshot = await dbHandler.collection('appointments').get();

        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const resolveDate = (v) => {
            if (!v) return null;
            if (typeof v.toDate === 'function') return v.toDate();
            if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
            const d = new Date(v);
            return isNaN(d.getTime()) ? null : d;
        };

        const appointments = snapshot.docs
            .map(doc => {
                const data = doc.data();
                // FALLBACK: date → appointmentDate → createdAt → now
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
            })
            .filter(apt => {
                const aptTime = new Date(apt.appointmentDate).getTime();
                return aptTime >= startOfDay.getTime() && aptTime <= endOfDay.getTime();
            })
            .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));

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
exports.getWeeklyAppointmentsWithStaff = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
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
        // Get all appointments for the week (using appointmentDate Timestamp field)
        const [aptsSnap, staffSnap] = await Promise.all([
            dbHandler.collection('appointments').get(), // Fetch all, filter client-side (legacy support)
            dbHandler.collection('staff').get()
        ]);

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
exports.update = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
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
exports.updateStatus = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
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
exports.delete = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
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
