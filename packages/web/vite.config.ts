import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import yaml from '@modyfi/vite-plugin-yaml';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    yaml(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'favicon-96x96.png',
        'apple-icon-*.png',
        'android-icon-*.png',
        'ms-icon-*.png',
      ],
      manifest: {
        name: 'Vorratio',
        short_name: 'Vorratio',
        description: 'Smart home inventory management.',
        theme_color: '#22c55e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'android-icon-36x36.png',
            sizes: '36x36',
            type: 'image/png',
          },
          {
            src: 'android-icon-48x48.png',
            sizes: '48x48',
            type: 'image/png',
          },
          {
            src: 'android-icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            src: 'android-icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: 'android-icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: 'android-icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'ms-icon-310x310.png',
            sizes: '310x310',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
