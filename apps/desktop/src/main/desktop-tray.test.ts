import type { MenuItemConstructorOptions } from 'electron';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDesktopTray } from './desktop-tray';

const state = vi.hoisted(() => ({
  destroyed: false,
  emptyImage: false,
  template: [] as MenuItemConstructorOptions[],
  handlers: new Map<string, () => void>(),
  setTemplateImage: vi.fn(),
  setToolTip: vi.fn(),
  setContextMenu: vi.fn(),
  destroy: vi.fn(),
  createTray: vi.fn(),
  createFromPath: vi.fn(),
}));

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => {
      state.template = template;
      return template;
    },
  },
  nativeImage: {
    createFromPath: (path: string) => {
      state.createFromPath(path);
      return { isEmpty: () => state.emptyImage, setTemplateImage: state.setTemplateImage };
    },
  },
  Tray: class {
    constructor(icon: unknown) {
      state.createTray(icon);
    }
    isDestroyed = () => state.destroyed;
    setToolTip = state.setToolTip;
    setContextMenu = state.setContextMenu;
    on = (event: string, listener: () => void) => {
      state.handlers.set(event, listener);
    };
    destroy = () => {
      state.destroyed = true;
      state.destroy();
    };
  },
}));

const options = (platform: NodeJS.Platform = 'darwin') => ({
  platform,
  resourcesDirectory: '/app/resources',
  locale: 'zh-CN' as const,
  showMainWindow: vi.fn(),
  newDocument: vi.fn(),
  openDocuments: vi.fn(),
  openSettings: vi.fn(),
  quit: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  state.destroyed = false;
  state.emptyImage = false;
  state.template = [];
  state.handlers.clear();
});

describe('desktop tray', () => {
  it('uses a macOS template image and a localized native menu without a click override', () => {
    createDesktopTray(options());
    expect(state.createFromPath).toHaveBeenCalledWith(join('/app/resources', 'trayTemplate.png'));
    expect(state.setTemplateImage).toHaveBeenCalledWith(true);
    expect(state.setToolTip).toHaveBeenCalledWith('浮现');
    expect(state.template.filter((item) => item.id).map((item) => item.label)).toEqual([
      '显示主窗口',
      '新建 Markdown',
      '打开 Markdown…',
      '设置…',
      '退出浮现',
    ]);
    expect(state.handlers.size).toBe(0);
  });

  it('uses the multi-resolution Windows icon and shows the main window on click', () => {
    const actions = options('win32');
    createDesktopTray(actions);
    expect(state.createTray).toHaveBeenCalledWith(join('/app/resources', 'tray.ico'));
    expect(state.createFromPath).not.toHaveBeenCalled();
    state.handlers.get('click')?.();
    expect(actions.showMainWindow).toHaveBeenCalledOnce();
  });

  it('routes every menu action through the supplied application commands', () => {
    const actions = options();
    createDesktopTray(actions);
    for (const [id, action] of [
      ['tray-show', actions.showMainWindow],
      ['tray-new', actions.newDocument],
      ['tray-open', actions.openDocuments],
      ['tray-settings', actions.openSettings],
      ['tray-quit', actions.quit],
    ] as const) {
      const item = state.template.find((item) => item.id === id);
      expect(item?.click).toBe(action);
      (item?.click as () => void)();
      expect(action).toHaveBeenCalledOnce();
    }
  });

  it('injects only the native icon surface while still building the real menu', () => {
    const target = {
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
      isDestroyed: () => false,
      destroy: vi.fn(),
    };
    const createTray = vi.fn(() => target);
    const tray = createDesktopTray({ ...options('win32'), createTray });
    expect(createTray).toHaveBeenCalledWith(join('/app/resources', 'tray.ico'));
    expect(state.createTray).not.toHaveBeenCalled();
    expect(target.setContextMenu).toHaveBeenCalledOnce();
    tray?.destroy();
    expect(target.destroy).toHaveBeenCalledOnce();
  });

  it('updates tooltip and menu in place when the interface language changes', () => {
    const tray = createDesktopTray(options());
    tray?.updateLocale('en-US');
    expect(state.createTray).toHaveBeenCalledOnce();
    expect(state.setToolTip).toHaveBeenLastCalledWith('Fuxian');
    expect(state.template.filter((item) => item.id).map((item) => item.label)).toEqual([
      'Show Main Window',
      'New Markdown',
      'Open Markdown…',
      'Settings…',
      'Quit Fuxian',
    ]);
  });

  it('destroys once and ignores late locale updates after shutdown', () => {
    const tray = createDesktopTray(options());
    tray?.destroy();
    tray?.destroy();
    tray?.updateLocale('en-US');
    expect(state.destroy).toHaveBeenCalledOnce();
    expect(state.setContextMenu).toHaveBeenCalledOnce();
  });

  it('does not create a tray on unsupported platforms or accept an empty macOS image', () => {
    expect(createDesktopTray(options('linux'))).toBeUndefined();
    expect(state.createTray).not.toHaveBeenCalled();
    state.emptyImage = true;
    expect(() => createDesktopTray(options())).toThrow('icon is missing or invalid');
    expect(state.createTray).not.toHaveBeenCalled();
  });
});
