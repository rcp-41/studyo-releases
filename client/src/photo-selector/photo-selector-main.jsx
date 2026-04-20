import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import PhotoSelectorApp from './PhotoSelectorApp';
import '../index.css';
import './photo-selector.css';

import '../lib/firebase';
import useAuthStore from '../store/authStore';

const unsubscribeAuth = useAuthStore.getState().initialize();

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (typeof unsubscribeAuth === 'function') unsubscribeAuth();
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <PhotoSelectorApp />
        <Toaster richColors position="top-center" theme="dark" />
    </React.StrictMode>
);
