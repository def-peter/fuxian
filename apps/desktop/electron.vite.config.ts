import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
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
              "img-src 'self' data:",
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
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), contentSecurityPolicyPlugin()],
  },
});
