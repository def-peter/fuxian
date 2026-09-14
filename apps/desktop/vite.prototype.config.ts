// Throwaway #57 prototype server: renderer only, never launches Electron.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve('src/renderer'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve('src/renderer/src') } },
  server: { host: '127.0.0.1', port: 4178, strictPort: true },
});
