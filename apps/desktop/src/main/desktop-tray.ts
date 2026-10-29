import { Menu, nativeImage, Tray, type NativeImage } from 'electron';
import { join } from 'node:path';
import type { UiLocale } from '@fuxian/shared-types';
import { createTranslator, productName } from '../localization';

interface TrayTarget {
  setToolTip(value: string): void;
  setContextMenu(menu: Menu): void;
  on(event: 'click', listener: () => void): void;
  isDestroyed(): boolean;
  destroy(): void;
}

export type DesktopTrayFactory = (icon: string | NativeImage) => TrayTarget;

interface DesktopTrayOptions {
  platform: NodeJS.Platform;
  resourcesDirectory: string;
  locale: UiLocale;
  createTray?: DesktopTrayFactory;
  showMainWindow(): void;
  newDocument(): void;
  openDocuments(): void;
  openSettings(): void;
  quit(): void;
}

export interface DesktopTray {
  updateLocale(locale: UiLocale): void;
  destroy(): void;
}

export const createDesktopTray = (options: DesktopTrayOptions): DesktopTray | undefined => {
  if (options.platform !== 'darwin' && options.platform !== 'win32') return;

  const iconPath = join(
    options.resourcesDirectory,
    options.platform === 'darwin' ? 'trayTemplate.png' : 'tray.ico',
  );
  const icon = options.platform === 'darwin' ? nativeImage.createFromPath(iconPath) : iconPath;
  if (typeof icon !== 'string') {
    if (icon.isEmpty()) throw new Error('The menu bar icon is missing or invalid.');
    icon.setTemplateImage(true);
  }
  const tray = options.createTray ? options.createTray(icon) : new Tray(icon);
  if (options.platform === 'win32') tray.on('click', options.showMainWindow);

  const updateLocale = (locale: UiLocale): void => {
    if (tray.isDestroyed()) return;
    const t = createTranslator(locale);
    tray.setToolTip(productName(locale));
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { id: 'tray-show', label: t('显示主窗口'), click: options.showMainWindow },
        { type: 'separator' },
        { id: 'tray-new', label: t('新建 Markdown'), click: options.newDocument },
        { id: 'tray-open', label: t('打开 Markdown…'), click: options.openDocuments },
        { type: 'separator' },
        { id: 'tray-settings', label: t('设置…'), click: options.openSettings },
        { type: 'separator' },
        { id: 'tray-quit', label: t('退出浮现'), click: options.quit },
      ]),
    );
  };
  updateLocale(options.locale);

  return {
    updateLocale,
    destroy: () => {
      if (!tray.isDestroyed()) tray.destroy();
    },
  };
};
