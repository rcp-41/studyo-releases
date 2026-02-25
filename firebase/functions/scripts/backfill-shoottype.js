/**
 * Backfill ShootTypeId, PhotographerId from SQL data into studio-scoped archives
 * 
 * Reads the legacy SQL dump, extracts ArsivID→TurID/CekimciID/CekimYeriID mappings,
 * then updates the corresponding studio-scoped archive documents.
 * 
 * Run: node scripts/backfill-shoottype.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Init Firebase Admin
const possiblePaths = [
    path.join(__dirname, '../../studyo-live-2026-firebase-adminsdk.json'),
    path.join(__dirname, '../studyo-live-2026-firebase-adminsdk.json'),
    path.join(__dirname, '../../../studyo-live-2026-firebase-adminsdk.json')
];
const serviceAccountPath = possiblePaths.find(p => fs.existsSync(p));
if (!serviceAccountPath) {
    console.error('Service account file not found');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'studyo-live-2026'
});

const db = admin.firestore();
const STUDIO_ID = 'i0O8p9aU9FUKeIXBVVWC';
const SQL_FILE = path.join(__dirname, '../../../Eski bir db/hdy/Database.sql');

// Reuse the tuple parser from migrate-to-firestore.js
function parseTuple(tupleStr) {
    const values = [];
    let current = '';
    let inString = false;

    for (let i = 0; i < tupleStr.length; i++) {
        const char = tupleStr[i];
        const next = tupleStr[i + 1] || '';

        if (char === 'N' && next === "'" && !inString) {
            inString = true;
            i++;
            continue;
        }
        if (char === "'" && !inString) {
            inString = true;
            continue;
        }
        if (char === "'" && inString) {
            if (next === "'") { current += "'"; i++; continue; }
            inString = false;
            continue;
        }
        if (char === ',' && !inString) {
            values.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) values.push(current.trim());
    return values;
}

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
                if (next === "'") { current += "''"; i++; continue; }
                inString = false;
                if (depth > 0) current += "'";
                continue;
            }
            if (!inString) {
                if (char === '(') { depth++; if (depth === 1) continue; }
                if (char === ')') {
                    depth--;
                    if (depth === 0) {
                        if (current.trim()) tuples.push(current.trim());
                        current = '';
                        continue;
                    }
                }
            }
            if (depth > 0) current += char;
        }
        searchPos = endPos;
    }
    return tuples;
}

function cleanVal(v) {
    if (!v || v === 'NULL' || v === '0') return null;
    return v.trim();
}

async function main() {
    console.log('📁 Reading SQL file...');
    let content;
    try { content = fs.readFileSync(SQL_FILE, 'utf8'); }
    catch { content = fs.readFileSync(SQL_FILE, 'latin1'); }
    console.log(`  ✅ File loaded (${(content.length / 1024 / 1024).toFixed(1)} MB)`);

    // Step 1: Load shootType legacyId → Firestore doc ID mapping from studio collection
    console.log('\n🔍 Loading shootType/location/photographer mappings from Firestore...');
    const studioRef = db.collection('studios').doc(STUDIO_ID);

    const shootTypeLookup = {}; // legacyId → { firestoreId, name }
    const locationLookup = {};
    const photographerLookup = {};

    const [stSnap, locSnap, phSnap] = await Promise.all([
        studioRef.collection('shootTypes').get(),
        studioRef.collection('locations').get(),
        studioRef.collection('photographers').get()
    ]);

    stSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.legacyId !== null && d.legacyId !== undefined) {
            shootTypeLookup[String(d.legacyId)] = { id: doc.id, name: d.name || '' };
        }
    });
    locSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.legacyId !== null && d.legacyId !== undefined) {
            locationLookup[String(d.legacyId)] = { id: doc.id, name: d.name || '' };
        }
    });
    phSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.legacyId !== null && d.legacyId !== undefined) {
            photographerLookup[String(d.legacyId)] = { id: doc.id, name: d.name || '' };
        }
    });

    console.log(`  ShootTypes: ${Object.keys(shootTypeLookup).length} (legacyIds: ${Object.keys(shootTypeLookup).join(', ')})`);
    console.log(`  Locations: ${Object.keys(locationLookup).length} (legacyIds: ${Object.keys(locationLookup).join(', ')})`);
    console.log(`  Photographers: ${Object.keys(photographerLookup).length} (legacyIds: ${Object.keys(photographerLookup).join(', ')})`);

    // Step 2: Parse SQL and extract ArsivID → TurID/CekimciID/CekimYeriID
    console.log('\n📊 Parsing SQL archive data...');
    const tuples = extractTuples(content, 'tblArsiv');
    console.log(`  Found ${tuples.length} archive records in SQL`);

    // Build mapping: archiveNumber → { shootTypeId, photographerId, locationId }
    const sqlMapping = new Map();
    let withTurID = 0, withCekimciID = 0, withCekimYeriID = 0;

    for (const tuple of tuples) {
        const values = parseTuple(tuple);
        if (values.length < 13) continue;

        // tblArsiv columns: ArsivID(0), Isim(1), Tarih(2), TeslimGunu(3), Ebat(4), CekimciID(5), TurID(6), Durum(7), Telefon(8), Tutar(9), Alinan(10), Notlar(11), CekimYeriID(12)
        const arsivId = parseInt(values[0]) || 0;
        const cekimciId = cleanVal(values[5]);
        const turId = cleanVal(values[6]);
        const cekimYeriId = cleanVal(values[12]);

        if (!arsivId) continue;

        const data = {};
        if (turId) { data.shootTypeId = turId; withTurID++; }
        if (cekimciId) { data.photographerId = cekimciId; withCekimciID++; }
        if (cekimYeriId) { data.locationId = cekimYeriId; withCekimYeriID++; }

        if (Object.keys(data).length > 0) {
            sqlMapping.set(arsivId, data);
        }
    }

    console.log(`  Records with TurID: ${withTurID}`);
    console.log(`  Records with CekimciID: ${withCekimciID}`);
    console.log(`  Records with CekimYeriID: ${withCekimYeriID}`);
    console.log(`  Total mappable records: ${sqlMapping.size}`);

    // Show first 5 samples
    let count = 0;
    for (const [id, data] of sqlMapping) {
        if (count++ >= 5) break;
        console.log(`  Sample: Archive #${id} → ${JSON.stringify(data)}`);
    }

    if (sqlMapping.size === 0) {
        console.log('⚠️ No records with TurID/CekimciID found. Nothing to update.');
        process.exit(0);
    }

    // Step 3: Update studio-scoped archives in batches
    console.log('\n🔄 Updating studio-scoped archives...');

    // Fetch all archives from studio to build archiveNumber → docId map
    const archivesSnap = await studioRef.collection('archives')
        .select('archiveNumber', 'shootTypeId', 'photographerId', 'locationId')
        .get();

    console.log(`  Studio archives in Firestore: ${archivesSnap.size}`);

    const archiveDocMap = new Map(); // archiveNumber → { docRef, existing data }
    archivesSnap.docs.forEach(doc => {
        const d = doc.data();
        archiveDocMap.set(d.archiveNumber, {
            ref: doc.ref,
            shootTypeId: d.shootTypeId,
            photographerId: d.photographerId,
            locationId: d.locationId
        });
    });

    let updated = 0, skipped = 0, notFound = 0;
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 450;

    for (const [archiveNum, sqlData] of sqlMapping) {
        const existing = archiveDocMap.get(archiveNum);
        if (!existing) { notFound++; continue; }

        const updateData = {};

        // Only update if currently null
        if (sqlData.shootTypeId && !existing.shootTypeId) {
            const stInfo = shootTypeLookup[sqlData.shootTypeId];
            updateData.shootTypeId = sqlData.shootTypeId;
            updateData.shootTypeName = stInfo ? stInfo.name : '';
        }
        if (sqlData.photographerId && !existing.photographerId) {
            const phInfo = photographerLookup[sqlData.photographerId];
            updateData.photographerId = sqlData.photographerId;
            updateData.photographerName = phInfo ? phInfo.name : '';
        }
        if (sqlData.locationId && !existing.locationId) {
            const locInfo = locationLookup[sqlData.locationId];
            updateData.locationId = sqlData.locationId;
            updateData.locationName = locInfo ? locInfo.name : '';
        }

        if (Object.keys(updateData).length === 0) { skipped++; continue; }

        updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        batch.update(existing.ref, updateData);
        batchCount++;
        updated++;

        if (batchCount >= BATCH_SIZE) {
            console.log(`  📤 Committing batch of ${batchCount} updates... (total: ${updated})`);
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        console.log(`  📤 Committing final batch of ${batchCount} updates...`);
        await batch.commit();
    }

    console.log('\n✅ Backfill complete!');
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped (already set): ${skipped}`);
    console.log(`  Not found in Firestore: ${notFound}`);

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
