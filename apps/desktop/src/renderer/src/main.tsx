import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ExportApp } from './ExportApp';
import { SettingsApp } from './SettingsApp';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Renderer root element was not found.');
}

const parameters = new URLSearchParams(globalThis.location.search);
const exportId = parameters.get('exportId');
const isSettingsView = parameters.get('view') === 'settings';
const isPdfExportView = parameters.get('view') === 'pdf-export' && Boolean(exportId);

createRoot(root).render(
  isPdfExportView && exportId ? (
    <ExportApp exportId={exportId} />
  ) : (
    <StrictMode>{isSettingsView ? <SettingsApp /> : <App />}</StrictMode>
  ),
);
