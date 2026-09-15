import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { pageUrl, resolveRoute } from './site';
import './styles.css';

const route = resolveRoute(window.location.pathname);
if (route.isRoot) {
  const language = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  window.location.replace(`${pageUrl(language)}${window.location.search}${window.location.hash}`);
} else {
  const root = document.getElementById('root')!;
  const app = (
    <StrictMode>
      <App language={route.language} page={route.page} />
    </StrictMode>
  );
  if (root.hasChildNodes()) hydrateRoot(root, app);
  else createRoot(root).render(app);
}
