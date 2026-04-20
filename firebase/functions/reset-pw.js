const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const refreshToken = config.tokens.refresh_token;

const CLIENT_ID = process.env.FIREBASE_CLI_CLIENT_ID;
const CLIENT_SECRET = process.env.FIREBASE_CLI_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('FIREBASE_CLI_CLIENT_ID and FIREBASE_CLI_CLIENT_SECRET env vars are required.');
    process.exit(1);
}

const TARGET_EMAIL = process.env.RESET_TARGET_EMAIL;
if (!TARGET_EMAIL) {
    console.error('RESET_TARGET_EMAIL env var is required.');
    process.exit(1);
}

const NEW_PASSWORD = process.env.RESET_NEW_PASSWORD || crypto.randomBytes(12).toString('base64url');

admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'studyo-live-2026',
    credential: admin.credential.refreshToken({
        type: 'authorized_user',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken
    })
});

admin.auth().getUserByEmail(TARGET_EMAIL)
    .then(user => {
        console.log('UID:', user.uid);
        return admin.auth().updateUser(user.uid, { password: NEW_PASSWORD });
    })
    .then(() => {
        console.log('Şifre güncellendi. Yeni şifre:', NEW_PASSWORD);
        console.log('Bu şifreyi güvenli bir şekilde saklayın.');
        process.exit(0);
    })
    .catch(e => { console.error('HATA:', e.message); process.exit(1); });
