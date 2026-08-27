const waitForImageSettled = (image: HTMLImageElement): Promise<void> => {
  image.loading = 'eager';
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    const settle = (): void => {
      image.removeEventListener('load', settle);
      image.removeEventListener('error', settle);
      resolve();
    };
    image.addEventListener('load', settle, { once: true });
    image.addEventListener('error', settle, { once: true });
  });
};

export const waitForExportImages = async (
  document: Document,
  timeoutMilliseconds = 15_000,
): Promise<void> => {
  const images = Promise.all(
    Array.from(document.querySelectorAll<HTMLImageElement>('img')).map(waitForImageSettled),
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<void>((resolve) => {
    timeout = setTimeout(resolve, timeoutMilliseconds);
  });
  await Promise.race([images, timedOut]);
  if (timeout) clearTimeout(timeout);
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
