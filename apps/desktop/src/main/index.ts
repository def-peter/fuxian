import {
  desktopIpcChannels,
  type LoadDocumentSessionResult,
  type LocateSourceDocumentResult,
  type OpenSourceDocumentsResult,
  type ReadSourceDocumentResult,
  type SourceDocumentData,
} from '@fuxian/shared-types';
import { app, BrowserWindow, clipboard, dialog, ipcMain, protocol, shell } from 'electron';
import { readFile, realpath } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentResourceScheme, DocumentResourceTrustStore } from './document-resource-protocol';
import {
  isPersistedDocumentSession,
  JsonFileSessionPersistence,
  type SessionPersistence,
} from './session-persistence';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const supportedSourceDocumentExtensions = new Set(['.md', '.markdown']);
const documentResourceTrustStore = new DocumentResourceTrustStore();
const knownDocumentPaths = new Set<string>();

protocol.registerSchemesAsPrivileged([
  {
    scheme: documentResourceScheme,
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  },
]);

const chooseSourceDocuments = async (): Promise<string[] | undefined> => {
  const testSourceDocuments = process.env.FUXIAN_E2E_SOURCE_DOCUMENTS;
  const testSourceDocument = process.env.FUXIAN_E2E_SOURCE_DOCUMENT;
  if (!app.isPackaged && process.env.NODE_ENV === 'test') {
    if (testSourceDocuments) {
      const paths: unknown = JSON.parse(testSourceDocuments);
      if (Array.isArray(paths) && paths.every((path) => typeof path === 'string')) {
        return paths;
      }
    }
    if (testSourceDocument) {
      return [testSourceDocument];
    }
  }

  const selection = await dialog.showOpenDialog({
    title: '打开 Markdown',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });

  return selection.canceled ? undefined : selection.filePaths;
};

const chooseReplacementDocument = async (): Promise<string | undefined> => {
  const testReplacement = process.env.FUXIAN_E2E_LOCATE_SOURCE_DOCUMENT;
  if (!app.isPackaged && process.env.NODE_ENV === 'test' && testReplacement) {
    return testReplacement;
  }

  const selection = await dialog.showOpenDialog({
    title: '定位 Markdown',
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });
  return selection.canceled ? undefined : selection.filePaths[0];
};

const readSourceDocument = async (selectedPath: string): Promise<ReadSourceDocumentResult> => {
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(selectedPath);
  } catch {
    return {
      status: 'unavailable',
      message: `无法读取“${basename(selectedPath)}”。请确认文件仍然存在并可访问。`,
    };
  }

  if (!supportedSourceDocumentExtensions.has(extname(canonicalPath).toLowerCase())) {
    return {
      status: 'unavailable',
      message: `“${basename(canonicalPath)}”不是 Markdown 文档。`,
    };
  }

  try {
    const source = await readFile(canonicalPath, 'utf8');
    knownDocumentPaths.add(canonicalPath);
    return {
      status: 'available',
      document: {
        name: basename(canonicalPath),
        path: canonicalPath,
        resourceBaseUrl: await documentResourceTrustStore.grantSourceDocument(canonicalPath),
        source,
      },
    };
  } catch {
    return {
      status: 'unavailable',
      message: `无法读取“${basename(canonicalPath)}”。请确认文件仍然存在并可访问。`,
    };
  }
};

const readSourceDocuments = async (
  selectedPaths: readonly string[],
): Promise<OpenSourceDocumentsResult> => {
  if (selectedPaths.length === 0) {
    return { status: 'cancelled' };
  }

  const documents: SourceDocumentData[] = [];
  const warnings: string[] = [];
  const canonicalPaths = new Set<string>();

  for (const selectedPath of selectedPaths.slice(0, 100)) {
    const result = await readSourceDocument(selectedPath);
    if (result.status === 'unavailable') {
      warnings.push(result.message);
      continue;
    }
    if (canonicalPaths.has(result.document.path)) {
      continue;
    }
    canonicalPaths.add(result.document.path);
    documents.push(result.document);
  }

  if (documents.length === 0) {
    return {
      status: 'error',
      message: warnings[0] ?? '没有可打开的 Markdown 文档。',
    };
  }

  return { status: 'opened', documents, warnings };
};

const openSourceDocuments = async (): Promise<OpenSourceDocumentsResult> => {
  const selectedPaths = await chooseSourceDocuments();
  return selectedPaths ? readSourceDocuments(selectedPaths) : { status: 'cancelled' };
};

const openDroppedSourceDocuments = async (
  _event: Electron.IpcMainInvokeEvent,
  selectedPaths: unknown,
): Promise<OpenSourceDocumentsResult> => {
  if (
    !Array.isArray(selectedPaths) ||
    selectedPaths.length > 100 ||
    !selectedPaths.every((path) => typeof path === 'string' && path.length > 0)
  ) {
    return { status: 'error', message: '无法识别拖入的文档。' };
  }

  return readSourceDocuments(selectedPaths);
};

const handleDocumentResourceRequest = async (request: Request): Promise<Response> => {
  const resolution = await documentResourceTrustStore.resolve(request.url);
  if (resolution.status === 'rejected') {
    return new Response(resolution.message, {
      status: resolution.httpStatus,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const contents = await readFile(resolution.path);
    return new Response(Uint8Array.from(contents), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'",
        'Content-Type': resolution.mediaType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('读取图片时发生错误。', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};

const registerDesktopHandlers = (sessionPersistence: SessionPersistence): void => {
  ipcMain.handle(desktopIpcChannels.copyText, (_event, text: unknown) => {
    if (typeof text !== 'string' || text.length > 1_000_000) {
      throw new TypeError('Clipboard text must be a string no longer than 1,000,000 characters.');
    }

    clipboard.writeText(text);
  });
  ipcMain.handle(desktopIpcChannels.openSourceDocuments, openSourceDocuments);
  ipcMain.handle(desktopIpcChannels.openDroppedSourceDocuments, openDroppedSourceDocuments);
  ipcMain.handle(
    desktopIpcChannels.loadDocumentSession,
    async (): Promise<LoadDocumentSessionResult> => {
      const session = await sessionPersistence.load();
      for (const reference of [...session.openDocuments, ...session.recentDocuments]) {
        knownDocumentPaths.add(reference.path);
      }

      const openDocuments = await Promise.all(
        session.openDocuments.map(async (reference) => {
          const result = await readSourceDocument(reference.path);
          return result.status === 'available'
            ? { status: 'available' as const, reference, document: result.document }
            : { status: 'unavailable' as const, reference, message: result.message };
        }),
      );
      return { openDocuments, session };
    },
  );
  ipcMain.handle(desktopIpcChannels.saveDocumentSession, async (_event, value: unknown) => {
    if (!isPersistedDocumentSession(value)) {
      throw new TypeError('Invalid persisted document session.');
    }
    const references = [...value.openDocuments, ...value.recentDocuments];
    if (references.some((reference) => !knownDocumentPaths.has(reference.path))) {
      throw new TypeError('The document session contains an unauthorized path.');
    }
    await sessionPersistence.save(value);
  });
  ipcMain.handle(
    desktopIpcChannels.retrySourceDocument,
    async (_event, path: unknown): Promise<ReadSourceDocumentResult> => {
      if (typeof path !== 'string' || !knownDocumentPaths.has(path)) {
        return { status: 'unavailable', message: '该文档不属于当前文档会话。' };
      }
      return readSourceDocument(path);
    },
  );
  ipcMain.handle(
    desktopIpcChannels.locateSourceDocument,
    async (_event, path: unknown): Promise<LocateSourceDocumentResult> => {
      if (typeof path !== 'string' || !knownDocumentPaths.has(path)) {
        return { status: 'unavailable', message: '该文档不属于当前文档会话。' };
      }
      const replacementPath = await chooseReplacementDocument();
      if (!replacementPath) {
        return { status: 'cancelled' };
      }
      return readSourceDocument(replacementPath);
    },
  );
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
  protocol.handle(documentResourceScheme, handleDocumentResourceRequest);
  const sessionPath =
    !app.isPackaged && process.env.NODE_ENV === 'test' && process.env.FUXIAN_E2E_SESSION_FILE
      ? process.env.FUXIAN_E2E_SESSION_FILE
      : join(app.getPath('userData'), 'document-session.json');
  registerDesktopHandlers(new JsonFileSessionPersistence(sessionPath));
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
