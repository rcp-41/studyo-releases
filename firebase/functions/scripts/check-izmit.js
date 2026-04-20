const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function check() {
    console.log("Checking DB...");
    const orgsSnap = await db.collection('organizations').get();
    for (const org of orgsSnap.docs) {
        const studiosSnap = await org.ref.collection('studios').get();
        for (const studio of studiosSnap.docs) {
            const data = studio.data();
            if (data.name && data.name.toLowerCase().includes('zmit')) {
                console.log(`\nFound: ${org.id} -> ${studio.id} (${data.name})`);
                const archives = await studio.ref.collection('archives').count().get();
                const customers = await studio.ref.collection('customers').count().get();
                console.log(`Archives Count: ${archives.data().count}`);
                console.log(`Customers Count: ${customers.data().count}`);
                
                const packages = await studio.ref.collection('packages').count().get();
                console.log(`Packages Count (Should be > 0 if not deleted): ${packages.data().count}`);
                
                // Get audit logs
                const logs = await studio.ref.collection('auditLogs').orderBy('timestamp', 'desc').limit(2).get();
                logs.forEach(l => console.log('Log:', l.data()));
            }
        }
    }
    console.log("Done.");
}

check().catch(console.error);
