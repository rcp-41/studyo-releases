import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174, // Different port from main client (5173)
        host: 'localhost'
    },
    build: {
        outDir: '../firebase/hosting/panel',
        emptyOutDir: true
    }
});
