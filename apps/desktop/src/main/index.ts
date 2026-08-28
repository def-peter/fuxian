import {
  desktopIpcChannels,
  normalizePlantUmlServerUrl,
  normalizeReaderPreferences,
  type ExternalRevisionEvent,
  type LoadDocumentSessionResult,
  type LocateSourceDocumentResult,
  type OpenSourceDocumentsResult,
  type OpenDocumentWatchesRequest,
  type PdfExportPayload,
  type PdfExportProgress,
  type PdfExportReadySignal,
  type PdfExportRenderProgress,
  type PlantUmlRenderRequest,
  type PlantUmlRenderResult,
  type PlantUmlServerValidationResult,
  type ReadSourceDocumentResult,
  type ReaderPreferences,
  type SourceDocumentData,
  type StartPdfExportRequest,
  type StartPdfExportResult,
} from '@fuxian/shared-types';
import { app, BrowserWindow, clipboard, dialog, ipcMain, protocol, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
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
import { extractSourceDocumentPaths } from './system-open';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const appIconPath = join(currentDirectory, '../../resources/icon.png');
const supportedSourceDocumentExtensions = new Set(['.md', '.markdown']);
const documentResourceTrustStore = new DocumentResourceTrustStore();
const knownDocumentPaths = new Set<string>();
let settingsWindow: BrowserWindow | undefined;
let mainWindow: BrowserWindow | undefined;
let sourceDocumentOpenReceiver: Electron.WebContents | undefined;
const pendingSourceDocumentOpenRequests: string[][] = [];
let sourceDocumentOpenDelivery = Promise.resolve();
const activePlantUmlRequests = new Map<string, AbortController>();
interface RendererDocumentWatches {
  coordinator: OpenDocumentWatchCoordinator;
  revisions: Map<string, number>;
}

const rendererDocumentWatches = new Map<number, RendererDocumentWatches>();
const documentWatchConfigurationGenerations = new Map<number, number>();
const documentWatchCleanupRegistered = new Set<number>();

interface PdfExportJob {
  cancelled: boolean;
  exportWindow: BrowserWindow;
  id: string;
  originWindow: BrowserWindow;
  outputPath: string;
  payload: PdfExportPayload;
  printing: boolean;
  temporaryPath: string;
  timeout?: ReturnType<typeof setTimeout>;
}

const pdfExportJobs = new Map<string, PdfExportJob>();

const plantUmlRequestKey = (webContentsId: number, requestId: string): string =>
  `${webContentsId}:${requestId}`;

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'PlantUML Server 验证失败。';

const sendPdfExportProgress = (job: PdfExportJob, progress: PdfExportProgress): void => {
  if (!job.originWindow.isDestroyed()) {
    job.originWindow.webContents.send(desktopIpcChannels.pdfExportProgress, progress);
  }
};

const closePdfExportJob = (job: PdfExportJob): void => {
  pdfExportJobs.delete(job.id);
  if (job.timeout) clearTimeout(job.timeout);
  if (!job.exportWindow.isDestroyed()) job.exportWindow.destroy();
};

const failPdfExportJob = (job: PdfExportJob, message: string): void => {
  if (pdfExportJobs.get(job.id) !== job || job.cancelled) return;
  sendPdfExportProgress(job, { exportId: job.id, message, status: 'failed' });
  closePdfExportJob(job);
};

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

const deliverPendingSourceDocumentOpenRequests = (): void => {
  const receiver = sourceDocumentOpenReceiver;
  if (!receiver || receiver.isDestroyed() || pendingSourceDocumentOpenRequests.length === 0) return;

  const requests = pendingSourceDocumentOpenRequests.splice(0);
  sourceDocumentOpenDelivery = sourceDocumentOpenDelivery
    .then(async () => {
      for (let index = 0; index < requests.length; index += 1) {
        if (receiver.isDestroyed() || sourceDocumentOpenReceiver !== receiver) {
          pendingSourceDocumentOpenRequests.unshift(...requests.slice(index));
          queueMicrotask(deliverPendingSourceDocumentOpenRequests);
          return;
        }
        receiver.send(
          desktopIpcChannels.sourceDocumentOpenRequested,
          await readSourceDocuments(requests[index] ?? []),
        );
      }
    })
    .catch(() => {
      if (!receiver.isDestroyed() && sourceDocumentOpenReceiver === receiver) {
        receiver.send(desktopIpcChannels.sourceDocumentOpenRequested, {
          message: '系统交给应用的文档暂时无法打开。',
          status: 'error',
        } satisfies OpenSourceDocumentsResult);
      }
    });
};

const enqueueSourceDocumentOpenRequest = (paths: readonly string[]): void => {
  if (paths.length === 0) return;
  pendingSourceDocumentOpenRequests.push([...paths]);
  deliverPendingSourceDocumentOpenRequests();
};

const choosePdfExportPath = async (
  owner: BrowserWindow,
  sourceDocumentPath: string,
): Promise<string | undefined> => {
  const testOutputPath = process.env.FUXIAN_E2E_PDF_EXPORT_FILE;
  if (!app.isPackaged && process.env.NODE_ENV === 'test' && testOutputPath) {
    return testOutputPath;
  }
  const sourceName = basename(sourceDocumentPath, extname(sourceDocumentPath));
  const selection = await dialog.showSaveDialog(owner, {
    defaultPath: `${sourceName}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    title: '导出 PDF',
  });
  return selection.canceled ? undefined : selection.filePath;
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
  ipcMain.on(desktopIpcChannels.sourceDocumentOpenReceiverReady, (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || owner !== mainWindow) return;
    sourceDocumentOpenReceiver = event.sender;
    event.sender.once('destroyed', () => {
      if (sourceDocumentOpenReceiver === event.sender) sourceDocumentOpenReceiver = undefined;
    });
    deliverPendingSourceDocumentOpenRequests();
  });
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
  ipcMain.handle(
    desktopIpcChannels.startPdfExport,
    async (event, value: unknown): Promise<StartPdfExportResult> => {
      const request = value as Partial<StartPdfExportRequest> | undefined;
      const originWindow = BrowserWindow.fromWebContents(event.sender);
      if (
        !originWindow ||
        !request ||
        typeof request.path !== 'string' ||
        typeof request.source !== 'string' ||
        request.source.length > 10_000_000 ||
        !Array.isArray(request.renderedPlantUmlDiagrams) ||
        request.renderedPlantUmlDiagrams.length > 100 ||
        request.renderedPlantUmlDiagrams.some(
          (diagram) =>
            !diagram ||
            typeof diagram.source !== 'string' ||
            diagram.source.length > 1_000_000 ||
            typeof diagram.svg !== 'string' ||
            diagram.svg.length > 5_000_000,
        ) ||
        request.renderedPlantUmlDiagrams.reduce(
          (total, diagram) => total + diagram.source.length + diagram.svg.length,
          0,
        ) > 20_000_000 ||
        !knownDocumentPaths.has(request.path)
      ) {
        return { message: '当前文档不属于受信任的文档会话。', status: 'failed' };
      }
      if ([...pdfExportJobs.values()].some((job) => job.originWindow === originWindow)) {
        return { message: '已有 PDF 正在导出。', status: 'failed' };
      }

      const outputPath = await choosePdfExportPath(originWindow, request.path);
      if (!outputPath) return { status: 'cancelled' };
      const result = await readSourceDocument(request.path);
      if (result.status === 'unavailable') {
        return { message: result.message, status: 'failed' };
      }

      const exportId = randomUUID();
      const exportWindow = createPdfExportWindow();
      const job: PdfExportJob = {
        cancelled: false,
        exportWindow,
        id: exportId,
        originWindow,
        outputPath,
        payload: {
          document: { ...result.document, source: request.source },
          exportId,
          preferences: normalizeReaderPreferences(request.preferences),
          renderedPlantUmlDiagrams: request.renderedPlantUmlDiagrams.map(({ source, svg }) => ({
            source,
            svg,
          })),
        },
        printing: false,
        temporaryPath: `${outputPath}.${exportId}.tmp`,
      };
      pdfExportJobs.set(exportId, job);
      job.timeout = setTimeout(() => failPdfExportJob(job, 'PDF 导出页面准备超时。'), 45_000);
      exportWindow.webContents.once('did-fail-load', () => {
        failPdfExportJob(job, 'PDF 导出页面加载失败。');
      });
      exportWindow.webContents.once('render-process-gone', () => {
        failPdfExportJob(job, 'PDF 导出进程意外退出。');
      });
      exportWindow.on('closed', () => {
        if (pdfExportJobs.get(exportId) !== job) return;
        pdfExportJobs.delete(exportId);
        if (job.timeout) clearTimeout(job.timeout);
        void rm(job.temporaryPath, { force: true }).catch(() => undefined);
        if (!job.cancelled) {
          sendPdfExportProgress(job, {
            exportId,
            message: 'PDF 导出窗口意外关闭。',
            status: 'failed',
          });
        }
      });
      originWindow.webContents.once('destroyed', () => {
        if (pdfExportJobs.get(exportId) === job) {
          job.cancelled = true;
          closePdfExportJob(job);
        }
      });
      loadPdfExportWindow(exportWindow, exportId);
      sendPdfExportProgress(job, {
        exportId,
        progress: 5,
        stage: 'preparing',
        status: 'running',
      });
      return { exportId, status: 'started' };
    },
  );
  ipcMain.handle(desktopIpcChannels.cancelPdfExport, (event, exportId: unknown) => {
    if (typeof exportId !== 'string') return;
    const job = pdfExportJobs.get(exportId);
    if (!job || job.originWindow.webContents !== event.sender) return;
    job.cancelled = true;
    sendPdfExportProgress(job, { exportId, status: 'cancelled' });
    void rm(job.temporaryPath, { force: true }).catch(() => undefined);
    closePdfExportJob(job);
  });
  ipcMain.handle(
    desktopIpcChannels.getPdfExportPayload,
    (event, exportId: unknown): PdfExportPayload => {
      const job = typeof exportId === 'string' ? pdfExportJobs.get(exportId) : undefined;
      if (!job || job.exportWindow.webContents !== event.sender) {
        throw new TypeError('PDF export payload is unavailable.');
      }
      return job.payload;
    },
  );
  ipcMain.on(desktopIpcChannels.reportPdfExportProgress, (event, value: unknown) => {
    const progress = value as Partial<PdfExportRenderProgress> | undefined;
    const job = progress?.exportId ? pdfExportJobs.get(progress.exportId) : undefined;
    if (
      !job ||
      job.exportWindow.webContents !== event.sender ||
      job.printing ||
      typeof progress?.completed !== 'number' ||
      typeof progress.total !== 'number'
    ) {
      return;
    }
    const ratio = progress.total > 0 ? progress.completed / progress.total : 1;
    sendPdfExportProgress(job, {
      exportId: job.id,
      progress: Math.round(10 + Math.min(1, Math.max(0, ratio)) * 75),
      stage: 'rendering',
      status: 'running',
    });
  });
  ipcMain.on(desktopIpcChannels.pdfExportReady, (event, value: unknown) => {
    const signal = value as Partial<PdfExportReadySignal> | undefined;
    const job = signal?.exportId ? pdfExportJobs.get(signal.exportId) : undefined;
    if (!job || job.exportWindow.webContents !== event.sender || job.cancelled || job.printing)
      return;
    if (signal?.status === 'failed') {
      failPdfExportJob(
        job,
        typeof signal.message === 'string' ? signal.message : 'PDF 导出页面准备失败。',
      );
      return;
    }
    if (signal?.status !== 'ready') return;
    job.printing = true;
    if (job.timeout) clearTimeout(job.timeout);
    job.timeout = setTimeout(() => failPdfExportJob(job, '写入 PDF 超时。'), 30_000);
    sendPdfExportProgress(job, {
      exportId: job.id,
      progress: 90,
      stage: 'saving',
      status: 'running',
    });
    void (async () => {
      try {
        if (
          !app.isPackaged &&
          process.env.NODE_ENV === 'test' &&
          process.env.FUXIAN_E2E_PDF_EXPORT_FAILURE === 'print'
        ) {
          throw new Error('测试环境模拟 PDF 生成失败。');
        }
        const pdf = await job.exportWindow.webContents.printToPDF({
          generateDocumentOutline: true,
          generateTaggedPDF: true,
          pageSize: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
        });
        if (job.cancelled || pdfExportJobs.get(job.id) !== job) return;
        await writeFile(job.temporaryPath, pdf);
        if (job.cancelled || pdfExportJobs.get(job.id) !== job) {
          await rm(job.temporaryPath, { force: true });
          return;
        }
        await rename(job.temporaryPath, job.outputPath);
        sendPdfExportProgress(job, {
          exportId: job.id,
          outputPath: job.outputPath,
          status: 'completed',
        });
        closePdfExportJob(job);
      } catch (error) {
        await rm(job.temporaryPath, { force: true }).catch(() => undefined);
        if (job.cancelled || pdfExportJobs.get(job.id) !== job) return;
        sendPdfExportProgress(job, {
          exportId: job.id,
          message: error instanceof Error ? error.message : '无法生成 PDF。',
          status: 'failed',
        });
        closePdfExportJob(job);
      }
    })();
  });
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

const createPdfExportWindow = (): BrowserWindow =>
  new BrowserWindow({
    height: 1123,
    show: false,
    width: 794,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDirectory, '../preload/index.cjs'),
      sandbox: true,
    },
  });

const loadPdfExportWindow = (window: BrowserWindow, exportId: string): void => {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    url.searchParams.set('exportId', exportId);
    url.searchParams.set('view', 'pdf-export');
    void window.loadURL(url.toString());
  } else {
    void window.loadFile(join(currentDirectory, '../renderer/index.html'), {
      query: { exportId, view: 'pdf-export' },
    });
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
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = undefined;
      sourceDocumentOpenReceiver = undefined;
    }
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

  mainWindow = window;
  return window;
};

const activateMainWindow = (): void => {
  const window =
    (!mainWindow || mainWindow.isDestroyed()) && app.isReady() ? createWindow() : mainWindow;
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
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

if (!app.isPackaged && process.env.NODE_ENV === 'test' && process.env.FUXIAN_E2E_SESSION_FILE) {
  app.setPath('userData', `${process.env.FUXIAN_E2E_SESSION_FILE}.user-data`);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  enqueueSourceDocumentOpenRequest(extractSourceDocumentPaths(process.argv, process.cwd()));
  app.on('second-instance', (_event, argv, workingDirectory) => {
    enqueueSourceDocumentOpenRequest(extractSourceDocumentPaths(argv, workingDirectory));
    activateMainWindow();
  });
  app.on('open-file', (event, path) => {
    event.preventDefault();
    enqueueSourceDocumentOpenRequest([path]);
    activateMainWindow();
  });

  void app.whenReady().then(() => {
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
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
