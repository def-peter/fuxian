import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const macFileAssociationHelper = (): Plugin => ({
  name: 'fuxian-mac-file-association-helper',
  buildStart() {
    if (process.platform !== 'darwin') return;
    mkdirSync(resolve('out/native'), { recursive: true });
    execFileSync('xcrun', [
      'clang',
      '-fobjc-arc',
      '-fblocks',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-mmacosx-version-min=12.0',
      resolve('native/macos-default-app.m'),
      '-framework',
      'AppKit',
      '-framework',
      'Foundation',
      '-o',
      resolve('out/native/fuxian-default-app-helper'),
    ]);
  },
});

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
              "img-src 'self' data: fuxian-resource: https: http:",
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
    plugins: [
      macFileAssociationHelper(),
      externalizeDepsPlugin({
        exclude: [
          '@fuxian/shared-types',
          '@fuxian/markdown-renderer',
          'builder-util-runtime',
          'electron-log',
          'electron-updater',
          'parse5',
          'plantuml-encoder',
        ],
      }),
    ],
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
    worker: {
      format: 'es',
    },
  },
});
