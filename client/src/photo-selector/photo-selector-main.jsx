import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
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
        <Toaster
            position="top-center"
            toastOptions={{
                duration: 3000,
                style: {
                    background: '#262626',
                    color: '#f5f5f5',
                    border: '1px solid #404040',
                },
            }}
        />
    </React.StrictMode>
);
