import { renderToString } from 'react-dom/server';
import { App } from './App';
import { siteCopy, siteOrigin, type Language, type Page } from './site';

const productionBase = `${siteOrigin}/fuxian/`;
const canonicalUrl = (language: Language, page: Page) =>
  `${productionBase}${language}/${page === 'features' ? 'features/' : ''}`;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

export function render(language: Language, page: Page) {
  const t = siteCopy[language];
  const title = page === 'features' ? t.featureTitle : t.title;
  const url = canonicalUrl(language, page);
  const description = page === 'features' ? t.featureDescription : t.description;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${productionBase}#application`,
    name: 'Fuxian',
    alternateName: '浮现',
    url: productionBase,
    description: t.description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Windows, macOS',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    license: 'https://github.com/def-peter/fuxian/blob/main/LICENSE',
    downloadUrl: 'https://github.com/def-peter/fuxian/releases/latest',
    sameAs: 'https://github.com/def-peter/fuxian',
    featureList: [
      'Markdown reading',
      'Mermaid',
      'PlantUML',
      'Vega-Lite',
      'AntV Infographic',
      'AI-assisted diagram authoring with fuxian-diagram',
      'A4 paper preview',
      'PDF export',
    ],
  };
  return {
    html: renderToString(<App language={language} page={page} />),
    language: language === 'zh' ? 'zh-CN' : 'en',
    head: `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${url}" />
<link rel="alternate" hreflang="zh-CN" href="${canonicalUrl('zh', page)}" />
<link rel="alternate" hreflang="en" href="${canonicalUrl('en', page)}" />
<link rel="alternate" hreflang="x-default" href="${page === 'home' ? productionBase : canonicalUrl('en', page)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Fuxian · 浮现" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:locale" content="${language === 'zh' ? 'zh_CN' : 'en_US'}" />
<meta property="og:image" content="${productionBase}images/fuxian-app-icon.png" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${productionBase}images/fuxian-app-icon.png" />
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`,
  };
}

export function sitemap() {
  const entries = (['zh', 'en'] as const).flatMap((language) =>
    (['home', 'features'] as const).map(
      (page) =>
        `<url><loc>${canonicalUrl(language, page)}</loc><xhtml:link rel="alternate" hreflang="zh-CN" href="${canonicalUrl('zh', page)}"/><xhtml:link rel="alternate" hreflang="en" href="${canonicalUrl('en', page)}"/></url>`,
    ),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join('\n')}</urlset>\n`;
}
