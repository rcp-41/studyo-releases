/**
 * Create initial admin user in LIVE environment
 * Usage: Provide service account credentials or ensure local login via `firebase login`
 *
 * SECURITY: Credentials must be passed via environment variables:
 *   ADMIN_EMAIL=admin@studyo.com ADMIN_PASSWORD=your_secure_password node create-live-admin.js
 */

const admin = require('firebase-admin');

// Initialize with application default credentials
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'studyo-live-2026'
});

const auth = admin.auth();
const db = admin.firestore();

async function createLiveAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        console.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
        console.error('Usage: ADMIN_EMAIL=admin@studyo.com ADMIN_PASSWORD=your_secure_password node create-live-admin.js');
        process.exit(1);
    }

    if (password.length < 16) {
        console.error('Password must be at least 16 characters long.');
        process.exit(1);
    }

    try {
        console.log('Connecting to LIVE project: studyo-live-2026...');

        let uid;

        // Check if user already exists
        try {
            const existingUser = await auth.getUserByEmail(email);
            console.log('User already exists:', existingUser.uid);
            uid = existingUser.uid;
        } catch (e) {
            // User doesn't exist, create it
            console.log('User not found, creating new user...');
            const userRecord = await auth.createUser({
                email,
                password,
                displayName: 'System Admin',
                emailVerified: true
            });
            uid = userRecord.uid;
            console.log('Created user:', uid);
        }

        // Set custom claims (admin role)
        await auth.setCustomUserClaims(uid, {
            role: 'admin',
            studioId: 'main-studio'
        });
        console.log('Set admin claims (role: admin, studioId: main-studio)');

        // Create/Update Firestore user document
        await db.collection('users').doc(uid).set({
            email,
            fullName: 'System Admin',
            role: 'admin',
            studioId: 'main-studio',
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('Firestore document updated');
        console.log('LIVE Admin User Ready!');
        console.log('Email:', email);
        // SECURITY: Never log password

    } catch (error) {
        console.error('Error:', error);
    }
}

createLiveAdmin();
