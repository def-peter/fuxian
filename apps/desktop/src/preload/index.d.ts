export {};

declare global {
  interface Window {
    fuxian: Readonly<Record<string, never>>;
  }
}
