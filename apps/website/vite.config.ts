import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.WEBSITE_BASE ?? (process.env.GITHUB_ACTIONS ? '/fuxian/' : '/'),
  plugins: [react()],
});
