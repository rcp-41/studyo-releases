const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { APPCHECK_ENABLED } = require('./config');

exports.resetStudioData = onCall({
    enforceAppCheck: APPCHECK_ENABLED,
    region: 'us-central1',
    maxInstances: 5,
    memory: '1GiB',
    timeoutSeconds: 540
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Bu işlemi yapmak için giriş yapmalısınız.');
    }

    const userToken = request.auth.token;
    // Sadece admin veya creator rolüne sahip kullanıcılar işlem yapabilir
    if (userToken.role !== 'admin' && userToken.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Sadece yöneticiler veri sıfırlama işlemi yapabilir.');
    }

    const { resetOption } = request.data;
    // SECURITY: admin role must use their own auth-token claims (prevents cross-studio reset).
    // creator role is a cross-studio super-user, so they may supply studioId/organizationId.
    let organizationId;
    let studioId;
    if (userToken.role === 'creator') {
        organizationId = request.data.organizationId;
        studioId = request.data.studioId;
    } else {
        organizationId = userToken.organizationId;
        studioId = userToken.studioId;
    }

    if (!organizationId || !studioId || !resetOption) {
        throw new HttpsError('invalid-argument', 'Organizasyon ID, Stüdyo ID ve Sıfırlama Seçeneği zorunludur.');
    }

    const db = admin.firestore();
    const studioRef = db.doc(`organizations/${organizationId}/studios/${studioId}`);

    const studioSnap = await studioRef.get();
    if (!studioSnap.exists) {
        throw new HttpsError('not-found', 'Stüdyo bulunamadı.');
    }

    const collectionsToReset = [];
    if (resetOption === 'archives') {
        // Sadece arşiv ve müşteri listesi
        collectionsToReset.push('archives', 'customers');
    } else if (resetOption === 'all') {
        // Kullanıcı tanımlı tüm veriler
        collectionsToReset.push(
            'archives', 'customers', 'schools', 'priceLists', 
            'shootTypes', 'packages', 'gifts', 'appointments', 
            'shoots', 'locations', 'photographers'
        );
    } else {
        throw new HttpsError('invalid-argument', 'Geçersiz sıfırlama seçeneği ("archives" veya "all" olmalı).');
    }

    try {
        const bulkWriter = db.bulkWriter();
        let deleteCount = 0;

        for (const colName of collectionsToReset) {
            const colRef = studioRef.collection(colName);
            
            // OOM (Memory Limit Exceeded) hatalarını önlemek için chunk paginated silme yöntemi
            let hasMore = true;
            let lastDoc = null;
            
            while (hasMore) {
                let query = colRef.select().limit(500);
                if (lastDoc) {
                    query = query.startAfter(lastDoc);
                }
                
                const snapshot = await query.get();
                if (snapshot.empty) {
                    hasMore = false;
                    break;
                }
                
                snapshot.forEach((doc) => {
                    bulkWriter.delete(doc.ref);
                    deleteCount++;
                });
                
                lastDoc = snapshot.docs[snapshot.docs.length - 1];
            }
        }
        
        await bulkWriter.close();
        
        // Audit log kaydı
        const logRef = studioRef.collection('auditLogs').doc();
        await logRef.set({
            action: 'RESET_STUDIO_DATA',
            resetOption: resetOption,
            deletedDocuments: deleteCount,
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { 
            success: true, 
            message: `Veriler başarıyla sıfırlandı. Toplam ${deleteCount} doküman silindi.`, 
            deletedCollections: collectionsToReset 
        };
    } catch (error) {
        console.error('Veri sıfırlama hatası:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'İşlem sırasında bir hata oluştu.');
    }
});
