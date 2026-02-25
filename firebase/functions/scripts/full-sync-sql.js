/**
 * Full Data Sync from newer SQL dump (21.02.26/randevu4101.sql)
 * 
 * 1. Extract shoot type names from tblSabit (CTURU category)
 * 2. Extract photographer names from tblPersonel
 * 3. Add missing photographers to Firestore (legacyId 1-15)
 * 4. Update ALL archives with correct shootTypeId/shootTypeName/photographerId/photographerName
 * 5. Insert new archive records not yet in Firestore
 * 
 * Run: node scripts/full-sync-sql.js
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
if (!serviceAccountPath) { console.error('Service account file not found'); process.exit(1); }

admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'studyo-live-2026'
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const STUDIO_ID = 'i0O8p9aU9FUKeIXBVVWC';
const SQL_FILE = path.join(__dirname, '../../../Eski bir db/21.02.26/randevu4101.sql');

// ── Parsers ──
function parseTuple(tupleStr) {
    const values = [];
    let current = '';
    let inString = false;
    for (let i = 0; i < tupleStr.length; i++) {
        const char = tupleStr[i];
        const next = tupleStr[i + 1] || '';
        if (char === 'N' && next === "'" && !inString) { inString = true; i++; continue; }
        if (char === "'" && !inString) { inString = true; continue; }
        if (char === "'" && inString) {
            if (next === "'") { current += "'"; i++; continue; }
            inString = false; continue;
        }
        if (char === ',' && !inString) { values.push(current.trim()); current = ''; continue; }
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
        let depth = 0, current = '', inString = false;
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
                if (char === ')') { depth--; if (depth === 0) { if (current.trim()) tuples.push(current.trim()); current = ''; continue; } }
            }
            if (depth > 0) current += char;
        }
        searchPos = endPos;
    }
    return tuples;
}

function cleanVal(v) {
    if (!v || v === 'NULL' || v === '0' || v === '-1') return null;
    return v.trim();
}

function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/[\s\-\*\/]/g, '').trim() || '';
}

function parseDate(dateStr) {
    if (!dateStr || dateStr === 'NULL') return new Date();
    try {
        const clean = dateStr.replace(/\.000$/, '').trim();
        const d = new Date(clean);
        return isNaN(d.getTime()) ? new Date() : d;
    } catch { return new Date(); }
}

async function main() {
    console.log('📁 Reading SQL file...');
    let content;
    try { content = fs.readFileSync(SQL_FILE, 'utf8'); }
    catch { content = fs.readFileSync(SQL_FILE, 'latin1'); }
    console.log(`  ✅ File loaded (${(content.length / 1024 / 1024).toFixed(1)} MB)\n`);

    const studioRef = db.collection('studios').doc(STUDIO_ID);
    const now = FieldValue.serverTimestamp();

    // ══════════════════════════════════════════════════
    // STEP 1: Extract shoot type names from tblSabit
    // ══════════════════════════════════════════════════
    console.log('📋 Step 1: Extracting shoot type names from tblSabit...');
    const sabitTuples = extractTuples(content, 'tblSabit');
    const shootTypeNames = {}; // Numara → Name
    const locationNames = {};  // We'll also look for CekimYeri entries

    for (const tuple of sabitTuples) {
        const v = parseTuple(tuple);
        // SabitID(0), SabitName(1), Numara(2), Deger(3)
        const category = v[1];
        const numara = v[2];
        const deger = v[3];

        if (category === 'CTURU' && numara && deger) {
            shootTypeNames[numara] = deger;
        }
        if (category === 'CYERI' && numara && deger) {
            locationNames[numara] = deger;
        }
    }

    console.log('  Shoot Type Names (CTURU):');
    Object.entries(shootTypeNames).forEach(([k, v]) => console.log(`    ${k} → ${v}`));
    console.log('  Location Names (CYERI):');
    if (Object.keys(locationNames).length > 0) {
        Object.entries(locationNames).forEach(([k, v]) => console.log(`    ${k} → ${v}`));
    } else {
        console.log('    (none found in tblSabit)');
    }

    // ══════════════════════════════════════════════════
    // STEP 2: Extract photographer names from tblPersonel
    // ══════════════════════════════════════════════════
    console.log('\n📋 Step 2: Extracting photographer names from tblPersonel...');
    const personelTuples = extractTuples(content, 'tblPersonel');
    const photographerNames = {}; // PersonelID → Name

    for (const tuple of personelTuples) {
        const v = parseTuple(tuple);
        // Columns depend on schema, let's check
        if (v.length >= 2) {
            const id = v[0];
            const name = v[1] || '';
            if (id && id !== 'NULL') {
                photographerNames[id] = name;
            }
        }
    }

    console.log(`  Found ${Object.keys(photographerNames).length} personnel entries:`);
    Object.entries(photographerNames).forEach(([k, v]) => console.log(`    ${k} → ${v}`));

    // ══════════════════════════════════════════════════
    // STEP 3: Load existing Firestore data
    // ══════════════════════════════════════════════════
    console.log('\n📋 Step 3: Loading existing Firestore data...');

    // Load existing shootTypes from Firestore
    const stSnap = await studioRef.collection('shootTypes').get();
    const existingShootTypes = {};
    stSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.legacyId !== null && d.legacyId !== undefined) {
            existingShootTypes[String(d.legacyId)] = { id: doc.id, name: d.name };
        }
    });
    console.log(`  Existing shootTypes: ${stSnap.size} (legacyIds: ${Object.keys(existingShootTypes).join(', ')})`);

    // Load existing photographers
    const phSnap = await studioRef.collection('photographers').get();
    const existingPhotographers = {};
    phSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.legacyId !== null && d.legacyId !== undefined) {
            existingPhotographers[String(d.legacyId)] = { id: doc.id, name: d.name };
        }
    });
    console.log(`  Existing photographers: ${phSnap.size} (legacyIds: ${Object.keys(existingPhotographers).join(', ')})`);

    // Load existing locations
    const locSnap = await studioRef.collection('locations').get();
    const existingLocations = {};
    locSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.legacyId !== null && d.legacyId !== undefined) {
            existingLocations[String(d.legacyId)] = { id: doc.id, name: d.name };
        }
    });
    console.log(`  Existing locations: ${locSnap.size} (legacyIds: ${Object.keys(existingLocations).join(', ')})`);

    // ══════════════════════════════════════════════════
    // STEP 4: Update shootType names in Firestore if CTURU mapping found
    // ══════════════════════════════════════════════════
    if (Object.keys(shootTypeNames).length > 0) {
        console.log('\n📋 Step 4: Updating shoot type names from CTURU...');
        let batch = db.batch();
        let batchCount = 0;

        for (const doc of stSnap.docs) {
            const d = doc.data();
            const legacyId = String(d.legacyId || '');
            if (shootTypeNames[legacyId] && d.name !== shootTypeNames[legacyId]) {
                console.log(`  Updating shootType legacyId=${legacyId}: "${d.name}" → "${shootTypeNames[legacyId]}"`);
                batch.update(doc.ref, { name: shootTypeNames[legacyId] });
                existingShootTypes[legacyId].name = shootTypeNames[legacyId];
                batchCount++;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
            console.log(`  ✅ Updated ${batchCount} shoot type names`);
        } else {
            console.log('  ✅ All shoot type names already correct');
        }
    }

    // ══════════════════════════════════════════════════
    // STEP 5: Add missing photographers to Firestore
    // ══════════════════════════════════════════════════
    console.log('\n📋 Step 5: Adding missing photographers...');
    let phBatch = db.batch();
    let phAdded = 0;

    for (const [legacyId, name] of Object.entries(photographerNames)) {
        if (!existingPhotographers[legacyId]) {
            const docRef = studioRef.collection('photographers').doc();
            phBatch.set(docRef, {
                name: name,
                legacyId: parseInt(legacyId),
                isActive: true,
                createdAt: admin.firestore.Timestamp.now(),
                addedBy: 'sql-sync'
            });
            existingPhotographers[legacyId] = { id: docRef.id, name: name };
            phAdded++;
            console.log(`  + Adding photographer: legacyId=${legacyId}, name="${name}"`);
        }
    }

    if (phAdded > 0) {
        await phBatch.commit();
        console.log(`  ✅ Added ${phAdded} new photographers`);
    } else {
        console.log('  ✅ All photographers already exist');
    }

    // ══════════════════════════════════════════════════
    // STEP 6: Parse all archives from SQL
    // ══════════════════════════════════════════════════
    console.log('\n📋 Step 6: Parsing all archives from SQL...');
    const archiveTuples = extractTuples(content, 'tblArsiv');
    console.log(`  SQL archive records: ${archiveTuples.length}`);

    const sqlArchives = new Map(); // archiveNumber → data

    for (const tuple of archiveTuples) {
        const v = parseTuple(tuple);
        if (v.length < 13) continue;

        const archiveNum = parseInt(v[0]) || 0;
        if (!archiveNum) continue;

        sqlArchives.set(archiveNum, {
            archiveNumber: archiveNum,
            fullName: v[1] || 'İsimsiz',
            shootDate: parseDate(v[2]),
            ebat: v[4] || '',
            cekimciId: cleanVal(v[5]),
            turId: cleanVal(v[6]),
            durum: parseInt(v[7]) || 0,
            telefon: cleanPhone(v[8]),
            tutar: parseFloat(v[9]) || 0,
            alinan: parseFloat(v[10]) || 0,
            notlar: v[11] || '',
            cekimYeriId: cleanVal(v[12]),
            email: v.length > 25 ? (v[25] || '') : ''
        });
    }

    // ══════════════════════════════════════════════════
    // STEP 7: Load existing Firestore archives
    // ══════════════════════════════════════════════════
    console.log('\n📋 Step 7: Loading existing Firestore archives...');
    const archivesSnap = await studioRef.collection('archives')
        .select('archiveNumber', 'shootTypeId', 'photographerId', 'locationId', 'shootTypeName', 'photographerName', 'locationName')
        .get();

    console.log(`  Firestore archives: ${archivesSnap.size}`);

    const firestoreArchives = new Map();
    archivesSnap.docs.forEach(doc => {
        const d = doc.data();
        firestoreArchives.set(d.archiveNumber, {
            ref: doc.ref,
            shootTypeId: d.shootTypeId,
            photographerId: d.photographerId,
            locationId: d.locationId,
            shootTypeName: d.shootTypeName,
            photographerName: d.photographerName,
            locationName: d.locationName
        });
    });

    // ══════════════════════════════════════════════════
    // STEP 8: Update existing archives + Insert new ones
    // ══════════════════════════════════════════════════
    console.log('\n📋 Step 8: Syncing archives...');

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 450;
    let updated = 0, inserted = 0, skipped = 0;

    async function commitBatch() {
        if (batchCount > 0) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    for (const [archiveNum, sqlData] of sqlArchives) {
        const existing = firestoreArchives.get(archiveNum);

        if (existing) {
            // UPDATE existing archive
            const updateData = {};

            // Always update shootTypeId/Name if SQL has it
            if (sqlData.turId) {
                const stName = shootTypeNames[sqlData.turId] || existingShootTypes[sqlData.turId]?.name || '';
                if (existing.shootTypeId !== sqlData.turId || existing.shootTypeName !== stName) {
                    updateData.shootTypeId = sqlData.turId;
                    updateData.shootTypeName = stName;
                }
            }

            // Always update photographerId/Name if SQL has it
            if (sqlData.cekimciId) {
                const phName = existingPhotographers[sqlData.cekimciId]?.name || photographerNames[sqlData.cekimciId] || '';
                if (existing.photographerId !== sqlData.cekimciId || existing.photographerName !== phName) {
                    updateData.photographerId = sqlData.cekimciId;
                    updateData.photographerName = phName;
                }
            }

            // Always update locationId/Name if SQL has it
            if (sqlData.cekimYeriId) {
                const locName = existingLocations[sqlData.cekimYeriId]?.name || locationNames[sqlData.cekimYeriId] || '';
                if (existing.locationId !== sqlData.cekimYeriId || existing.locationName !== locName) {
                    updateData.locationId = sqlData.cekimYeriId;
                    updateData.locationName = locName;
                }
            }

            if (Object.keys(updateData).length > 0) {
                updateData.updatedAt = admin.firestore.Timestamp.now();
                batch.update(existing.ref, updateData);
                batchCount++;
                updated++;
            } else {
                skipped++;
            }
        } else {
            // INSERT new archive
            const stName = sqlData.turId ? (shootTypeNames[sqlData.turId] || existingShootTypes[sqlData.turId]?.name || '') : '';
            const phName = sqlData.cekimciId ? (existingPhotographers[sqlData.cekimciId]?.name || photographerNames[sqlData.cekimciId] || '') : '';
            const locName = sqlData.cekimYeriId ? (existingLocations[sqlData.cekimYeriId]?.name || '') : '';

            const description1 = sqlData.ebat ? `${sqlData.notlar}\n[Ebat: ${sqlData.ebat}]`.trim() : (sqlData.notlar || '');

            const newDoc = {
                archiveNumber: archiveNum,
                studioId: STUDIO_ID,
                fullName: sqlData.fullName,
                phone: sqlData.telefon || '0000000000',
                shootTypeId: sqlData.turId,
                shootTypeName: stName,
                locationId: sqlData.cekimYeriId,
                locationName: locName,
                photographerId: sqlData.cekimciId,
                photographerName: phName,
                description1,
                description2: null,
                totalAmount: sqlData.tutar,
                cashAmount: sqlData.alinan,
                cardAmount: 0,
                transferAmount: 0,
                isPaid: sqlData.alinan >= sqlData.tutar,
                status: sqlData.durum === 0 ? 'active' : 'archived',
                email: sqlData.email || null,
                legacyId: archiveNum,
                shootDate: admin.firestore.Timestamp.fromDate(sqlData.shootDate),
                createdAt: admin.firestore.Timestamp.fromDate(sqlData.shootDate),
                updatedAt: admin.firestore.Timestamp.now(),
                createdById: 'sql-sync',
                importedAt: admin.firestore.Timestamp.now()
            };

            const docRef = studioRef.collection('archives').doc();
            batch.set(docRef, newDoc);
            batchCount++;
            inserted++;
        }

        if (batchCount >= BATCH_SIZE) {
            console.log(`  📤 Committing batch... (updated: ${updated}, inserted: ${inserted}, skipped: ${skipped})`);
            await commitBatch();
        }
    }

    await commitBatch();

    // Update counter if we inserted new archives
    if (inserted > 0) {
        const maxNum = Math.max(...Array.from(sqlArchives.keys()));
        const counterRef = studioRef.collection('counters').doc('archives');
        const counterSnap = await counterRef.get();
        const currentMax = counterSnap.exists ? (counterSnap.data().current || 0) : 0;
        if (maxNum > currentMax) {
            await counterRef.set({ current: maxNum }, { merge: true });
            console.log(`  📊 Counter updated: ${currentMax} → ${maxNum}`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Full sync complete!');
    console.log(`  Updated: ${updated}`);
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Skipped (no changes): ${skipped}`);
    console.log('='.repeat(50));

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
