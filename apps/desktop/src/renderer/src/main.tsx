import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SettingsApp } from './SettingsApp';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Renderer root element was not found.');
}

const isSettingsView = new URLSearchParams(globalThis.location.search).get('view') === 'settings';

createRoot(root).render(<StrictMode>{isSettingsView ? <SettingsApp /> : <App />}</StrictMode>);
