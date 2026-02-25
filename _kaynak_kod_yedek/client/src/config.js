/**
 * Application Config
 * 
 * NOT: STUDIO_ID artık auth token'dan alınıyor (DatabaseHandler.fromRequest).
 * Bu dosyadaki değer sadece geliştirme ortamı referansı içindir.
 * Production'da kullanılmaz.
 */

// Bu değer production'da kullanılmaz - auth token claim'inden alınır
export const STUDIO_ID = import.meta.env.VITE_STUDIO_ID || null;
export const APP_VERSION = '2.0.0';
