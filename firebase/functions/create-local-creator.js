
const admin = require('firebase-admin');

// Connect to Emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Initialize with project ID
admin.initializeApp({
    projectId: 'studyo-live-2026'
});

const auth = admin.auth();
const db = admin.firestore();

async function createLocalCreator() {
    const email = 'creator@studyo.app';
    const password = '123456';

    try {
        console.log('Creating local creator account...');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

        let uid;
        try {
            const user = await auth.getUserByEmail(email);
            console.log('User already exists, updating password...');
            uid = user.uid;
            await auth.updateUser(uid, {
                password: password
            });
            console.log('Password updated.');
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                console.log('User not found, creating new user...');
                const user = await auth.createUser({
                    email: email,
                    password: password,
                    displayName: 'Local Creator',
                    emailVerified: true
                });
                uid = user.uid;
                console.log(`User created with UID: ${uid}`);
            } else {
                console.error('Error fetching user:', e);
                throw e;
            }
        }

        console.log('Setting custom claims (role: creator, super_admin: true)...');
        await auth.setCustomUserClaims(uid, {
            role: 'creator',
            super_admin: true
        });

        console.log('Creating/Updating user document in Firestore...');
        await db.collection('users').doc(uid).set({
            email: email,
            fullName: 'Local Creator',
            role: 'creator',
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('--------------------------------------------------');
        console.log('SUCCESS! Local Creator account is ready.');
        console.log('You can now login to the Creator Control Panel.');
        console.log('--------------------------------------------------');

    } catch (error) {
        console.error('FATAL ERROR:', error);
    }
}

createLocalCreator();
