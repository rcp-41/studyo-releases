/**
 * STUDYO - Multi-Tenant Migration Script
 * 
 * Bu script mevcut verileri yeni multi-tenant yapısına taşır.
 * 
 * ÖNCESİ: /archives/{id}
 * SONRASI: /studios/{studioId}/archives/{id}
 * 
 * KULLANIM:
 * 1. Firebase Admin SDK kurulu olmalı
 * 2. Service account key dosyası gerekli
 * 3. Önce test environment'ta çalıştırın!
 * 
 * node migrate-to-multitenant.js --studioId=YOUR_STUDIO_ID --dryRun
 * node migrate-to-multitenant.js --studioId=YOUR_STUDIO_ID --execute
 */

const admin = require('firebase-admin');
const fs = require('fs');

// SECURITY: Use Application Default Credentials instead of service account key file
// Run `gcloud auth application-default login` or set GOOGLE_APPLICATION_CREDENTIALS env var
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();
const storage = admin.storage();

// Migration yapılacak collection'lar
const COLLECTIONS = [
    'archives',
    'appointments',
    'customers',
    'shoots',
    'payments',
    'packages',
    'selections'
];

// Storage path'leri
const STORAGE_PATHS = [
    'selections',
    'archives',
    'uploads'
];

/**
 * Bir collection'ı migrate eder
 */
async function migrateCollection(collectionName, studioId, dryRun = true) {
    console.log(`\n📦 ${collectionName} migration başlıyor...`);

    const oldRef = db.collection(collectionName);
    const newRef = db.collection('studios').doc(studioId).collection(collectionName);

    try {
        const snapshot = await oldRef.get();

        if (snapshot.empty) {
            console.log(`   ⚠️  ${collectionName} boş, atlanıyor.`);
            return { success: true, count: 0 };
        }

        console.log(`   📊 ${snapshot.size} doküman bulundu`);

        if (dryRun) {
            console.log(`   🔍 DRY RUN: ${snapshot.size} doküman taşınacak`);
            return { success: true, count: snapshot.size, dryRun: true };
        }

        // Batch işlemi (max 500 operation)
        const batchSize = 500;
        let processed = 0;
        let batch = db.batch();
        let batchCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // studioId ekle
            data.studioId = studioId;
            data.migratedAt = admin.firestore.FieldValue.serverTimestamp();

            batch.set(newRef.doc(doc.id), data);
            batchCount++;

            // Batch doldu, commit et
            if (batchCount >= batchSize) {
                await batch.commit();
                processed += batchCount;
                console.log(`   ✅ ${processed}/${snapshot.size} doküman taşındı`);
                batch = db.batch();
                batchCount = 0;
            }
        }

        // Kalan batch'i commit et
        if (batchCount > 0) {
            await batch.commit();
            processed += batchCount;
        }

        console.log(`   ✅ ${collectionName} migration tamamlandı: ${processed} doküman`);
        return { success: true, count: processed };

    } catch (error) {
        console.error(`   ❌ ${collectionName} migration hatası:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Storage dosyalarını migrate eder
 */
async function migrateStorage(path, studioId, dryRun = true) {
    console.log(`\n📁 Storage migration başlıyor: ${path}`);

    try {
        const bucket = storage.bucket();
        const [files] = await bucket.getFiles({ prefix: path });

        if (files.length === 0) {
            console.log(`   ⚠️  ${path} altında dosya yok, atlanıyor.`);
            return { success: true, count: 0 };
        }

        console.log(`   📊 ${files.length} dosya bulundu`);

        if (dryRun) {
            console.log(`   🔍 DRY RUN: ${files.length} dosya taşınacak`);
            return { success: true, count: files.length, dryRun: true };
        }

        let moved = 0;

        for (const file of files) {
            const oldPath = file.name;
            const newPath = `studios/${studioId}/${oldPath}`;

            try {
                await file.copy(newPath);
                moved++;

                if (moved % 100 === 0) {
                    console.log(`   ✅ ${moved}/${files.length} dosya taşındı`);
                }
            } catch (error) {
                console.error(`   ❌ Dosya taşıma hatası: ${oldPath}`, error.message);
            }
        }

        console.log(`   ✅ Storage migration tamamlandı: ${moved} dosya`);
        return { success: true, count: moved };

    } catch (error) {
        console.error(`   ❌ Storage migration hatası:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Backup oluşturur
 */
async function createBackup(studioId) {
    console.log('\n💾 Backup oluşturuluyor...');

    const backupData = {
        timestamp: new Date().toISOString(),
        studioId,
        collections: {}
    };

    for (const collectionName of COLLECTIONS) {
        const snapshot = await db.collection(collectionName).get();
        backupData.collections[collectionName] = snapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
        }));
    }

    const backupFile = `backup-${studioId}-${Date.now()}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

    console.log(`   ✅ Backup oluşturuldu: ${backupFile}`);
    return backupFile;
}

/**
 * Migration'ı doğrular
 */
async function verifyMigration(studioId) {
    console.log('\n🔍 Migration doğrulanıyor...');

    const results = {};

    for (const collectionName of COLLECTIONS) {
        const oldCount = (await db.collection(collectionName).get()).size;
        const newCount = (await db.collection('studios').doc(studioId).collection(collectionName).get()).size;

        results[collectionName] = {
            old: oldCount,
            new: newCount,
            match: oldCount === newCount
        };

        const status = results[collectionName].match ? '✅' : '❌';
        console.log(`   ${status} ${collectionName}: ${oldCount} → ${newCount}`);
    }

    const allMatch = Object.values(results).every(r => r.match);

    if (allMatch) {
        console.log('\n   ✅ Tüm veriler başarıyla taşındı!');
    } else {
        console.log('\n   ⚠️  Bazı veriler eksik, kontrol edin!');
    }

    return results;
}

/**
 * Ana migration fonksiyonu
 */
async function runMigration(options) {
    const { studioId, dryRun = true, skipBackup = false, skipStorage = false } = options;

    console.log('🚀 STUDYO MULTI-TENANT MIGRATION');
    console.log('================================');
    console.log(`Studio ID: ${studioId}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (test)' : 'EXECUTE (gerçek)'}`);
    console.log(`Backup: ${skipBackup ? 'Hayır' : 'Evet'}`);
    console.log(`Storage: ${skipStorage ? 'Atla' : 'Dahil'}`);
    console.log('================================\n');

    // Backup oluştur (execute mode'da)
    if (!dryRun && !skipBackup) {
        await createBackup(studioId);
    }

    // Collection migration
    const collectionResults = {};
    for (const collection of COLLECTIONS) {
        collectionResults[collection] = await migrateCollection(collection, studioId, dryRun);
    }

    // Storage migration
    const storageResults = {};
    if (!skipStorage) {
        for (const path of STORAGE_PATHS) {
            storageResults[path] = await migrateStorage(path, studioId, dryRun);
        }
    }

    // Özet rapor
    console.log('\n📊 MIGRATION ÖZET');
    console.log('================================');

    let totalDocs = 0;
    let totalFiles = 0;

    console.log('\nCollection\'lar:');
    for (const [name, result] of Object.entries(collectionResults)) {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${name}: ${result.count} doküman`);
        totalDocs += result.count || 0;
    }

    if (!skipStorage) {
        console.log('\nStorage:');
        for (const [name, result] of Object.entries(storageResults)) {
            const status = result.success ? '✅' : '❌';
            console.log(`  ${status} ${name}: ${result.count} dosya`);
            totalFiles += result.count || 0;
        }
    }

    console.log('\nToplam:');
    console.log(`  📄 ${totalDocs} doküman`);
    console.log(`  📁 ${totalFiles} dosya`);

    // Doğrulama (execute mode'da)
    if (!dryRun) {
        await verifyMigration(studioId);
    }

    console.log('\n================================');
    console.log(dryRun ? '🔍 DRY RUN tamamlandı. --execute ile gerçek migration yapın.' : '✅ MIGRATION TAMAMLANDI!');
    console.log('================================\n');
}

// CLI argümanlarını parse et
const args = process.argv.slice(2);
const options = {
    studioId: null,
    dryRun: true,
    skipBackup: false,
    skipStorage: false
};

args.forEach(arg => {
    if (arg.startsWith('--studioId=')) {
        options.studioId = arg.split('=')[1];
    } else if (arg === '--execute') {
        options.dryRun = false;
    } else if (arg === '--skipBackup') {
        options.skipBackup = true;
    } else if (arg === '--skipStorage') {
        options.skipStorage = true;
    }
});

// Validation
if (!options.studioId) {
    console.error('❌ Hata: --studioId parametresi gerekli!');
    console.log('\nKullanım:');
    console.log('  node migrate-to-multitenant.js --studioId=YOUR_STUDIO_ID --dryRun');
    console.log('  node migrate-to-multitenant.js --studioId=YOUR_STUDIO_ID --execute');
    console.log('\nOpsiyonel:');
    console.log('  --skipBackup    Backup oluşturma');
    console.log('  --skipStorage   Storage migration\'ı atla');
    process.exit(1);
}

// Migration'ı çalıştır
runMigration(options)
    .then(() => {
        console.log('✅ İşlem tamamlandı');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Fatal hata:', error);
        process.exit(1);
    });
