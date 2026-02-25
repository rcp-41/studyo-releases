/**
 * One-time migration: Copy existing users from top-level 'users' collection
 * to studios/{studioId}/users/{uid} subcollections.
 * 
 * Run: node migrate-users-to-studios.js
 */

const admin = require('firebase-admin');

// Initialize with the project service account
const app = admin.initializeApp({
    projectId: 'studyo-live-2026'
});

const db = admin.firestore();

async function migrateUsers() {
    console.log('🔍 Reading all users from top-level collection...');

    const usersSnap = await db.collection('users').get();
    console.log(`Found ${usersSnap.size} users in top-level collection`);

    if (usersSnap.empty) {
        console.log('No users to migrate.');
        return;
    }

    let migrated = 0;
    let skipped = 0;
    let creatorUsers = 0;

    for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const uid = userDoc.id;
        const studioId = userData.studioId;

        // Skip creator users (no studioId) - they stay in top-level
        if (!studioId) {
            console.log(`  ⏭️  ${uid} (${userData.email || 'no-email'}) - no studioId (creator?), skipping`);
            creatorUsers++;
            continue;
        }

        // Check if already exists in studio subcollection
        const existingDoc = await db.collection('studios').doc(studioId).collection('users').doc(uid).get();
        if (existingDoc.exists) {
            console.log(`  ⏭️  ${uid} (${userData.fullName || userData.email}) - already in studios/${studioId}/users, skipping`);
            skipped++;
            continue;
        }

        // Copy to studio subcollection
        await db.collection('studios').doc(studioId).collection('users').doc(uid).set(userData);
        console.log(`  ✅ ${uid} (${userData.fullName || userData.email}) → studios/${studioId}/users/${uid}`);
        migrated++;
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped (already exists): ${skipped}`);
    console.log(`  Creator users (kept in top-level): ${creatorUsers}`);
    console.log(`  Total: ${usersSnap.size}`);
    console.log('\n✅ Done!');

    process.exit(0);
}

migrateUsers().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
