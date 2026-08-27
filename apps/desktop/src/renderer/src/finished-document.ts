import { documentThemeCss } from '@fuxian/document-theme';
import type { ReadingPosition } from '@fuxian/shared-types';
import { captureReadingPosition, resolveReadingPosition } from './reading-position';

export interface FindResult {
  current: number;
  total: number;
}

export interface FinishedDocumentController {
  clearFind(): FindResult;
  destroy(): void;
  find(query: string): FindResult;
  findNext(): FindResult;
  findPrevious(): FindResult;
  getReadingPosition(): ReadingPosition;
  restoreReadingPosition(position: ReadingPosition): void;
  scrollToHeading(id: string): void;
}

interface BindFinishedDocumentOptions {
  copyText(text: string): Promise<void>;
  initialReadingPosition: ReadingPosition;
  onActiveHeadingChange(id: string | undefined): void;
  onFindRequest(): void;
  onReadingPositionChange(position: ReadingPosition): void;
}

const emptyFindResult = (): FindResult => ({ current: 0, total: 0 });

export function createFinishedDocumentSource(body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src fuxian-resource:; style-src 'unsafe-inline'" />
    <style>${documentThemeCss}</style>
  </head>
  <body>
    <main class="finished-document">${body}</main>
  </body>
</html>`;
}

export function bindFinishedDocument(
  frameDocument: Document,
  {
    copyText,
    initialReadingPosition,
    onActiveHeadingChange,
    onFindRequest,
    onReadingPositionChange,
  }: BindFinishedDocumentOptions,
): FinishedDocumentController {
  const frameWindow = frameDocument.defaultView;
  if (!frameWindow) {
    throw new TypeError('The finished document must have an active window.');
  }

  const headingElements = Array.from(
    frameDocument.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'),
  ).filter((heading) => !heading.matches('.sr-only') && !heading.closest('[hidden]'));
  const findRanges: Range[] = [];
  let currentFindIndex = -1;
  let scrollAnimationFrame = 0;
  let restoreAnimationFrame = 0;
  let restoringReadingPosition = true;

  const getHeadingOffsets = () =>
    headingElements.map((heading) => ({
      id: heading.id,
      top: frameWindow.scrollY + heading.getBoundingClientRect().top,
    }));

  const getMaxScroll = (): number =>
    Math.max(0, frameDocument.documentElement.scrollHeight - frameWindow.innerHeight);

  const getReadingPosition = (): ReadingPosition =>
    captureReadingPosition(frameWindow.scrollY, getMaxScroll(), getHeadingOffsets());

  const restoreReadingPosition = (position: ReadingPosition): void => {
    frameWindow.scrollTo({
      top: resolveReadingPosition(position, getMaxScroll(), getHeadingOffsets()),
    });
  };

  const setImageErrorVisible = (image: HTMLImageElement, visible: boolean): void => {
    const error = image.closest('.document-image')?.querySelector<HTMLElement>('.resource-error');
    image.hidden = visible;
    if (error) {
      error.hidden = !visible;
    }
  };

  const updateActiveHeading = (): void => {
    scrollAnimationFrame = 0;
    if (headingElements.length === 0) {
      onActiveHeadingChange(undefined);
      return;
    }

    const activationLine = Math.min(140, frameWindow.innerHeight * 0.25);
    let activeHeading = headingElements[0];
    for (const heading of headingElements) {
      if (heading.getBoundingClientRect().top > activationLine) {
        break;
      }
      activeHeading = heading;
    }

    onActiveHeadingChange(activeHeading?.id);
    if (!restoringReadingPosition) {
      onReadingPositionChange(getReadingPosition());
    }
  };

  const scheduleActiveHeadingUpdate = (): void => {
    if (!scrollAnimationFrame) {
      scrollAnimationFrame = frameWindow.requestAnimationFrame(updateActiveHeading);
    }
  };

  const clearFindHighlights = (): FindResult => {
    frameWindow.CSS.highlights.delete('fuxian-find-results');
    frameWindow.CSS.highlights.delete('fuxian-find-current');
    findRanges.length = 0;
    currentFindIndex = -1;
    return emptyFindResult();
  };

  const activateFindRange = (index: number): FindResult => {
    if (findRanges.length === 0) {
      return emptyFindResult();
    }

    currentFindIndex = (index + findRanges.length) % findRanges.length;
    const currentRange = findRanges[currentFindIndex];
    if (!currentRange) {
      return emptyFindResult();
    }

    const HighlightConstructor = Reflect.get(frameWindow, 'Highlight') as typeof Highlight;
    frameWindow.CSS.highlights.set('fuxian-find-current', new HighlightConstructor(currentRange));

    const matchRect = currentRange.getBoundingClientRect();
    frameWindow.scrollTo({
      behavior: 'smooth',
      top: Math.max(0, frameWindow.scrollY + matchRect.top - frameWindow.innerHeight * 0.3),
    });

    return { current: currentFindIndex + 1, total: findRanges.length };
  };

  const find = (query: string): FindResult => {
    clearFindHighlights();
    if (!query) {
      return emptyFindResult();
    }

    const normalizedQuery = query.toLocaleLowerCase();
    const walker = frameDocument.createTreeWalker(
      frameDocument.querySelector('.finished-document') ?? frameDocument.body,
      NodeFilter.SHOW_TEXT,
    );

    let textNode = walker.nextNode();
    while (textNode) {
      const parent = textNode.parentElement;
      const value = textNode.nodeValue ?? '';
      if (parent && !parent.closest('[hidden], .sr-only') && value) {
        const normalizedValue = value.toLocaleLowerCase();
        let matchIndex = normalizedValue.indexOf(normalizedQuery);
        while (matchIndex !== -1) {
          const range = frameDocument.createRange();
          range.setStart(textNode, matchIndex);
          range.setEnd(textNode, matchIndex + query.length);
          findRanges.push(range);
          matchIndex = normalizedValue.indexOf(normalizedQuery, matchIndex + query.length);
        }
      }
      textNode = walker.nextNode();
    }

    if (findRanges.length === 0) {
      return emptyFindResult();
    }

    const HighlightConstructor = Reflect.get(frameWindow, 'Highlight') as typeof Highlight;
    frameWindow.CSS.highlights.set('fuxian-find-results', new HighlightConstructor(...findRanges));
    return activateFindRange(0);
  };

  const handleFinishedDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const retryButton = target?.closest<HTMLButtonElement>('[data-retry-resource]');
    if (retryButton) {
      const container = retryButton.closest('.document-image');
      const image = container?.querySelector<HTMLImageElement>('img[data-resource-url]');
      if (!image?.dataset.resourceUrl) {
        return;
      }

      const retryUrl = new URL(image.dataset.resourceUrl);
      retryUrl.searchParams.set('retry', Date.now().toString());
      setImageErrorVisible(image, false);
      image.src = retryUrl.toString();
      return;
    }

    const button = target?.closest<HTMLButtonElement>('[data-copy-code]');
    const code = button?.closest('.code-block')?.querySelector('pre code');
    if (!button || !code) {
      return;
    }

    button.disabled = true;
    void copyText(code.textContent ?? '')
      .then(() => {
        button.textContent = '已复制';
      })
      .catch(() => {
        button.textContent = '失败';
      })
      .finally(() => {
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = '复制';
        }, 1200);
      });
  };

  const handleResourceError = (event: Event): void => {
    const image = event.target as HTMLImageElement | null;
    if (image?.matches('img[data-resource-url]')) {
      setImageErrorVisible(image, true);
    }
  };

  const handleResourceLoad = (event: Event): void => {
    const image = event.target as HTMLImageElement | null;
    if (image?.matches('img[data-resource-url]')) {
      setImageErrorVisible(image, false);
    }
  };

  const handleFinishedDocumentKeyDown = (event: KeyboardEvent): void => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'f') {
      event.preventDefault();
      onFindRequest();
    }
  };

  frameDocument.addEventListener('click', handleFinishedDocumentClick);
  frameDocument.addEventListener('error', handleResourceError, true);
  frameDocument.addEventListener('load', handleResourceLoad, true);
  frameWindow.addEventListener('keydown', handleFinishedDocumentKeyDown);
  frameWindow.addEventListener('scroll', scheduleActiveHeadingUpdate, { passive: true });

  for (const image of frameDocument.querySelectorAll<HTMLImageElement>('img[data-resource-url]')) {
    if (image.complete && image.naturalWidth === 0) {
      setImageErrorVisible(image, true);
    }
  }
  onActiveHeadingChange(headingElements[0]?.id);
  scrollAnimationFrame = frameWindow.requestAnimationFrame(updateActiveHeading);
  restoreAnimationFrame = frameWindow.requestAnimationFrame(() => {
    restoreAnimationFrame = frameWindow.requestAnimationFrame(() => {
      restoreAnimationFrame = 0;
      restoreReadingPosition(initialReadingPosition);
      restoringReadingPosition = false;
      updateActiveHeading();
    });
  });

  return {
    clearFind: clearFindHighlights,
    destroy: () => {
      clearFindHighlights();
      if (scrollAnimationFrame) {
        frameWindow.cancelAnimationFrame(scrollAnimationFrame);
      }
      if (restoreAnimationFrame) {
        frameWindow.cancelAnimationFrame(restoreAnimationFrame);
      }
      frameDocument.removeEventListener('click', handleFinishedDocumentClick);
      frameDocument.removeEventListener('error', handleResourceError, true);
      frameDocument.removeEventListener('load', handleResourceLoad, true);
      frameWindow.removeEventListener('keydown', handleFinishedDocumentKeyDown);
      frameWindow.removeEventListener('scroll', scheduleActiveHeadingUpdate);
    },
    find,
    findNext: () => activateFindRange(currentFindIndex + 1),
    findPrevious: () => activateFindRange(currentFindIndex - 1),
    getReadingPosition,
    restoreReadingPosition,
    scrollToHeading: (id: string) => {
      frameDocument.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };
}
