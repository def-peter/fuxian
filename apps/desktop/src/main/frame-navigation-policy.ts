export const isPaperPreviewFrameUrl = (candidate: string, mainDocumentUrl: string): boolean => {
  try {
    const frame = new URL(candidate);
    const main = new URL(mainDocumentUrl);
    return (
      frame.protocol === main.protocol &&
      frame.host === main.host &&
      frame.pathname === main.pathname &&
      frame.hash === '' &&
      frame.searchParams.size === 2 &&
      frame.searchParams.get('view') === 'paper-preview' &&
      Boolean(frame.searchParams.get('channelId'))
    );
  } catch {
    return false;
  }
};
