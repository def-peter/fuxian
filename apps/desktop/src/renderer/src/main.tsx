import { tooltipTokensCss } from '@fuxian/document-theme/tooltip-tokens';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocalizationProvider } from '@/localization-context';

const tooltipTokens = document.createElement('style');
tooltipTokens.textContent = tooltipTokensCss;
document.head.append(tooltipTokens);

const root = document.getElementById('root');

if (!root) {
  throw new Error('Renderer root element was not found.');
}

const parameters = new URLSearchParams(globalThis.location.search);
const exportId = parameters.get('exportId');
const view = parameters.get('view');

const localized = (children: React.ReactNode): React.JSX.Element => (
  <LocalizationProvider>{children}</LocalizationProvider>
);

const renderView = async (): Promise<void> => {
  if (view === 'paper-preview') {
    const { PaperPreviewApp } = await import('./PaperPreviewApp');
    createRoot(root).render(<PaperPreviewApp />);
    return;
  }
  if (view === 'pdf-export' && exportId) {
    const { ExportApp } = await import('./ExportApp');
    createRoot(root).render(localized(<ExportApp exportId={exportId} />));
    return;
  }
  // Only shell views use Tailwind/shadcn styles. Reading and export documents
  // own their styles so application resets cannot change their content.
  await import('./styles.css');
  if (view === 'settings') {
    const { SettingsApp } = await import('./SettingsApp');
    createRoot(root).render(<StrictMode>{localized(<SettingsApp />)}</StrictMode>);
    return;
  }
  const { App } = await import('./App');
  createRoot(root).render(<StrictMode>{localized(<App />)}</StrictMode>);
};

void renderView();
