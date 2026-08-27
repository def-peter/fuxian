import type { RenderRevisionSnapshot } from '@fuxian/render-protocol';

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

export const getRenderRevisionFailure = (snapshot: RenderRevisionSnapshot): string | undefined => {
  const failedTask = snapshot.tasks.find(
    (task) => task.status === 'failed' || task.status === 'timed-out',
  );
  if (failedTask) {
    return `${failedTask.kind}：${failedTask.error ?? '渲染失败。'}`;
  }
  if (snapshot.readiness.cancelled > 0) return '该修订已被更新版本取代。';
  return undefined;
};

const waitForImage = (image: HTMLImageElement): Promise<void> => {
  image.loading = 'eager';
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error(`无法加载本地资源：${image.dataset.resourceUrl ?? image.src}`));
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
      reject(new Error(`无法加载本地资源：${image.dataset.resourceUrl ?? image.src}`));
    };
    image.addEventListener('load', handleLoad, { once: true });
    image.addEventListener('error', handleError, { once: true });
  });
};

export const waitForFinishedDocumentResources = async (
  frameDocument: Document,
  timeoutMilliseconds = 15_000,
): Promise<void> => {
  const resources = Promise.all(
    Array.from(frameDocument.querySelectorAll<HTMLImageElement>('img[data-resource-url]')).map(
      waitForImage,
    ),
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('等待本地资源加载超时。')), timeoutMilliseconds);
  });
  try {
    await Promise.race([resources, timedOut]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};
