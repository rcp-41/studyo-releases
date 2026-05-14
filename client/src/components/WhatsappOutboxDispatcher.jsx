/**
 * WhatsappOutboxDispatcher — F3 Broadcast Outbox
 *
 * Null-render component. App.jsx'e global olarak eklenir.
 * whatsapp:status IPC event'ini dinler; WhatsApp bağlıyken
 * whatsappOutbox/{studioId}/messages koleksiyonundaki pending
 * mesajları sırayla gönderir.
 */
import { useEffect, useRef, useState } from 'react';
import {
    collection, query, where, onSnapshot,
    updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import useAuthStore from '../store/authStore';

const SEND_DELAY_MS = 5000;  // WhatsApp ban önlemi: mesajlar arası bekleme
const MAX_RETRY = 3;

export default function WhatsappOutboxDispatcher() {
    const user = useAuthStore((s) => s.user);
    const studioId = user?.studioId;

    const [waStatus, setWaStatus] = useState('disconnected');
    const queueRef = useRef([]);
    const processingRef = useRef(false);
    const unsubRef = useRef(null);

    // WA durumunu IPC event'den takip et
    useEffect(() => {
        if (!window?.electron?.ipcRenderer) return;
        const handler = (_event, status) => setWaStatus(status);
        window.electron.ipcRenderer.on('whatsapp:status', handler);
        return () => window.electron.ipcRenderer.removeListener('whatsapp:status', handler);
    }, []);

    // Outbox Firestore listener
    useEffect(() => {
        const isConnected = waStatus === 'connected';

        if (!studioId || !isConnected) {
            if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
            return;
        }

        const msgsCol = collection(db, 'whatsappOutbox', studioId, 'messages');
        const q = query(msgsCol, where('status', '==', 'pending'));

        unsubRef.current = onSnapshot(q, (snap) => {
            snap.docChanges().forEach(change => {
                if (change.type !== 'added') return;
                const data = { id: change.doc.id, ref: change.doc.ref, ...change.doc.data() };
                if (!queueRef.current.some(m => m.id === data.id)) {
                    queueRef.current.push(data);
                }
            });
            processQueue();
        }, (err) => {
            console.error('[WhatsappOutbox] Snapshot hatası:', err.message);
        });

        return () => {
            if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studioId, waStatus]);

    async function processQueue() {
        if (processingRef.current) return;
        processingRef.current = true;

        while (queueRef.current.length > 0) {
            const msg = queueRef.current.shift();

            if (!window?.electron?.ipc) {
                // Electron dışında çalışıyorsa atla
                break;
            }

            try {
                await window.electron.ipc.invoke('whatsapp:send', msg.phone, msg.body);
                await updateDoc(msg.ref, {
                    status: 'sent',
                    sentAt: serverTimestamp(),
                    error: null,
                });
            } catch (err) {
                const retryCount = (msg.retryCount || 0) + 1;
                const newStatus = retryCount >= MAX_RETRY ? 'failed' : 'pending';
                await updateDoc(msg.ref, {
                    status: newStatus,
                    retryCount,
                    error: err.message,
                    ...(newStatus === 'failed' ? { failedAt: serverTimestamp() } : {}),
                });
                if (newStatus === 'pending') {
                    queueRef.current.push({ ...msg, retryCount });
                }
            }

            if (queueRef.current.length > 0) {
                await new Promise(r => setTimeout(r, SEND_DELAY_MS));
            }
        }

        processingRef.current = false;
    }

    return null; // Bu component hiçbir şey render etmez
}
