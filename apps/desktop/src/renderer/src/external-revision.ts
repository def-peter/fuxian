import type { RenderRevisionSnapshot } from '@fuxian/render-protocol';
import type { Translator } from '../../localization';

export type ExternalRevisionStatus =
  | { state: 'idle' }
  | { state: 'new-content' }
  | { state: 'updating' }
  | { state: 'updated'; time: string }
  | { detail: string; state: 'failed' };

export interface AppendFollowState {
  distanceFromEnd: number;
  hasSelection: boolean;
}

export const appendFollowDistance = 160;

export const isAppendedRevision = (previousSource: string, nextSource: string): boolean =>
  nextSource.length > previousSource.length && nextSource.startsWith(previousSource);

export const shouldFollowAppendedContent = ({
  distanceFromEnd,
  hasSelection,
}: AppendFollowState): boolean => !hasSelection && distanceFromEnd <= appendFollowDistance;

export const getRenderRevisionFailure = (
  snapshot: RenderRevisionSnapshot,
  t: Translator,
): string | undefined => {
  const failedTask = snapshot.tasks.find(
    (task) => task.status === 'failed' || task.status === 'timed-out',
  );
  if (failedTask) {
    const fallback = t('渲染任务失败。');
    const rawDetail = failedTask.error ?? fallback;
    const detail =
      fallback !== '渲染任务失败。' && /\p{Script=Han}/u.test(rawDetail) ? fallback : rawDetail;
    return `${failedTask.kind}${fallback === '渲染任务失败。' ? '：' : ': '}${detail}`;
  }
  if (snapshot.readiness.cancelled > 0) return t('该修订已被更新版本取代。');
  return undefined;
};

const waitForImage = (image: HTMLImageElement, t: Translator): Promise<void> => {
  image.loading = 'eager';
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(
          new Error(
            t('无法加载本地资源：{url}', {
              url: image.dataset.resourceUrl ?? image.src,
            }),
          ),
        );
  }

  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
    };
    const handleLoad = (): void => {
      cleanup();
      resolve();
    };
    const handleError = (): void => {
      cleanup();
      reject(
        new Error(
          t('无法加载本地资源：{url}', {
            url: image.dataset.resourceUrl ?? image.src,
          }),
        ),
      );
    };
    image.addEventListener('load', handleLoad, { once: true });
    image.addEventListener('error', handleError, { once: true });
  });
};

export const waitForFinishedDocumentResources = async (
  frameDocument: Document,
  t: Translator,
  timeoutMilliseconds = 15_000,
): Promise<void> => {
  const resources = Promise.all(
    Array.from(frameDocument.querySelectorAll<HTMLImageElement>('img[data-resource-url]')).map(
      (image) => waitForImage(image, t),
    ),
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(t('等待本地资源加载超时。'))), timeoutMilliseconds);
  });
  try {
    await Promise.race([resources, timedOut]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};
