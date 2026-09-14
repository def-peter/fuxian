import type { ElectronApplication, Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export const captureElectronWindow = async (
  app: ElectronApplication,
  page: Page,
  path: string,
): Promise<void> => {
  // CDP screenshots can stall on hidden Windows windows; capture without showing it.
  const window = await app.browserWindow(page);
  try {
    const png = await window.evaluate(async (browserWindow) => {
      const wasVisible = browserWindow.isVisible();
      const image = await browserWindow.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      });
      if (image.isEmpty()) throw new Error('Window screenshot is empty.');
      if (!wasVisible && browserWindow.isVisible())
        throw new Error('Screenshot exposed a hidden window.');
      return image.toPNG().toString('base64');
    });
    await writeFile(path, Buffer.from(png, 'base64'));
  } finally {
    await window.dispose();
  }
};
