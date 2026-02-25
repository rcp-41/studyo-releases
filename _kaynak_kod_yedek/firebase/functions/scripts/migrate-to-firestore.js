/**
 * Legacy Database Migration to Firestore
 * Migrates data from ProRandevu SQL dump to Firestore
 * 
 * Run with: node migrate-to-firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
// Check multiple possible locations for the service account file
const possiblePaths = [
    path.join(__dirname, '../../studyo-live-2026-firebase-adminsdk.json'), // firebase/
    path.join(__dirname, '../studyo-live-2026-firebase-adminsdk.json'),     // functions/
    path.join(__dirname, '../../../studyo-live-2026-firebase-adminsdk.json') // Studyo/
];

const serviceAccountPath = possiblePaths.find(p => fs.existsSync(p));

if (!serviceAccountPath) {
    console.error('❌ Service account file not found. Checked locations:');
    possiblePaths.forEach(p => console.error(`   - ${p}`));
    console.log('💡 Please ensure studyo-live-2026-firebase-adminsdk.json is in r:\\Studyo\\firebase\\');
    process.exit(1);
}

console.log(`🔑 Using service account: ${serviceAccountPath}`);

admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'studyo-live-2026'
});

const db = admin.firestore();

// Legacy SQL file path
const SQL_FILE = path.join(__dirname, '../../../Eski bir db/hdy/Database.sql');

// Stats
const stats = {
    archives: 0,
    payments: 0,
    errors: []
};

// Maps for tracking
const archiveDocIds = new Map(); // oldArsivID -> firestoreDocId

/**
 * Parse a single value tuple like (1, N'text', 650.00, ...)
 */
function parseTuple(tupleStr) {
    const values = [];
    let current = '';
    let inString = false;

    for (let i = 0; i < tupleStr.length; i++) {
        const char = tupleStr[i];
        const next = tupleStr[i + 1] || '';

        // Handle N'...' string start
        if (char === 'N' && next === "'" && !inString) {
            inString = true;
            i++; // skip N and '
            continue;
        }

        // Handle regular '...' string start
        if (char === "'" && !inString) {
            inString = true;
            continue;
        }

        // Handle string end or escaped quote
        if (char === "'" && inString) {
            if (next === "'") {
                current += "'"; // escaped quote
                i++;
                continue;
            }
            inString = false;
            continue;
        }

        // Comma separator (only outside strings)
        if (char === ',' && !inString) {
            values.push(cleanValue(current.trim()));
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        values.push(cleanValue(current.trim()));
    }

    return values;
}

function cleanValue(val) {
    if (val === 'NULL' || val === '') return null;
    val = val.trim();
    if (val.startsWith('_binary')) return null;
    return val;
}

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    try {
        const clean = dateStr.replace(/\.000$/, '').trim();
        const d = new Date(clean);
        return isNaN(d.getTime()) ? new Date() : d;
    } catch {
        return new Date();
    }
}

function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/[\s\-\*\/]/g, '').trim() || '';
}

/**
 * Extract tuples from INSERT statement(s)
 */
function extractTuples(content, tableName) {
    const tuples = [];
    const insertPattern = `INSERT INTO "${tableName}"`;
    let searchPos = 0;

    while (true) {
        const insertPos = content.indexOf(insertPattern, searchPos);
        if (insertPos === -1) break;

        const valuesPos = content.indexOf('VALUES', insertPos);
        if (valuesPos === -1) break;

        const nextInsertPos = content.indexOf('INSERT INTO "', valuesPos + 6);
        const endPos = nextInsertPos !== -1 ? nextInsertPos : content.length;

        const valuesStr = content.substring(valuesPos + 6, endPos);

        let depth = 0;
        let current = '';
        let inString = false;

        for (let i = 0; i < valuesStr.length; i++) {
            const char = valuesStr[i];
            const next = valuesStr[i + 1] || '';

            if ((char === 'N' && next === "'") || (char === "'" && !inString)) {
                if (char === 'N') i++;
                inString = true;
                if (depth > 0) current += char === 'N' ? "N'" : "'";
                continue;
            }

            if (char === "'" && inString) {
                if (next === "'") {
                    current += "''";
                    i++;
                    continue;
                }
                inString = false;
                if (depth > 0) current += "'";
                continue;
            }

            if (!inString) {
                if (char === '(') {
                    depth++;
                    if (depth === 1) continue;
                }
                if (char === ')') {
                    depth--;
                    if (depth === 0) {
                        if (current.trim()) {
                            tuples.push(current.trim());
                        }
                        current = '';
                        continue;
                    }
                }
            }

            if (depth > 0) {
                current += char;
            }
        }

        searchPos = endPos;
    }

    return tuples;
}

/**
 * Import Archive records
 */
async function importArchives(content) {
    console.log('\n📁 Importing Archive records...');

    const tuples = extractTuples(content, 'tblArsiv');
    console.log(`  📊 Found ${tuples.length} archive tuples`);

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const tuple of tuples) {
        try {
            const values = parseTuple(tuple);
            if (values.length < 12) continue;

            // tblArsiv: ArsivID, Isim, Tarih, TeslimGunu, Ebat, CekimciID, TurID, Durum, Telefon, Tutar, Alinan, Notlar, CekimYeriID, ...
            const oldId = parseInt(values[0]) || 0;
            const fullName = values[1] || 'İsimsiz';
            const tarih = parseDate(values[2]);
            const ebat = values[4] || '';
            const durum = parseInt(values[7]) || 0;
            const telefon = cleanPhone(values[8]);
            const tutar = parseFloat(values[9]) || 0;
            const alinan = parseFloat(values[10]) || 0;
            const notlar = values[11] || '';

            const status = durum === 0 ? 'active' : 'archived';
            const description1 = ebat ? `${notlar}\n[Ebat: ${ebat}]`.trim() : (notlar || '');

            const archiveData = {
                archiveNumber: oldId, // PRESERVE LEGACY ID AS ARCHIVE NUMBER
                studioId: 'default-studio',
                fullName,
                phone: telefon || '0000000000',
                shootTypeId: null, // Will need to map later
                locationId: null,
                photographerId: null,
                description1,
                description2: null,
                totalAmount: tutar,
                cashAmount: alinan,
                cardAmount: 0,
                transferAmount: 0,
                isPaid: alinan >= tutar,
                status,
                shootDate: admin.firestore.Timestamp.fromDate(tarih),
                createdAt: admin.firestore.Timestamp.fromDate(tarih),
                updatedAt: admin.firestore.Timestamp.now(),
                createdById: 'migration'
            };

            const docRef = db.collection('archives').doc();
            batch.set(docRef, archiveData);
            archiveDocIds.set(oldId, docRef.id);

            batchCount++;
            stats.archives++;

            if (stats.archives + stats.errors.length >= (global.DEBUG_LIMIT || 1000000)) {
                console.log('🛑 Debug limit reached, stopping...');
                break;
            }

            // Commit batch when limit reached
            if (batchCount >= BATCH_SIZE) {
                console.log(`  📤 Committing batch of ${batchCount} archives...`);
                await batch.commit();
                batch = db.batch(); // Start new batch
                batchCount = 0;
            }

            if (stats.archives % 1000 === 0) {
                console.log(`  📊 Processed ${stats.archives} archives...`);
            }
        } catch (e) {
            stats.errors.push(`Archive: ${e.message.slice(0, 100)}`);
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        console.log(`  📤 Committing final batch of ${batchCount} archives...`);
        await batch.commit();
    }

    // Update counter for new archives
    const maxNumber = Math.max(...Array.from(archiveDocIds.keys()));
    await db.collection('counters').doc('archives').set({
        lastNumber: maxNumber
    });

    console.log(`  ✅ Archives: ${stats.archives} imported`);
    console.log(`  ✅ Counter set to: ${maxNumber}`);
}

/**
 * Main migration
 */
async function migrate() {
    console.log('🚀 Legacy Data Migration to Firestore');
    console.log('='.repeat(50));

    try {
        if (!fs.existsSync(SQL_FILE)) {
            console.error(`❌ SQL file not found: ${SQL_FILE}`);
            process.exit(1);
        }

        console.log(`📄 Reading ${SQL_FILE}...`);

        let content;
        try {
            content = fs.readFileSync(SQL_FILE, 'utf8');
        } catch {
            content = fs.readFileSync(SQL_FILE, 'latin1');
        }

        console.log(`  ✅ File loaded (${(content.length / 1024 / 1024).toFixed(2)} MB)`);

        // Import archives
        await importArchives(content);

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 Migration Summary');
        console.log(`  - Archives imported: ${stats.archives}`);
        console.log(`  - Errors: ${stats.errors.length}`);

        if (stats.errors.length > 0) {
            console.log('\n⚠️ First 5 Errors:');
            stats.errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
        }

        console.log('\n✅ Migration debugging finished!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Set a limit for debugging
// const DEBUG_LIMIT = 2000;
// global.DEBUG_LIMIT = DEBUG_LIMIT;

migrate();
