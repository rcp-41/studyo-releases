import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
    plugins: [react()],
    base: './',
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        outDir: '../firebase/hosting/dist',
        assetsDir: 'assets',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                'photo-selector': path.resolve(__dirname, 'photo-selector.html'),
            },
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/firebase/')) return 'firebase';
                    if (id.includes('node_modules/exceljs')) return 'excel-vendor';
                    if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'chart-vendor';
                    if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) return 'react-vendor';
                    if (id.includes('node_modules/@radix-ui/') || id.includes('node_modules/lucide-react')) return 'ui-vendor';
                    if (id.includes('node_modules/@dnd-kit/')) return 'dnd-vendor';
                    if (id.includes('node_modules/@vladmandic/face-api')) return 'face-vendor';
                },
            },
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.js'],
        css: false,
        exclude: ['node_modules', 'e2e', 'dist', '../firebase/hosting/dist'],
    },
});
