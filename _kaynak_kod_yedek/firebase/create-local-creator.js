
const admin = require('firebase-admin');

// Connect to Emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

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

        let uid;
        try {
            const user = await auth.getUserByEmail(email);
            uid = user.uid;
            console.log('User already exists, updating password...');
            await auth.updateUser(uid, { password });
        } catch (e) {
            console.log('User not found, creating...');
            const user = await auth.createUser({
                email,
                password,
                displayName: 'Local Creator'
            });
            uid = user.uid;
        }

        console.log('Setting custom claims...');
        await auth.setCustomUserClaims(uid, {
            role: 'creator',
            super_admin: true
        });

        console.log('Creating user document in Firestore...');
        await db.collection('users').doc(uid).set({
            email,
            fullName: 'Local Creator',
            role: 'creator',
            isActive: true,
            createdAt: new Date().toISOString()
        }, { merge: true });

        console.log('Success! user created.');
        console.log('Email:', email);
        console.log('Password:', password);

    } catch (error) {
        console.error('Error:', error);
    }
}

createLocalCreator();
