const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Script Args: node build-studio.js <studioId> <studioName>
const studioId = process.argv[2];
const studioName = process.argv[3];

if (!studioId || !studioName) {
    console.error('Kullanım: node build-studio.js <studioId> <studioName>');
    process.exit(1);
}

// SECURITY: Validate inputs to prevent injection
if (!/^[a-zA-Z0-9_-]+$/.test(studioId)) {
    console.error('Invalid studioId format. Only alphanumeric, hyphens, and underscores allowed.');
    process.exit(1);
}

// Yollar
const ROOT_DIR = path.resolve(__dirname, '../../../');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const CREATOR_PANEL_DIR = path.join(ROOT_DIR, 'creator_control_panel');
const OUTPUT_DIR = path.join(CREATOR_PANEL_DIR, 'builds', studioName.replace(/\s+/g, '_'));
const CLIENT_CONFIG_FILE = path.join(CLIENT_DIR, 'src', 'config.js');

// 1. Config Dosyasını Güncelle
console.log(`🔨 [Config] ${studioName} (${studioId}) için config dosyası hazırlanıyor...`);

const configContent = `/**
 * Studyo Uygulama Konfigürasyonu
 * BU DOSYA OTOMATİK OLUŞTURULDU.
 * ${new Date().toISOString()}
 */

export const STUDIO_ID = ${JSON.stringify(studioId)};
export const APP_VERSION = '2.0.0';
`;

fs.writeFileSync(CLIENT_CONFIG_FILE, configContent);
console.log('✅ Config dosyası güncellendi.');

// 2. React Build (Vite)
console.log('🔨 [React Build] Vite ile build alınıyor...');
try {
    execSync('npm run build', { cwd: CLIENT_DIR, stdio: 'inherit' });
    console.log('✅ React Build Tamamlandı.');
} catch (error) {
    console.error('❌ React Build Hatası:', error);
    process.exit(1);
}

// 3. Electron Build (Electron Builder)
console.log('🔨 [Electron Build] EXE paketleniyor...');
try {
    // productName'i geçici olarak değiştirmek karmaşık olabilir (package.json düzenlemesi gerekir).
    // Şimdilik standart "Studyo" ismiyle çıksın, sonra dosya adını değiştirelim.
    execSync('npm run electron:build', { cwd: CLIENT_DIR, stdio: 'inherit' });
    console.log('✅ Electron Build Tamamlandı.');
} catch (error) {
    console.error('❌ Electron Build Hatası:', error);
    process.exit(1);
}

// 4. Taşıma ve Yeniden Adlandırma
console.log('🚚 [Taşıma] EXE dosyası taşınıyor...');
fs.ensureDirSync(OUTPUT_DIR);

const distDir = path.join(CLIENT_DIR, 'dist');
const files = fs.readdirSync(distDir);
const exeFile = files.find(file => file.endsWith('.exe'));

if (exeFile) {
    const oldPath = path.join(distDir, exeFile);
    const newFileName = `Studyo_${studioName.replace(/\s+/g, '_')}_Setup.exe`;
    const newPath = path.join(OUTPUT_DIR, newFileName);

    fs.copySync(oldPath, newPath);
    console.log(`🎉 BAŞARILI! Dosya konumu:\n${newPath}`);
} else {
    console.error('⚠️ EXE dosyası bulunamadı!');
}
