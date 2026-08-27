import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

const contentSecurityPolicyPlugin = (): Plugin => {
  let isDevelopment = false;

  return {
    name: 'fuxian-content-security-policy',
    configResolved(config) {
      isDevelopment = config.command === 'serve';
    },
    transformIndexHtml() {
      const scriptSource = isDevelopment
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self'";
      const connectSource = isDevelopment ? "connect-src 'self' ws:" : "connect-src 'self'";

      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: [
              "default-src 'self'",
              scriptSource,
              "style-src 'self' 'unsafe-inline'",
              connectSource,
              "img-src 'self' data: fuxian-resource:",
            ].join('; '),
          },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@fuxian/shared-types'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@fuxian/shared-types'] })],
    build: {
      rollupOptions: {
        output: {
          entryFileNames: '[name].cjs',
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss(), contentSecurityPolicyPlugin()],
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
      },
    },
  },
});
