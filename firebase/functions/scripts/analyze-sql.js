/**
 * Analyze SQL dump for missing shootTypeId / locationId data
 */
const fs = require('fs');
const path = require('path');

const SQL_FILE = path.join(__dirname, '../../../Eski bir db/21.02.26/randevu4101.sql');

// Reuse parsers
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

let content;
try { content = fs.readFileSync(SQL_FILE, 'utf8'); }
catch { content = fs.readFileSync(SQL_FILE, 'latin1'); }
console.log(`File: ${SQL_FILE}`);
console.log(`Size: ${(content.length / 1024 / 1024).toFixed(1)} MB\n`);

// List all tables
const tableMatches = content.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/g) || [];
console.log('=== Tables ===');
tableMatches.forEach(t => console.log('  ' + t.replace('CREATE TABLE IF NOT EXISTS ', '')));

// Show tblArsiv CREATE TABLE
const createIdx = content.indexOf('CREATE TABLE IF NOT EXISTS "tblArsiv"');
if (createIdx !== -1) {
    const endCreate = content.indexOf(');', createIdx);
    console.log('\n=== tblArsiv Schema ===');
    console.log(content.substring(createIdx, endCreate + 2));
}

// Parse tblArsiv tuples
console.log('\n=== tblArsiv Analysis ===');
const tuples = extractTuples(content, 'tblArsiv');
console.log(`Total records: ${tuples.length}`);

const turIdDistrib = {};
const cekimYeriDistrib = {};
const cekimciDistrib = {};
let nullTur = 0, zeroTur = 0, nullYeri = 0, zeroYeri = 0, nullCekimci = 0, zeroCekimci = 0;

for (const tuple of tuples) {
    const v = parseTuple(tuple);
    if (v.length < 13) continue;
    // ArsivID(0), Isim(1), Tarih(2), TeslimGunu(3), Ebat(4), CekimciID(5), TurID(6), Durum(7), Telefon(8), Tutar(9), Alinan(10), Notlar(11), CekimYeriID(12)
    const turId = v[6];
    const cekimYeriId = v[12];
    const cekimciId = v[5];

    if (!turId || turId === 'NULL') nullTur++;
    else if (turId === '0') zeroTur++;
    else turIdDistrib[turId] = (turIdDistrib[turId] || 0) + 1;

    if (!cekimYeriId || cekimYeriId === 'NULL') nullYeri++;
    else if (cekimYeriId === '0') zeroYeri++;
    else cekimYeriDistrib[cekimYeriId] = (cekimYeriDistrib[cekimYeriId] || 0) + 1;

    if (!cekimciId || cekimciId === 'NULL') nullCekimci++;
    else if (cekimciId === '0') zeroCekimci++;
    else cekimciDistrib[cekimciId] = (cekimciDistrib[cekimciId] || 0) + 1;
}

console.log(`\nTurID (Çekim Türü):`);
console.log(`  NULL: ${nullTur}, Zero: ${zeroTur}`);
console.log(`  Distribution:`);
Object.entries(turIdDistrib).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    TurID=${k}: ${v} records`));

console.log(`\nCekimYeriID (Çekim Yeri):`);
console.log(`  NULL: ${nullYeri}, Zero: ${zeroYeri}`);
console.log(`  Distribution:`);
Object.entries(cekimYeriDistrib).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    CekimYeriID=${k}: ${v} records`));

console.log(`\nCekimciID (Fotoğrafçı):`);
console.log(`  NULL: ${nullCekimci}, Zero: ${zeroCekimci}`);
console.log(`  Distribution:`);
Object.entries(cekimciDistrib).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    CekimciID=${k}: ${v} records`));

// Check tblSabit for possible shoot type definitions
console.log('\n=== tblSabit (Constants Table) ===');
const sabitTuples = extractTuples(content, 'tblSabit');
console.log(`Records: ${sabitTuples.length}`);
sabitTuples.slice(0, 30).forEach((t, i) => {
    const v = parseTuple(t);
    console.log(`  [${i}] ${JSON.stringify(v.slice(0, 5))}`);
});
