export const isPaperPreviewFrameUrl = (candidate: string, mainDocumentUrl: string): boolean => {
  try {
    const frame = new URL(candidate);
    const main = new URL(mainDocumentUrl);
    const uiLocale = frame.searchParams.get('uiLocale');
    return (
      frame.protocol === main.protocol &&
      frame.host === main.host &&
      frame.pathname === main.pathname &&
      frame.hash === '' &&
      frame.searchParams.size === 3 &&
      frame.searchParams.get('view') === 'paper-preview' &&
      Boolean(frame.searchParams.get('channelId')) &&
      (uiLocale === 'en-US' || uiLocale === 'zh-CN')
    );
  } catch {
    return false;
  }
};
