const waitForImageSettled = (
  image: HTMLImageElement,
  timeoutMilliseconds: number,
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  image.loading = 'eager';
  const showFailure = (): void => {
    const container = image.closest('.document-image');
    const error = container?.querySelector<HTMLElement>('.resource-error');
    image.hidden = true;
    image.removeAttribute('src');
    image.removeAttribute('srcset');
    if (error) error.hidden = false;
  };
  if (image.complete) {
    if (!image.naturalWidth) showFailure();
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timeout);
      image.removeEventListener('load', settle);
      image.removeEventListener('error', settle);
      signal?.removeEventListener('abort', abort);
    };
    const settle = (): void => {
      cleanup();
      if (!image.naturalWidth) showFailure();
      resolve();
    };
    const abort = (): void => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      // Freeze the failure before pagination. A late remote response must not
      // change page geometry after export-ready has been signalled.
      cleanup();
      showFailure();
      resolve();
    }, timeoutMilliseconds);
    image.addEventListener('load', settle, { once: true });
    image.addEventListener('error', settle, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
  });
};

export const waitForExportImages = async (
  document: Document | HTMLElement,
  timeoutMilliseconds = 15_000,
  signal?: AbortSignal,
): Promise<void> => {
  await Promise.all(
    Array.from(document.querySelectorAll<HTMLImageElement>('img')).map((image) =>
      waitForImageSettled(image, timeoutMilliseconds, signal),
    ),
  );
};

const layoutFingerprint = (document: Document): string => {
  const body = document.body;
  const root = document.documentElement;
  return [
    root.scrollHeight,
    root.scrollWidth,
    body?.scrollHeight ?? 0,
    body?.scrollWidth ?? 0,
  ].join(':');
};

export const waitForStableExportLayout = (
  window: Window,
  requiredStableFrames = 2,
  maximumFrames = 120,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let frames = 0;
    let previous = '';
    let stableFrames = 0;
    const inspect = (): void => {
      frames += 1;
      const fingerprint = layoutFingerprint(window.document);
      stableFrames = fingerprint === previous ? stableFrames + 1 : 0;
      previous = fingerprint;
      if (stableFrames >= requiredStableFrames) {
        resolve();
        return;
      }
      if (frames >= maximumFrames) {
        reject(new Error('PDF 页面布局未能稳定。'));
        return;
      }
      window.requestAnimationFrame(inspect);
    };
    window.requestAnimationFrame(inspect);
  });
