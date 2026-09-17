import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';

export const removePdfTitle = async (bytes: Buffer): Promise<Buffer> => {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const info = document.context.lookupMaybe(document.context.trailerInfo.Info, PDFDict);
  info?.delete(PDFName.of('Title'));
  return Buffer.from(await document.save());
};
