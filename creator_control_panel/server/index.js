const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const app = express();
const PORT = 3001;

// SECURITY: Restrict CORS to known origins
app.use(cors({
    origin: ['http://localhost:5174', 'https://studyo-live-2026.web.app'],
    credentials: true
}));
app.use(express.json());

// Initialize Firebase Admin with Application Default Credentials
try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket: 'studyo-upload.appspot.com'
    });
    console.log('Firebase Admin SDK initialized');
} catch (error) {
    console.error('Firebase Admin Init Error:', error.message);
}

// SECURITY: Firebase Auth middleware - verify ID token and creator role
async function verifyFirebaseToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (decodedToken.role !== 'creator') {
            return res.status(403).json({ error: 'Only Creator role can trigger builds' });
        }
        req.user = decodedToken;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

app.post('/build', verifyFirebaseToken, (req, res) => {
    const { studioId, studioName } = req.body;

    if (!studioId || !studioName) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    // SECURITY: Strict input validation to prevent command injection
    if (!/^[a-zA-Z0-9_-]+$/.test(studioId)) {
        return res.status(400).json({ error: 'Invalid studioId format. Only alphanumeric, hyphens, and underscores allowed.' });
    }
    if (!/^[a-zA-Z0-9\s_\u00C0-\u024F-]+$/.test(studioName) || studioName.length > 100) {
        return res.status(400).json({ error: 'Invalid studioName format.' });
    }

    console.log(`START BUILD: ${studioName} (${studioId})`);

    const scriptPath = path.resolve(__dirname, '../scripts/build-studio.js');
    const cwdPath = path.resolve(__dirname, '../scripts');

    const child = spawn('node', [scriptPath, studioId, studioName], { cwd: cwdPath });

    let logs = '';

    child.stdout.on('data', d => {
        process.stdout.write(d);
        logs += d.toString();
    });

    child.stderr.on('data', d => {
        process.stderr.write(d);
        logs += d.toString();
    });

    child.on('close', async (code) => {
        if (code !== 0) {
            console.error('Build script failed. Logs:', logs);
            return res.status(500).json({ error: 'Build process failed. Check server logs for details.' });
        }

        console.log('Build Script Finished. Starting Upload...');

        try {
            const sanitizedName = studioName.replace(/\s+/g, '_');
            const buildDir = path.resolve(__dirname, `../builds/${sanitizedName}`);

            if (!fs.existsSync(buildDir)) {
                throw new Error('Build directory not found');
            }

            const files = fs.readdirSync(buildDir);
            const exeFile = files.find(f => f.endsWith('.exe'));

            if (!exeFile) {
                throw new Error('EXE file not found in build directory');
            }

            const localFilePath = path.join(buildDir, exeFile);
            const remoteFilePath = `builds/${studioId}/${exeFile}`;

            const bucket = getStorage().bucket();

            console.log(`Uploading to Storage: ${remoteFilePath}`);

            // SECURITY: Removed public: true - use signed URLs instead
            await bucket.upload(localFilePath, {
                destination: remoteFilePath,
                metadata: {
                    contentType: 'application/vnd.microsoft.portable-executable',
                    metadata: { studioId, version: '2.0.0' }
                }
            });

            // Generate a signed URL valid for 7 days
            const [signedUrl] = await bucket.file(remoteFilePath).getSignedUrl({
                action: 'read',
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000
            });

            console.log('Upload complete, signed URL generated');

            // Save to Firestore
            const db = getFirestore();
            await db.collection('studios').doc(studioId).update({
                downloadUrl: signedUrl,
                lastBuildDate: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true, downloadUrl: signedUrl });

        } catch (err) {
            console.error('Upload failed:', err);
            res.status(500).json({ error: 'Upload process failed. Check server logs.' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Build Server listening on http://localhost:${PORT}`);
});
