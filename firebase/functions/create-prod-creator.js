/**
 * Create Creator account on PRODUCTION Firebase Auth
 * Uses firebase-tools credential workaround
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Firebase CLI stores credentials here on Windows
const configDir = path.join(os.homedir(), '.config', 'configstore');
const firebaseToolsPath = path.join(configDir, 'firebase-tools.json');

let credential;
try {
    // Try to use firebase-tools stored credentials
    const stored = JSON.parse(fs.readFileSync(firebaseToolsPath, 'utf8'));
    const tokens = stored.tokens;

    if (tokens && tokens.refresh_token) {
        const { GoogleAuth } = require('google-auth-library');
        const { applicationDefault } = require('firebase-admin/app');

        // Set environment variable so admin SDK can find credentials
        process.env.GOOGLE_CLOUD_PROJECT = 'studyo-live-2026';

        const app = initializeApp({ projectId: 'studyo-live-2026' });
        credential = getAuth(app);
    }
} catch (e) {
    console.log('Could not read firebase-tools credentials:', e.message);
}

if (!credential) {
    // Fallback: use default initialization
    const app = initializeApp({ projectId: 'studyo-live-2026' });
    credential = getAuth(app);
}

async function main() {
    const email = 'creator@studyo.app';
    const password = process.env.CREATOR_PW || crypto.randomBytes(12).toString('base64url');
    const auth = credential;

    try {
        console.log('Creating creator on PRODUCTION...');

        let uid;
        try {
            const user = await auth.getUserByEmail(email);
            uid = user.uid;
            console.log('User exists, updating...');
            await auth.updateUser(uid, { password });
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                const user = await auth.createUser({ email, password, displayName: 'Creator Admin' });
                uid = user.uid;
                console.log('Created UID:', uid);
            } else throw e;
        }

        await auth.setCustomUserClaims(uid, { role: 'creator', super_admin: true });
        console.log('DONE! Email:', email, 'Password:', password);
        console.log('Store this password safely. It cannot be retrieved later.');
    } catch (e) {
        console.error('ERROR:', e.code || '', e.message);
    }
    process.exit(0);
}

main();
