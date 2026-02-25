const admin = require('firebase-admin');
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
admin.initializeApp({ projectId: 'studyo-live-2026' });

admin.auth().getUserByEmail('admin@v6xwwtw5gz4x7dxfbwh8.studyo.app')
    .then(user => {
        console.log('UID:', user.uid);
        return admin.auth().updateUser(user.uid, { password: 'studyo123' });
    })
    .then(() => { console.log('Şifre güncellendi: studyo123'); process.exit(0); })
    .catch(e => { console.error('HATA:', e.message); process.exit(1); });
