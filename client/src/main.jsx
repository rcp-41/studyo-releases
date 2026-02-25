import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

// Initialize Firebase (must be imported before any Firebase-dependent code)
import '@/lib/firebase';
import useAuthStore from '@/store/authStore';
import { queryClient } from '@/lib/queryClient';
import { logError } from './services/auditLog';

// Initialize Firebase Auth listener (capture unsubscribe to prevent memory leak)
const unsubscribeAuth = useAuthStore.getState().initialize();

// Cleanup on HMR (development)
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (typeof unsubscribeAuth === 'function') unsubscribeAuth();
    });
}

// Global error handlers
window.onerror = (message, source, lineno, colno, error) => {
    logError({ type: 'unhandled_error', message: String(message), source, lineno, colno, stack: error?.stack });
};

window.onunhandledrejection = (event) => {
    logError({ type: 'unhandled_promise', message: event.reason?.message || String(event.reason), stack: event.reason?.stack });
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: 'hsl(222.2 84% 4.9%)',
                        color: 'hsl(210 40% 98%)',
                        border: '1px solid hsl(217.2 32.6% 17.5%)',
                    },
                }}
            />
        </QueryClientProvider>
    </React.StrictMode>
);
