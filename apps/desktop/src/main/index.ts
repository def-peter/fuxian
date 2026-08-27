import { desktopIpcChannels, type OpenSourceDocumentResult } from '@fuxian/shared-types';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const supportedSourceDocumentExtensions = new Set(['.md', '.markdown']);

const chooseSourceDocument = async (): Promise<string | undefined> => {
  const testSourceDocument = process.env.FUXIAN_E2E_SOURCE_DOCUMENT;
  if (!app.isPackaged && process.env.NODE_ENV === 'test' && testSourceDocument) {
    return testSourceDocument;
  }

  const selection = await dialog.showOpenDialog({
    title: '打开 Markdown',
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });

  return selection.canceled ? undefined : selection.filePaths[0];
};

const openSourceDocument = async (): Promise<OpenSourceDocumentResult> => {
  const selectedPath = await chooseSourceDocument();
  if (!selectedPath) {
    return { status: 'cancelled' };
  }

  if (!supportedSourceDocumentExtensions.has(extname(selectedPath).toLowerCase())) {
    return {
      status: 'error',
      message: '请选择 .md 或 .markdown 文件。',
    };
  }

  try {
    return {
      status: 'opened',
      document: {
        name: basename(selectedPath),
        path: selectedPath,
        source: await readFile(selectedPath, 'utf8'),
      },
    };
  } catch {
    return {
      status: 'error',
      message: `无法读取“${basename(selectedPath)}”。请确认文件仍然存在并可访问。`,
    };
  }
};

const registerDesktopHandlers = (): void => {
  ipcMain.handle(desktopIpcChannels.openSourceDocument, openSourceDocument);
};

const openExternalUrl = async (url: string): Promise<void> => {
  const protocol = new URL(url).protocol;

  if (protocol === 'https:' || protocol === 'http:') {
    await shell.openExternal(url);
  }
};

const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    show: false,
    webPreferences: {
      preload: join(currentDirectory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
      void openExternalUrl(url);
    }
  });

  window.webContents.on('will-frame-navigate', (event) => {
    if (event.isMainFrame && event.url === window.webContents.getURL()) {
      return;
    }

    event.preventDefault();
    void openExternalUrl(event.url);
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(currentDirectory, '../renderer/index.html'));
  }

  return window;
};

app.whenReady().then(() => {
  app.setName('Fuxian');
  registerDesktopHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
