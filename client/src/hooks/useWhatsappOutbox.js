/**
 * useWhatsappOutbox — F3 Broadcast Outbox Dispatcher
 *
 * Firestore whatsappOutbox/{studioId}/messages koleksiyonunu dinler.
 * status:'pending' mesajlar gelince Electron IPC'ye whatsapp:send gönderir.
 * Başarıda status:'sent', hata durumunda status:'failed' yazar.
 *
 * Rate limit: mesajlar arası minimum 5 saniye bekleme (WhatsApp ban önlemi).
 * Sadece WhatsApp bağlıyken çalışır.
 */

import { useEffect, useRef } from 'react';
import {
    collection, query, where, onSnapshot,
    updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import useAuthStore from '../store/authStore';

const SEND_DELAY_MS = 5000; // mesajlar arası bekleme (ms)
const MAX_RETRY = 3;

export function useWhatsappOutbox(waStatus) {
    const user = useAuthStore(s => s.user);
    const studioId = user?.studioId;

    // Sıralı gönderim için kuyruk
    const queueRef = useRef([]);
    const processingRef = useRef(false);
    const unsubRef = useRef(null);

    // WhatsApp bağlı değilse dinlemeyi durdur
    const isConnected = waStatus === 'connected';

    useEffect(() => {
        if (!studioId || !isConnected) {
            if (unsubRef.current) {
                unsubRef.current();
                unsubRef.current = null;
            }
            return;
        }

        const msgsRef = collection(db, 'whatsappOutbox', studioId, 'messages');
        const q = query(msgsRef, where('status', '==', 'pending'));

        unsubRef.current = onSnapshot(q, (snap) => {
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const msgData = { id: change.doc.id, ref: change.doc.ref, ...change.doc.data() };
                    // Aynı mesajı iki kez ekleme
                    const alreadyQueued = queueRef.current.some(m => m.id === msgData.id);
                    if (!alreadyQueued) {
                        queueRef.current.push(msgData);
                    }
                }
            });
            processQueue();
        }, (err) => {
            console.error('[WhatsAppOutbox] Snapshot error:', err.message);
        });

        return () => {
            if (unsubRef.current) {
                unsubRef.current();
                unsubRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studioId, isConnected]);

    async function processQueue() {
        if (processingRef.current) return;
        processingRef.current = true;

        while (queueRef.current.length > 0) {
            const msg = queueRef.current.shift();

            // Electron IPC kontrolü
            if (!window.electron?.ipc) {
                console.warn('[WhatsAppOutbox] Electron IPC mevcut degil, mesaj atlanıyor:', msg.id);
                continue;
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

                // Retry değilse kuyruğa geri ekle
                if (newStatus === 'pending') {
                    queueRef.current.push({ ...msg, retryCount });
                }
            }

            // Rate limit: bir sonraki mesaj için bekle
            if (queueRef.current.length > 0) {
                await new Promise(r => setTimeout(r, SEND_DELAY_MS));
            }
        }

        processingRef.current = false;
    }
}
