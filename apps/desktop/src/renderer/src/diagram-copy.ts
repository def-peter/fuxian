export type CopyStatus = 'copied' | 'failed' | 'idle';

export const copyDiagramContent = async (
  copyText: (text: string) => Promise<void>,
  text: string,
): Promise<CopyStatus> => {
  try {
    await copyText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
};
