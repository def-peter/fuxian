import {
  desktopIpcChannels,
  normalizePlantUmlServerUrl,
  normalizeReaderPreferences,
  type ExternalRevisionEvent,
  type LoadDocumentSessionResult,
  type LocateSourceDocumentResult,
  type OpenSourceDocumentsResult,
  type OpenDocumentWatchesRequest,
  type PlantUmlRenderRequest,
  type PlantUmlRenderResult,
  type PlantUmlServerValidationResult,
  type ReadSourceDocumentResult,
  type ReaderPreferences,
  type SourceDocumentData,
} from '@fuxian/shared-types';
import { app, BrowserWindow, clipboard, dialog, ipcMain, protocol, shell } from 'electron';
import { readFile, realpath } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentResourceScheme, DocumentResourceTrustStore } from './document-resource-protocol';
import {
  JsonFilePreferencesPersistence,
  type PreferencesPersistence,
} from './preferences-persistence';
import { fetchPlantUmlSvg, validatePlantUmlServer } from './plantuml-server';
import {
  isPersistedDocumentSession,
  JsonFileSessionPersistence,
  type SessionPersistence,
} from './session-persistence';
import { OpenDocumentWatchCoordinator } from './open-document-watch-coordinator';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const appIconPath = join(currentDirectory, '../../resources/icon.png');
const supportedSourceDocumentExtensions = new Set(['.md', '.markdown']);
const documentResourceTrustStore = new DocumentResourceTrustStore();
const knownDocumentPaths = new Set<string>();
let settingsWindow: BrowserWindow | undefined;
const activePlantUmlRequests = new Map<string, AbortController>();
interface RendererDocumentWatches {
  coordinator: OpenDocumentWatchCoordinator;
  revisions: Map<string, number>;
}

const rendererDocumentWatches = new Map<number, RendererDocumentWatches>();
const documentWatchConfigurationGenerations = new Map<number, number>();
const documentWatchCleanupRegistered = new Set<number>();

const plantUmlRequestKey = (webContentsId: number, requestId: string): string =>
  `${webContentsId}:${requestId}`;

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'PlantUML Server 验证失败。';

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

const registerDesktopHandlers = (
  sessionPersistence: SessionPersistence,
  preferencesPersistence: PreferencesPersistence,
): void => {
  let preferencesSaveQueue = Promise.resolve();
  ipcMain.handle(
    desktopIpcChannels.configureOpenDocumentWatches,
    async (event, value: unknown): Promise<void> => {
      const request = value as Partial<OpenDocumentWatchesRequest> | undefined;
      const senderId = event.sender.id;
      if (
        !request ||
        !Array.isArray(request.documents) ||
        request.documents.length > 20 ||
        (request.activePath !== undefined && typeof request.activePath !== 'string')
      ) {
        throw new TypeError('Open document watch request is invalid.');
      }
      const requestedPaths = new Set<string>();
      for (const document of request.documents) {
        if (
          !document ||
          typeof document.path !== 'string' ||
          !knownDocumentPaths.has(document.path) ||
          requestedPaths.has(document.path) ||
          !Array.isArray(document.resourceUrls) ||
          document.resourceUrls.length > 100 ||
          !document.resourceUrls.every((url) => typeof url === 'string')
        ) {
          throw new TypeError('Open document watch target is invalid.');
        }
        requestedPaths.add(document.path);
      }
      if (request.activePath && !requestedPaths.has(request.activePath)) {
        throw new TypeError('The active document must be included in the watch set.');
      }

      const configurationGeneration =
        (documentWatchConfigurationGenerations.get(senderId) ?? 0) + 1;
      documentWatchConfigurationGenerations.set(senderId, configurationGeneration);
      const targets = await Promise.all(
        request.documents.map(async (document) => {
          let canonicalPath: string;
          try {
            canonicalPath = await realpath(document.path);
          } catch {
            throw new TypeError('An open source document is unavailable.');
          }
          if (canonicalPath !== document.path) {
            throw new TypeError('Open source document paths must be canonical.');
          }
          const resourcePaths = (
            await Promise.all(
              document.resourceUrls.map((url) =>
                documentResourceTrustStore.resolveWatchPath(url, canonicalPath),
              ),
            )
          ).filter((path): path is string => Boolean(path));
          return { path: canonicalPath, watchedPaths: [canonicalPath, ...resourcePaths] };
        }),
      );
      if (documentWatchConfigurationGenerations.get(senderId) !== configurationGeneration) return;

      let state = rendererDocumentWatches.get(senderId);
      if (!state) {
        const revisions = new Map<string, number>();
        state = {
          coordinator: new OpenDocumentWatchCoordinator((path) => {
            const currentState = rendererDocumentWatches.get(senderId);
            if (!currentState || event.sender.isDestroyed()) return;
            const revision = (currentState.revisions.get(path) ?? 0) + 1;
            currentState.revisions.set(path, revision);
            void readSourceDocument(path).then((result) => {
              if (
                event.sender.isDestroyed() ||
                rendererDocumentWatches.get(senderId) !== currentState ||
                currentState.revisions.get(path) !== revision
              ) {
                return;
              }
              const externalRevision: ExternalRevisionEvent = { path, result, revision };
              event.sender.send(desktopIpcChannels.externalRevisionChanged, externalRevision);
            });
          }),
          revisions,
        };
        rendererDocumentWatches.set(senderId, state);
      }
      state.coordinator.configure(targets, request.activePath);
      for (const path of state.revisions.keys()) {
        if (!requestedPaths.has(path)) state.revisions.delete(path);
      }

      if (!documentWatchCleanupRegistered.has(senderId)) {
        documentWatchCleanupRegistered.add(senderId);
        event.sender.once('destroyed', () => {
          rendererDocumentWatches.get(senderId)?.coordinator.close();
          rendererDocumentWatches.delete(senderId);
          documentWatchConfigurationGenerations.delete(senderId);
          documentWatchCleanupRegistered.delete(senderId);
        });
      }
    },
  );
  ipcMain.on(desktopIpcChannels.cancelPlantUmlRender, (event, requestId: unknown) => {
    if (typeof requestId !== 'string') return;
    activePlantUmlRequests.get(plantUmlRequestKey(event.sender.id, requestId))?.abort();
  });
  ipcMain.handle(desktopIpcChannels.copyText, (_event, text: unknown) => {
    if (typeof text !== 'string' || text.length > 1_000_000) {
      throw new TypeError('Clipboard text must be a string no longer than 1,000,000 characters.');
    }

    clipboard.writeText(text);
  });
  ipcMain.handle(desktopIpcChannels.openSourceDocuments, openSourceDocuments);
  ipcMain.handle(desktopIpcChannels.openDroppedSourceDocuments, openDroppedSourceDocuments);
  ipcMain.handle(
    desktopIpcChannels.renderPlantUml,
    async (event, value: unknown): Promise<PlantUmlRenderResult> => {
      const request = value as Partial<PlantUmlRenderRequest> | undefined;
      const serverUrl = normalizePlantUmlServerUrl(request?.serverUrl);
      if (
        !request ||
        typeof request.requestId !== 'string' ||
        request.requestId.length > 128 ||
        !serverUrl ||
        typeof request.source !== 'string'
      ) {
        throw new TypeError('PlantUML 渲染请求无效。');
      }

      const key = plantUmlRequestKey(event.sender.id, request.requestId);
      activePlantUmlRequests.get(key)?.abort();
      const controller = new AbortController();
      const abortOnDestroyed = (): void => controller.abort();
      activePlantUmlRequests.set(key, controller);
      event.sender.once('destroyed', abortOnDestroyed);
      try {
        return {
          svg: await fetchPlantUmlSvg(serverUrl, request.source, controller.signal),
        };
      } finally {
        event.sender.removeListener('destroyed', abortOnDestroyed);
        if (activePlantUmlRequests.get(key) === controller) activePlantUmlRequests.delete(key);
      }
    },
  );
  ipcMain.handle(
    desktopIpcChannels.validatePlantUmlServer,
    async (_event, value: unknown): Promise<PlantUmlServerValidationResult> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        return {
          serverUrl: await validatePlantUmlServer(
            typeof value === 'string' ? value : '',
            controller.signal,
          ),
          status: 'valid',
        };
      } catch (error) {
        return {
          message:
            controller.signal.aborted && !(error instanceof TypeError)
              ? '连接 PlantUML Server 超时。'
              : errorMessage(error),
          status: 'invalid',
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  );
  ipcMain.handle(desktopIpcChannels.loadReaderPreferences, () => preferencesPersistence.load());
  ipcMain.handle(desktopIpcChannels.openSettings, () => {
    createSettingsWindow();
  });
  ipcMain.handle(
    desktopIpcChannels.saveReaderPreferences,
    (_event, value: unknown): Promise<ReaderPreferences> => {
      const normalized = normalizeReaderPreferences(value);
      const save = preferencesSaveQueue.then(async () => {
        const preferences = await preferencesPersistence.save(normalized);
        for (const browserWindow of BrowserWindow.getAllWindows()) {
          browserWindow.webContents.send(desktopIpcChannels.readerPreferencesChanged, preferences);
        }
        return preferences;
      });
      preferencesSaveQueue = save.then(
        () => undefined,
        () => undefined,
      );
      return save;
    },
  );
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
    icon: appIconPath,
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

const createSettingsWindow = (): BrowserWindow => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    settingsWindow.focus();
    return settingsWindow;
  }

  const window = new BrowserWindow({
    width: 1000,
    height: 720,
    icon: appIconPath,
    minWidth: 820,
    minHeight: 620,
    show: false,
    title: '浮现设置',
    webPreferences: {
      preload: join(currentDirectory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWindow = window;
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    settingsWindow = undefined;
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    url.searchParams.set('view', 'settings');
    void window.loadURL(url.toString());
  } else {
    void window.loadFile(join(currentDirectory, '../renderer/index.html'), {
      query: { view: 'settings' },
    });
  }
  return window;
};

app.whenReady().then(() => {
  app.setName('Fuxian');
  if (process.platform === 'darwin') {
    app.dock?.setIcon(appIconPath);
  }
  protocol.handle(documentResourceScheme, handleDocumentResourceRequest);
  const sessionPath =
    !app.isPackaged && process.env.NODE_ENV === 'test' && process.env.FUXIAN_E2E_SESSION_FILE
      ? process.env.FUXIAN_E2E_SESSION_FILE
      : join(app.getPath('userData'), 'document-session.json');
  const preferencesPath =
    !app.isPackaged && process.env.NODE_ENV === 'test' && process.env.FUXIAN_E2E_PREFERENCES_FILE
      ? process.env.FUXIAN_E2E_PREFERENCES_FILE
      : join(app.getPath('userData'), 'reader-preferences.json');
  registerDesktopHandlers(
    new JsonFileSessionPersistence(sessionPath),
    new JsonFilePreferencesPersistence(preferencesPath),
  );
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
