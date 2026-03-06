import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Database, CheckCircle, AlertCircle, X, Play, FileCode2, Users, Camera, MapPin, Package, CreditCard, Calendar, Loader2 } from 'lucide-react';
import { db, functions } from '../lib/firebase';
import { collection, getDocs, collectionGroup } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { creatorApi } from '../services/creatorApi';

// ─── SQL PARSER (adapted from migrate-to-firestore.js) ───────────────────────

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
            if (next === "'") {
                current += "'";
                i++;
                continue;
            }
            inString = false;
            continue;
        }

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
    if (!dateStr) return null;
    try {
        const clean = dateStr.replace(/\.000$/, '').trim();
        const d = new Date(clean);
        return isNaN(d.getTime()) ? null : d.getTime();
    } catch {
        return null;
    }
}

function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/[\s\-\*\/]/g, '').trim() || '';
}

// ─── SINGLE-PASS SQL EXTRACTOR ────────────────────────────────────────────────
// Scans the entire SQL content ONCE and collects tuples for all known tables.

const KNOWN_TABLES = ['tblArsiv', 'tblTahsilat', 'tblRandevu', 'tblSabit', 'tblPaket', 'tblPersonel'];

function extractAllTuples(content) {
    const result = {};
    for (const t of KNOWN_TABLES) result[t] = [];

    // Build a set of patterns we're looking for
    const insertPrefix = 'INSERT INTO "';
    let searchPos = 0;

    while (true) {
        const insertPos = content.indexOf(insertPrefix, searchPos);
        if (insertPos === -1) break;

        // Extract table name between quotes
        const nameStart = insertPos + insertPrefix.length;
        const nameEnd = content.indexOf('"', nameStart);
        if (nameEnd === -1) break;

        const tableName = content.substring(nameStart, nameEnd);
        searchPos = nameEnd + 1;

        // Skip tables we don't care about
        if (!result[tableName]) continue;

        const valuesPos = content.indexOf('VALUES', searchPos);
        if (valuesPos === -1) break;

        // Find end of this INSERT statement (next INSERT or EOF)
        const nextInsertPos = content.indexOf(insertPrefix, valuesPos + 6);
        const endPos = nextInsertPos !== -1 ? nextInsertPos : content.length;

        const valuesStr = content.substring(valuesPos + 6, endPos);

        // Extract individual tuples from the VALUES section
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
                            result[tableName].push(current.trim());
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

    return result;
}

// ─── TABLE PARSERS (accept pre-extracted tuples) ──────────────────────────────

function parseArchives(tuples) {
    const records = [];

    for (const tuple of tuples) {
        try {
            const v = parseTuple(tuple);
            if (v.length < 12) continue;

            // tblArsiv: ArsivID(0), Isim(1), Tarih(2), TeslimGunu(3), Ebat(4), CekimciID(5), TurID(6), Durum(7), Telefon(8), Tutar(9), Alinan(10), Notlar(11), CekimYeriID(12), Sifre(13), SonIslem(14), SonIslemTarih(15), IslemGecmisi(16), WebeAktarildi(17), PaketID(18), SonIslemiYapan(19), CekimTuruID(20), IUserID(21), IDate(22), UUserID(23), UDate(24), eposta(25)
            const oldId = parseInt(v[0]) || 0;
            const durum = parseInt(v[7]) || 0;
            const tutar = parseFloat(v[9]) || 0;
            const alinan = parseFloat(v[10]) || 0;
            const ebat = v[4] || '';
            const notlar = v[11] || '';
            const description1 = ebat ? `${notlar}\nEbat: ${ebat}`.trim() : (notlar || '');

            // Legacy ID mapping: CekimTuruID(20) or TurID(6) → shootTypeId, CekimYeriID(12) → locationId, CekimciID(5) → photographerId
            // Note: 0 means NULL in SQL, so treat it as missing
            const rawShootType20 = v[20] ? parseInt(v[20]) : 0;
            const rawShootType6 = v[6] ? parseInt(v[6]) : 0;
            const shootTypeId = rawShootType20 > 0 ? String(rawShootType20) : (rawShootType6 > 0 ? String(rawShootType6) : null);
            const rawLocation = v[12] ? parseInt(v[12]) : 0;
            const locationId = rawLocation > 0 ? String(rawLocation) : null;
            const rawPhotographer = v[5] ? parseInt(v[5]) : 0;
            const photographerId = rawPhotographer > 0 ? String(rawPhotographer) : null;

            records.push({
                archiveNumber: oldId,
                legacyId: oldId,
                fullName: v[1] || 'İsimsiz',
                phone: cleanPhone(v[8]),
                totalAmount: tutar,
                cashAmount: alinan,
                cardAmount: 0,
                transferAmount: 0,
                isPaid: alinan >= tutar && tutar > 0,
                status: durum === 0 ? 'active' : 'archived',
                description1,
                description2: null,
                shootTypeId,
                locationId,
                photographerId,
                packageId: v[18] ? parseInt(v[18]) : null,
                email: v[25] || null,
                deliveryDate: v[3] || null,
                shootDate: parseDate(v[2]),
                createdAt: parseDate(v[22]) || parseDate(v[2]),
            });
        } catch (e) {
            console.warn('Archive parse error:', e.message);
        }
    }

    return records;
}

function parsePayments(tuples) {
    const records = [];

    for (const tuple of tuples) {
        try {
            const v = parseTuple(tuple);
            if (v.length < 6) continue;

            // tblTahsilat: TahsilatID(0), Tarih(1), RandevuID(2), ArsivID(3), Tutar(4), KK(5), Aciklama(6)
            records.push({
                legacyId: parseInt(v[0]) || 0,
                date: parseDate(v[1]),
                legacyRandevuId: parseInt(v[2]) || 0,
                archiveNumber: parseInt(v[3]) || 0,
                amount: parseFloat(v[4]) || 0,
                method: parseInt(v[5]) === 1 ? 'card' : 'cash',
                description: v[6] || ''
            });
        } catch (e) {
            console.warn('Payment parse error:', e.message);
        }
    }

    return records;
}

function parseAppointments(tuples) {
    const records = [];

    for (const tuple of tuples) {
        try {
            const v = parseTuple(tuple);
            if (v.length < 10) continue;

            // tblRandevu: RandevuID(0), RandevuYer(1), Tarih(2), RandevuSaat(3), Isim(4), Telefon(5), CekimTuru(6), Aciklama(7), Aciklama2(8), YerMekan(9), Durum(10), Personel(11), Tutar(12), Alinan(13), Kalan(14), IUserID(15), IDate(16), UUserID(17), UDate(18)
            records.push({
                legacyId: parseInt(v[0]) || 0,
                location: parseInt(v[1]) || 0,
                date: parseDate(v[2]),
                time: v[3] || '',
                customerName: v[4] || '',
                phone: cleanPhone(v[5]),
                shootType: v[6] || '',
                description: v[7] || '',
                description2: v[8] || '',
                venue: v[9] || '',
                status: parseInt(v[10]) === 0 ? 'active' : 'completed',
                personnel: v[11] || '',
                totalAmount: parseFloat(v[12]) || 0,
                paidAmount: parseFloat(v[13]) || 0,
                remainingAmount: parseFloat(v[14]) || 0,
                createdAt: parseDate(v[16])
            });
        } catch (e) {
            console.warn('Appointment parse error:', e.message);
        }
    }

    return records;
}

function parseLookups(tuples) {
    const lookups = {
        shootTypes: [],
        locations: [],
        photographers: []
    };

    // tblSabit: SabitID(0), SabitName(1), Numara(2), Deger(3), SiraNo(4)
    for (const tuple of tuples) {
        try {
            const v = parseTuple(tuple);
            if (v.length < 4) continue;

            const sabitName = (v[1] || '').toUpperCase();
            const numara = parseInt(v[2]) || 0;
            const deger = v[3] || '';

            if (!deger) continue;

            if (sabitName === 'CTURU' || sabitName === 'CEKIMTURU') {
                lookups.shootTypes.push({ legacyId: numara, name: deger });
            } else if (sabitName === 'CT') {
                lookups.locations.push({ legacyId: numara, name: deger });
            } else if (sabitName === 'CEKIMCI') {
                lookups.photographers.push({ legacyId: numara, name: deger });
            }
        } catch (e) {
            console.warn('Lookup parse error:', e.message);
        }
    }

    return lookups;
}

function parsePackages(tuples) {
    const records = [];

    for (const tuple of tuples) {
        try {
            const v = parseTuple(tuple);
            if (v.length < 4) continue;

            // tblPaket: PaketID(0), CekimTuruID(1), PaketAdi(2), Tutar(3)
            records.push({
                legacyId: parseInt(v[0]) || 0,
                shootTypeId: parseInt(v[1]) || null,
                name: v[2] || '',
                price: parseFloat(v[3]) || 0
            });
        } catch (e) {
            console.warn('Package parse error:', e.message);
        }
    }

    return records;
}

function parsePersonnel(tuples) {
    const records = [];

    for (const tuple of tuples) {
        try {
            const v = parseTuple(tuple);
            if (v.length < 3) continue;

            // tblPersonel: PersonelID(0), Isim(1), Telefon(2)
            records.push({
                legacyId: parseInt(v[0]) || 0,
                name: v[1] || '',
                phone: cleanPhone(v[2])
            });
        } catch (e) {
            console.warn('Personnel parse error:', e.message);
        }
    }

    return records;
}

// ─── MIGRATION BOT COMPONENT ─────────────────────────────────────────────────

export default function Migration() {
    const [studios, setStudios] = useState([]);
    const [selectedStudio, setSelectedStudio] = useState('');
    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // Parse state
    const [parsing, setParsing] = useState(false);
    const [parsedData, setParsedData] = useState(null);

    // Migration state
    const [migrating, setMigrating] = useState(false);
    const [migrationProgress, setMigrationProgress] = useState(null);
    const [migrationLogs, setMigrationLogs] = useState([]);

    useEffect(() => { loadStudios(); }, []);

    async function loadStudios() {
        try {
            const result = await creatorApi.getStudiosWithStats();
            if (result?.studios) {
                // Group studios by organization for optgroup display
                const grouped = {};
                for (const studio of result.studios) {
                    const orgName = studio.organizationName || 'Bağımsız';
                    const orgId = studio.organizationId || 'legacy';
                    if (!grouped[orgId]) {
                        grouped[orgId] = { name: orgName, studios: [] };
                    }
                    grouped[orgId].studios.push({
                        id: studio.id,
                        organizationId: orgId,
                        name: studio.info?.name || studio.name || studio.id
                    });
                }
                setStudios(result.studios.map(s => ({
                    id: s.id,
                    organizationId: s.organizationId || 'legacy',
                    organizationName: s.organizationName || 'Bağımsız',
                    name: s.info?.name || s.name || s.id
                })));
            }
        } catch (error) {
            console.error('Load studios error:', error);
        }
    }

    const addLog = useCallback((message, type = 'info') => {
        setMigrationLogs(prev => [...prev, {
            time: new Date().toLocaleTimeString('tr-TR'),
            message,
            type
        }]);
    }, []);

    // ─── File handling ────────────────────────────────────────

    function handleDragOver(e) { e.preventDefault(); setDragOver(true); }
    function handleDragLeave(e) { e.preventDefault(); setDragOver(false); }

    function handleDrop(e) {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) processFile(droppedFile);
    }

    function handleFileSelect(e) {
        const selectedFile = e.target.files[0];
        if (selectedFile) processFile(selectedFile);
    }

    function processFile(selectedFile) {
        const ext = selectedFile.name.split('.').pop().toLowerCase();
        if (ext !== 'sql') {
            alert('Sadece .sql dosyaları desteklenmektedir. ProRandevu veritabanı dump dosyasını seçin.');
            return;
        }
        setFile(selectedFile);
        setParsedData(null);
        setMigrationProgress(null);
        setMigrationLogs([]);
    }

    function resetForm() {
        setFile(null);
        setParsedData(null);
        setMigrationProgress(null);
        setMigrationLogs([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    // ─── Parse SQL (single-pass) ──────────────────────────────

    async function handleParse() {
        if (!file) return;
        setParsing(true);
        setParsedData(null);
        setMigrationLogs([]);
        addLog('📄 SQL dosyası okunuyor...', 'info');

        try {
            const content = await readFileContent(file);
            addLog(`✅ Dosya yüklendi (${(content.length / 1024 / 1024).toFixed(2)} MB)`, 'success');

            const t0 = performance.now();
            addLog('🔍 Tek geçişte tüm tablolar ayrıştırılıyor...', 'info');
            const allTuples = extractAllTuples(content);
            const extractMs = (performance.now() - t0).toFixed(0);
            addLog(`  ⚡ Tuple çıkarma: ${extractMs}ms`, 'success');

            const archives = parseArchives(allTuples.tblArsiv);
            addLog(`  📦 ${archives.length} arşiv kaydı bulundu`, 'success');

            const payments = parsePayments(allTuples.tblTahsilat);
            addLog(`  💰 ${payments.length} ödeme kaydı bulundu`, 'success');

            // Cross-reference: enrich archives with payment method breakdown
            const paymentsByArchive = {};
            for (const p of payments) {
                const key = p.archiveNumber;
                if (!key) continue;
                if (!paymentsByArchive[key]) paymentsByArchive[key] = { cash: 0, card: 0 };
                if (p.method === 'card') {
                    paymentsByArchive[key].card += (p.amount || 0);
                } else {
                    paymentsByArchive[key].cash += (p.amount || 0);
                }
            }
            let enriched = 0;
            for (const arch of archives) {
                const breakdown = paymentsByArchive[arch.archiveNumber];
                if (breakdown) {
                    arch.cashAmount = breakdown.cash;
                    arch.cardAmount = breakdown.card;
                    enriched++;
                }
                // If no payments found, cashAmount stays as 'alinan' (legacy total paid), cardAmount stays 0
            }
            addLog(`  🔗 ${enriched} arşiv ödeme yöntemi eşleştirildi (${Object.keys(paymentsByArchive).length} arşive ait ödeme)`, 'success');

            const appointments = parseAppointments(allTuples.tblRandevu);
            addLog(`  📅 ${appointments.length} randevu kaydı bulundu`, 'success');

            const lookups = parseLookups(allTuples.tblSabit);
            addLog(`  🏷️ ${lookups.shootTypes.length} çekim türü, ${lookups.locations.length} mekan, ${lookups.photographers.length} fotoğrafçı`, 'success');

            const packages = parsePackages(allTuples.tblPaket);
            addLog(`  📦 ${packages.length} paket bulundu`, 'success');

            const personnel = parsePersonnel(allTuples.tblPersonel);
            addLog(`  👤 ${personnel.length} personel bulundu`, 'success');

            // Customer analysis: count unique phone numbers across all sources
            const uniquePhones = new Set();
            let archivePhoneCount = 0;
            let appointmentPhoneCount = 0;
            for (const a of archives) {
                const phone = (a.phone || '').trim();
                if (phone) {
                    if (!uniquePhones.has(phone)) archivePhoneCount++;
                    uniquePhones.add(phone);
                }
            }
            for (const appt of appointments) {
                const phone = (appt.phone || '').trim();
                if (phone && !uniquePhones.has(phone)) {
                    uniquePhones.add(phone);
                    appointmentPhoneCount++;
                }
            }
            addLog(`  📱 ${uniquePhones.size} farklı telefon numarası bulundu → ${uniquePhones.size} müşteri kaydı oluşturulacak`, 'success');
            addLog(`     ↳ ${archivePhoneCount} arşivden, ${appointmentPhoneCount} randevudan (yeni)`, 'info');

            const totalMs = (performance.now() - t0).toFixed(0);

            // Calculate financial summary
            const totalRevenue = archives.reduce((sum, a) => sum + (a.totalAmount || 0), 0);
            const totalCash = archives.reduce((sum, a) => sum + (a.cashAmount || 0), 0);
            const totalCard = archives.reduce((sum, a) => sum + (a.cardAmount || 0), 0);
            const totalCollected = totalCash + totalCard;
            const cashPayments = payments.filter(p => p.method === 'cash').length;
            const cardPayments = payments.filter(p => p.method === 'card').length;

            setParsedData({
                archives,
                payments,
                appointments,
                shootTypes: lookups.shootTypes,
                locations: lookups.locations,
                photographers: lookups.photographers,
                packages,
                personnel,
                summary: {
                    totalRevenue,
                    totalCollected,
                    cashPayments,
                    cardPayments,
                    uniqueCustomers: uniquePhones.size,
                    archivePhoneCount,
                    appointmentPhoneCount
                }
            });

            addLog(`\n✅ Ayrıştırma tamamlandı! ${archives.length + payments.length + appointments.length} ana kayıt, ${uniquePhones.size} müşteri, ${totalMs}ms`, 'success');
        } catch (error) {
            console.error('Parse error:', error);
            addLog(`❌ Ayrıştırma hatası: ${error.message}`, 'error');
        } finally {
            setParsing(false);
        }
    }

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Dosya okunamadı'));
            // Try UTF-8 first, then latin1
            reader.readAsText(file, 'UTF-8');
        });
    }

    // ─── Migration ────────────────────────────────────────────

    async function handleMigrate() {
        if (!selectedStudio || !parsedData) return;

        setMigrating(true);
        const migrateFn = httpsCallable(functions, 'legacyMigration-migrateLegacyBatch');
        const selectedOrganizationId = studios.find(s => s.id === selectedStudio)?.organizationId || null;

        // Build customer records from ALL sources with phone numbers
        const customerSourceRecords = [];
        const seenPhones = new Set();

        // Source 1: Archives with phone
        for (const a of parsedData.archives) {
            const phone = (a.phone || '').trim();
            if (phone && !seenPhones.has(phone)) {
                seenPhones.add(phone);
                customerSourceRecords.push(a);
            }
        }

        // Source 2: Appointments with phone (not already seen)
        for (const appt of parsedData.appointments) {
            const phone = (appt.phone || '').trim();
            if (phone && !seenPhones.has(phone)) {
                seenPhones.add(phone);
                customerSourceRecords.push({
                    fullName: appt.customerName || 'İsimsiz',
                    phone: phone,
                    email: null,
                    archiveNumber: 0,
                    totalAmount: appt.totalAmount || 0
                });
            }
        }

        const progress = {
            shootTypes: { total: parsedData.shootTypes.length, done: 0, status: 'pending' },
            locations: { total: parsedData.locations.length, done: 0, status: 'pending' },
            photographers: { total: parsedData.photographers.length, done: 0, status: 'pending' },
            packages: { total: parsedData.packages.length, done: 0, status: 'pending' },
            personnel: { total: parsedData.personnel.length, done: 0, status: 'pending' },
            archives: { total: parsedData.archives.length, done: 0, status: 'pending' },
            customers: { total: customerSourceRecords.length, done: 0, status: 'pending' },
            payments: { total: parsedData.payments.length, done: 0, status: 'pending' },
            appointments: { total: parsedData.appointments.length, done: 0, status: 'pending' },
        };
        setMigrationProgress({ ...progress });

        const CHUNK_SIZE = 300;

        async function migrateCollection(dataType, records, label) {
            if (records.length === 0) {
                progress[dataType].status = 'done';
                setMigrationProgress({ ...progress });
                addLog(`⏭️ ${label}: Kayıt yok, atlanıyor`, 'info');
                return;
            }

            progress[dataType].status = 'running';
            setMigrationProgress({ ...progress });
            addLog(`🚀 ${label}: ${records.length} kayıt aktarılıyor...`, 'info');

            let totalWritten = 0;
            let totalErrors = [];

            for (let i = 0; i < records.length; i += CHUNK_SIZE) {
                const chunk = records.slice(i, i + CHUNK_SIZE);
                try {
                    const result = await migrateFn({
                        studioId: selectedStudio,
                        organizationId: selectedOrganizationId,
                        dataType,
                        records: chunk
                    });

                    totalWritten += result.data.written || 0;
                    if (result.data.errors?.length > 0) {
                        totalErrors.push(...result.data.errors);
                    }

                    progress[dataType].done = totalWritten;
                    setMigrationProgress({ ...progress });
                    addLog(`  📤 ${label}: ${totalWritten}/${records.length} yazıldı`, 'info');
                } catch (error) {
                    addLog(`  ❌ ${label} chunk hatası: ${error.message}`, 'error');
                    totalErrors.push(error.message);
                }
            }

            progress[dataType].status = totalErrors.length > 0 ? 'warning' : 'done';
            progress[dataType].done = totalWritten;
            setMigrationProgress({ ...progress });

            if (totalErrors.length > 0) {
                addLog(`  ⚠️ ${label}: ${totalWritten} yazıldı, ${totalErrors.length} hata`, 'warning');
            } else {
                addLog(`  ✅ ${label}: ${totalWritten} kayıt başarıyla aktarıldı`, 'success');
            }
        }

        try {
            // Import in order: lookups first, then main data
            await migrateCollection('shootTypes', parsedData.shootTypes, 'Çekim Türleri');
            await migrateCollection('locations', parsedData.locations, 'Mekanlar');
            await migrateCollection('photographers', parsedData.photographers, 'Fotoğrafçılar');
            await migrateCollection('packages', parsedData.packages, 'Paketler');
            await migrateCollection('personnel', parsedData.personnel, 'Personel');
            await migrateCollection('archives', parsedData.archives, 'Arşiv Kayıtları');
            await migrateCollection('customers', customerSourceRecords, 'Müşteri Kayıtları');
            await migrateCollection('payments', parsedData.payments, 'Ödemeler');
            await migrateCollection('appointments', parsedData.appointments, 'Randevular');

            addLog('\n🎉 Migration tamamlandı!', 'success');
        } catch (error) {
            addLog(`\n❌ Migration hatası: ${error.message}`, 'error');
        } finally {
            setMigrating(false);
        }
    }

    // Fix existing archives with missing shootTypeId/locationId/photographerId
    async function handleFixArchiveIds() {
        if (!selectedStudio || !parsedData) return;

        setMigrating(true);
        const migrateFn = httpsCallable(functions, 'legacyMigration-migrateLegacyBatch');
        const selectedOrganizationId = studios.find(s => s.id === selectedStudio)?.organizationId || null;
        const CHUNK_SIZE = 100; // Smaller chunks since each doc requires a query

        // Filter only archives that have at least one ID to update
        const fixableArchives = parsedData.archives.filter(a =>
            a.shootTypeId || a.locationId || a.photographerId
        );

        addLog(`\n🔧 Arşiv ID düzeltme başlıyor: ${fixableArchives.length} kayıt güncellenmeli`, 'info');

        let totalWritten = 0;
        let totalSkipped = 0;

        for (let i = 0; i < fixableArchives.length; i += CHUNK_SIZE) {
            const chunk = fixableArchives.slice(i, i + CHUNK_SIZE);
            try {
                const result = await migrateFn({
                    studioId: selectedStudio,
                    organizationId: selectedOrganizationId,
                    dataType: 'updateArchives',
                    records: chunk
                });
                totalWritten += result.data.written || 0;
                totalSkipped += result.data.skipped || 0;
                addLog(`  📤 ${totalWritten}/${fixableArchives.length} güncellendi (${totalSkipped} atlandı)`, 'info');
            } catch (error) {
                addLog(`  ❌ Chunk hatası: ${error.message}`, 'error');
            }
        }

        addLog(`\n✅ Arşiv ID düzeltme tamamlandı: ${totalWritten} güncellendi, ${totalSkipped} atlandı`, 'success');
        setMigrating(false);
    }

    // ─── Render helpers ───────────────────────────────────────

    const studioName = studios.find(s => s.id === selectedStudio)?.name || '';

    function getProgressTotal() {
        if (!migrationProgress) return { done: 0, total: 0 };
        let done = 0, total = 0;
        Object.values(migrationProgress).forEach(p => {
            done += p.done;
            total += p.total;
        });
        return { done, total };
    }

    // ─── RENDER ───────────────────────────────────────────────

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Migration Bot</h1>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    ProRandevu Legacy Veritabanı Aktarım Aracı
                </span>
            </div>

            {/* Step 1: Studio & File Selection */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <h2 className="card-title">
                        <Database size={20} />
                        1. Stüdyo ve SQL Dosyası Seçimi
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Studio selector */}
                    <div>
                        <label className="form-label">Hedef Stüdyo *</label>
                        <select
                            className="form-input"
                            value={selectedStudio}
                            onChange={(e) => setSelectedStudio(e.target.value)}
                            disabled={migrating}
                        >
                            <option value="">Stüdyo seçin...</option>
                            {(() => {
                                // Group studios by organization for optgroup
                                const groups = {};
                                studios.forEach(s => {
                                    const orgKey = s.organizationId || 'legacy';
                                    const orgName = s.organizationName || 'Bağımsız';
                                    if (!groups[orgKey]) groups[orgKey] = { name: orgName, items: [] };
                                    groups[orgKey].items.push(s);
                                });
                                return Object.entries(groups).map(([orgId, group]) => (
                                    <optgroup key={orgId} label={`🏢 ${group.name}`}>
                                        {group.items.map(studio => (
                                            <option key={studio.id} value={studio.id}>
                                                {studio.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ));
                            })()}
                        </select>
                        {selectedStudio && (
                            <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent-primary)' }}>
                                📍 Veriler: studios/{selectedStudio}/...
                            </p>
                        )}
                    </div>

                    {/* SQL file drop zone */}
                    <div>
                        <label className="form-label">SQL Dosyası *</label>
                        <div
                            className={`migration-zone ${dragOver ? 'dragover' : ''}`}
                            style={{ padding: '20px' }}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => !migrating && fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".sql"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                            {file ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <FileCode2 size={24} color="var(--accent-primary)" />
                                    <div style={{ flex: 1, textAlign: 'left' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{file.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={(e) => { e.stopPropagation(); resetForm(); }}
                                        disabled={migrating}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗄️</div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        Database.sql dosyasını sürükleyin veya seçin
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Parse button */}
                {file && !parsedData && (
                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleParse}
                            disabled={parsing}
                            style={{ opacity: parsing ? 0.7 : 1, minWidth: '200px' }}
                        >
                            {parsing ? (
                                <><Loader2 size={18} className="spin" /> SQL Ayrıştırılıyor...</>
                            ) : (
                                <><Play size={18} /> SQL Dosyasını Analiz Et</>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Step 2: Parse Results */}
            {parsedData && (
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div className="card-header">
                        <h2 className="card-title">
                            <CheckCircle size={20} color="var(--accent-success)" />
                            2. Ayrıştırma Sonuçları
                        </h2>
                    </div>

                    {/* Stats grid */}
                    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        <StatCard icon="📸" label="Arşiv" count={parsedData.archives.length} color="primary" />
                        <StatCard icon="💰" label="Ödeme" count={parsedData.payments.length} color="success" />
                        <StatCard icon="📅" label="Randevu" count={parsedData.appointments.length} color="warning" />
                        <StatCard icon="🏷️" label="Çekim Türü" count={parsedData.shootTypes.length} color="primary" />
                        <StatCard icon="📍" label="Mekan" count={parsedData.locations.length} color="success" />
                        <StatCard icon="📷" label="Fotoğrafçı" count={parsedData.photographers.length} color="warning" />
                        <StatCard icon="📦" label="Paket" count={parsedData.packages.length} color="primary" />
                        <StatCard icon="👤" label="Personel" count={parsedData.personnel.length} color="success" />
                    </div>

                    {/* Financial summary */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '16px',
                        marginTop: '16px',
                        padding: '16px',
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Toplam Ciro</div>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>
                                ₺{parsedData.summary.totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Toplam Tahsilat</div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-success)' }}>
                                ₺{parsedData.summary.totalCollected.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Nakit / Kredi Kartı</div>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>
                                {parsedData.summary.cashPayments} / {parsedData.summary.cardPayments}
                            </div>
                        </div>
                    </div>

                    {/* Sample data preview */}
                    {parsedData.archives.length > 0 && (
                        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
                            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Arşiv Önizleme (ilk 5 kayıt)
                            </h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr>
                                        {['No', 'İsim', 'Telefon', 'Tutar', 'Alınan', 'Durum', 'Tarih'].map(h => (
                                            <th key={h} style={{
                                                textAlign: 'left', padding: '6px 10px',
                                                background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)',
                                                color: 'var(--text-secondary)', fontWeight: 600
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedData.archives.slice(0, 5).map((a, i) => (
                                        <tr key={i}>
                                            <td style={tdStyle}>{a.archiveNumber}</td>
                                            <td style={tdStyle}>{a.fullName}</td>
                                            <td style={tdStyle}>{a.phone}</td>
                                            <td style={tdStyle}>₺{a.totalAmount.toFixed(2)}</td>
                                            <td style={tdStyle}>₺{a.cashAmount.toFixed(2)}</td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
                                                    background: a.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
                                                    color: a.status === 'active' ? '#22c55e' : '#94a3b8'
                                                }}>{a.status}</span>
                                            </td>
                                            <td style={tdStyle}>{a.shootDate ? new Date(a.shootDate).toLocaleDateString('tr-TR') : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Migrate button */}
                    <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleMigrate}
                            disabled={migrating || !selectedStudio}
                            style={{
                                opacity: (migrating || !selectedStudio) ? 0.5 : 1,
                                minWidth: '250px',
                                padding: '14px 32px',
                                fontSize: '15px'
                            }}
                        >
                            {migrating ? (
                                <><Loader2 size={18} className="spin" /> Migration Devam Ediyor...</>
                            ) : (
                                <><Upload size={18} /> {studioName ? `"${studioName}" stüdyosuna aktar` : 'Stüdyo seçin'}</>
                            )}
                        </button>

                        <button
                            className="btn btn-secondary"
                            onClick={handleFixArchiveIds}
                            disabled={migrating || !selectedStudio}
                            style={{
                                opacity: (migrating || !selectedStudio) ? 0.5 : 1,
                                minWidth: '220px',
                                padding: '14px 24px',
                                fontSize: '14px',
                                border: '1px solid var(--accent-warning)',
                                color: 'var(--accent-warning)'
                            }}
                        >
                            🔧 Arşiv ID'lerini Düzelt
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Migration Progress */}
            {migrationProgress && (
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div className="card-header">
                        <h2 className="card-title">
                            {migrating ? <Loader2 size={20} className="spin" /> : <CheckCircle size={20} color="var(--accent-success)" />}
                            3. Migration İlerlemesi
                        </h2>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {getProgressTotal().done} / {getProgressTotal().total}
                        </span>
                    </div>

                    {/* Overall progress bar */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{
                            width: '100%', height: '8px',
                            background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${getProgressTotal().total > 0 ? (getProgressTotal().done / getProgressTotal().total * 100) : 0}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-success))',
                                borderRadius: '4px',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>

                    {/* Per-collection progress */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        {Object.entries(migrationProgress).map(([key, val]) => (
                            <ProgressItem key={key} name={collectionLabels[key] || key} progress={val} />
                        ))}
                    </div>
                </div>
            )}

            {/* Migration Logs */}
            {migrationLogs.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">📋 Migration Logları</h2>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {migrationLogs.length} kayıt
                        </span>
                    </div>
                    <div className="migration-log-container">
                        {migrationLogs.map((log, i) => (
                            <div key={i} className={`migration-log-line ${log.type}`}>
                                <span className="migration-log-time">{log.time}</span>
                                <span>{log.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const tdStyle = {
    padding: '6px 10px',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    maxWidth: '160px', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap'
};

const collectionLabels = {
    shootTypes: '🏷️ Çekim Türleri',
    locations: '📍 Mekanlar',
    photographers: '📷 Fotoğrafçılar',
    packages: '📦 Paketler',
    personnel: '👤 Personel',
    archives: '📸 Arşiv',
    customers: '👥 Müşteriler',
    payments: '💰 Ödemeler',
    appointments: '📅 Randevular'
};

function StatCard({ icon, label, count, color }) {
    return (
        <div className="stat-card">
            <div className={`stat-icon ${color}`}>{icon}</div>
            <div className="stat-content">
                <h3>{count.toLocaleString('tr-TR')}</h3>
                <p>{label}</p>
            </div>
        </div>
    );
}

function ProgressItem({ name, progress }) {
    const pct = progress.total > 0 ? (progress.done / progress.total * 100) : 0;
    const statusColors = {
        pending: 'var(--text-muted)',
        running: 'var(--accent-primary)',
        done: 'var(--accent-success)',
        warning: 'var(--accent-warning)'
    };

    return (
        <div style={{
            padding: '12px',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: progress.status === 'running' ? '1px solid var(--accent-primary)' : '1px solid transparent'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: statusColors[progress.status] }}>{name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {progress.done}/{progress.total}
                </span>
            </div>
            <div style={{
                width: '100%', height: '4px',
                background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden'
            }}>
                <div style={{
                    width: `${pct}%`, height: '100%',
                    background: statusColors[progress.status],
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                }} />
            </div>
        </div>
    );
}
