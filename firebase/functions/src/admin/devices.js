const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

exports.registerHwid = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { hwid, macAddress } = request.data;
    if (!hwid) {
        throw new HttpsError('invalid-argument', 'HWID is required');
    }

    const organizationId = request.auth.token?.organizationId;
    const studioId = request.auth.token?.studioId;
    if (!organizationId || !studioId) {
        throw new HttpsError('failed-precondition', 'User must be assigned to a studio');
    }

    try {
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        const studioDoc = await studioRef.get();

        if (!studioDoc.exists) {
            throw new HttpsError('not-found', 'Studio not found');
        }

        const license = studioDoc.data().license || {};

        if (license.hwid_registered && license.hwid_lock) {
            if (license.hwid_lock !== hwid) {
                throw new HttpsError('permission-denied', 'This studio is already registered to another device');
            }
            return { success: true, message: 'HWID already registered' };
        }

        await studioRef.update({
            'license.hwid_lock': hwid,
            'license.mac_address': macAddress || null,
            'license.hwid_registered': true,
            'license.registered_at': admin.firestore.FieldValue.serverTimestamp(),
            'license.last_validated_at': admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await studioRef.collection('auditLogs').add({
            action: 'hwid_registered',
            hwid: hwid,
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, message: 'HWID registered successfully' };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('registerHwid error:', error);
        throw new HttpsError('internal', 'HWID kaydı başarısız');
    }
});

exports.requestHwidApproval = onCall({ enforceAppCheck: false }, async (request) => {
    const { organizationId, studioId, licenseKey, hwid, macAddress, hostname, ipAddress, localIp, publicIp, deviceInfo } = request.data || {};

    if (!organizationId || !studioId || !licenseKey || !hwid) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId, licenseKey and hwid are required');
    }

    try {
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        const studioDoc = await studioRef.get();

        if (!studioDoc.exists) {
            throw new HttpsError('not-found', 'Studio not found');
        }

        const studioData = studioDoc.data();
        if (studioData.license?.license_key !== licenseKey.trim().toUpperCase()) {
            throw new HttpsError('permission-denied', 'License key does not match');
        }

        const devicesRef = studioRef.collection('devices');
        const existingApproved = await devicesRef
            .where('hwid', '==', hwid)
            .where('status', '==', 'approved')
            .limit(1)
            .get();

        if (!existingApproved.empty) {
            const deviceDoc = existingApproved.docs[0];
            await deviceDoc.ref.update({
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                ipAddress: ipAddress || null,
                localIp: localIp || null,
                publicIp: publicIp || null
            });
            return { success: true, status: 'approved', message: 'Device already approved' };
        }

        const existingPending = await devicesRef
            .where('hwid', '==', hwid)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

        if (!existingPending.empty) {
            return { success: true, status: 'pending', message: 'Approval request already pending' };
        }

        await devicesRef.add({
            hwid,
            hostname: hostname || 'Bilinmeyen',
            macAddress: macAddress || null,
            ipAddress: ipAddress || null,
            localIp: localIp || null,
            publicIp: publicIp || null,
            status: 'pending',
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedAt: null,
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            deviceInfo: deviceInfo || {}
        });

        return { success: true, status: 'pending', message: 'HWID approval requested' };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('requestHwidApproval error:', error);
        throw new HttpsError('internal', 'HWID onay isteği başarısız');
    }
});

exports.checkHwidStatus = onCall({ enforceAppCheck: false }, async (request) => {
    const { organizationId, studioId, hwid } = request.data || {};

    if (!organizationId || !studioId || !hwid) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId and hwid are required');
    }

    try {
        const devicesRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices');

        const snapshot = await devicesRef
            .where('hwid', '==', hwid)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { success: true, status: 'not_found' };
        }

        const device = snapshot.docs[0].data();
        return { success: true, status: device.status };
    } catch (error) {
        console.error('checkHwidStatus error:', error);
        throw new HttpsError('internal', 'Durum kontrolü başarısız');
    }
});

exports.approveDevice = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can approve devices');
    }

    const { organizationId, studioId, deviceId } = request.data || {};
    if (!organizationId || !studioId || !deviceId) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId and deviceId are required');
    }

    try {
        const deviceRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices').doc(deviceId);

        const deviceDoc = await deviceRef.get();
        if (!deviceDoc.exists) {
            throw new HttpsError('not-found', 'Device not found');
        }

        const deviceData = deviceDoc.data();
        if (deviceData.status === 'approved') {
            return { success: true, message: 'Device already approved' };
        }

        await deviceRef.update({
            status: 'approved',
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedBy: request.auth.uid
        });

        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        const studioDoc = await studioRef.get();
        const license = studioDoc.data()?.license || {};

        if (!license.hwid_lock || !license.hwid_registered) {
            await studioRef.update({
                'license.hwid_lock': deviceData.hwid,
                'license.mac_address': deviceData.macAddress || null,
                'license.hwid_registered': true,
                'license.registered_at': admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        await studioRef.collection('auditLogs').add({
            action: 'device_approved',
            deviceId,
            hwid: deviceData.hwid,
            hostname: deviceData.hostname,
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('approveDevice error:', error);
        throw new HttpsError('internal', 'Cihaz onaylama başarısız');
    }
});

exports.rejectDevice = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can reject devices');
    }

    const { organizationId, studioId, deviceId } = request.data || {};
    if (!organizationId || !studioId || !deviceId) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId and deviceId are required');
    }

    try {
        const deviceRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices').doc(deviceId);

        const deviceDoc = await deviceRef.get();
        if (!deviceDoc.exists) {
            throw new HttpsError('not-found', 'Device not found');
        }

        await deviceRef.update({
            status: 'rejected',
            rejectedBy: request.auth.uid,
            rejectedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        await studioRef.collection('auditLogs').add({
            action: 'device_rejected',
            deviceId,
            hwid: deviceDoc.data().hwid,
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('rejectDevice error:', error);
        throw new HttpsError('internal', 'Cihaz reddetme başarısız');
    }
});

exports.getStudioDevices = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can view devices');
    }

    const { organizationId, studioId } = request.data || {};
    if (!organizationId || !studioId) {
        throw new HttpsError('invalid-argument', 'organizationId and studioId are required');
    }

    try {
        const devicesRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices');

        const snapshot = await devicesRef.orderBy('requestedAt', 'desc').get();
        const devices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            requestedAt: doc.data().requestedAt?.toDate?.()?.toISOString() || null,
            approvedAt: doc.data().approvedAt?.toDate?.()?.toISOString() || null,
            lastActiveAt: doc.data().lastActiveAt?.toDate?.()?.toISOString() || null,
            rejectedAt: doc.data().rejectedAt?.toDate?.()?.toISOString() || null
        }));

        return { success: true, devices };
    } catch (error) {
        console.error('getStudioDevices error:', error);
        throw new HttpsError('internal', 'Cihaz listesi alınamadı');
    }
});

exports.deviceHeartbeat = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const organizationId = request.auth.token?.organizationId;
    const studioId = request.auth.token?.studioId;
    if (!organizationId || !studioId) {
        throw new HttpsError('failed-precondition', 'User must be assigned to a studio');
    }

    const { hwid, ipAddress } = request.data || {};
    if (!hwid) {
        throw new HttpsError('invalid-argument', 'hwid is required');
    }

    try {
        const devicesRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices');

        const snapshot = await devicesRef
            .where('hwid', '==', hwid)
            .where('status', '==', 'approved')
            .limit(1)
            .get();

        if (!snapshot.empty) {
            await snapshot.docs[0].ref.update({
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                ipAddress: ipAddress || null
            });
        }

        return { success: true };
    } catch (error) {
        console.error('deviceHeartbeat error:', error);
        return { success: false };
    }
});
