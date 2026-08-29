declare module 'pagedjs' {
  interface PagedFlow {
    pages: unknown[];
    total: number;
  }

  interface PagedChunker {
    stop(): void;
  }

  interface PagedPolisher {
    destroy(): void;
    inserted: HTMLStyleElement[];
    styleEl: HTMLStyleElement;
  }

  export class Previewer {
    chunker: PagedChunker;
    polisher: PagedPolisher;
    preview(
      content: string | Element,
      stylesheets: Array<Record<string, string> | string>,
      renderTo: Element,
    ): Promise<PagedFlow>;
  }
}
