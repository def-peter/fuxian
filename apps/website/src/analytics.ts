export const websiteEvents = {
  downloadClick: 'download_click',
  githubClick: 'github_click',
} as const;

export type WebsiteEvent = (typeof websiteEvents)[keyof typeof websiteEvents];

type UmamiTracker = {
  track(event: WebsiteEvent): void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

const defaultScriptUrl = 'https://cloud.umami.is/script.js';
const pendingEvents: WebsiteEvent[] = [];
let enabled = false;

const validWebsiteId = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const secureScriptUrl = (value: string | undefined): string | undefined => {
  try {
    const url = new URL(value?.trim() || defaultScriptUrl);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const flushPendingEvents = () => {
  if (!window.umami?.track) return;
  for (const event of pendingEvents.splice(0)) window.umami.track(event);
};

export const initializeWebsiteAnalytics = ({
  scriptUrl,
  websiteId,
}: {
  scriptUrl?: string;
  websiteId?: string;
}): void => {
  const id = websiteId?.trim() ?? '';
  const source = secureScriptUrl(scriptUrl);
  if (!validWebsiteId(id) || !source) return;

  enabled = true;
  if (document.querySelector('script[data-fuxian-analytics]')) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = source;
  script.dataset.fuxianAnalytics = '';
  script.dataset.websiteId = id;
  script.dataset.doNotTrack = 'true';
  script.dataset.excludeHash = 'true';
  script.dataset.excludeSearch = 'true';
  script.addEventListener('load', flushPendingEvents, { once: true });
  document.head.append(script);
};

export const trackWebsiteEvent = (event: WebsiteEvent): void => {
  if (!enabled) return;
  if (window.umami?.track) {
    window.umami.track(event);
    return;
  }
  if (pendingEvents.length < 50) pendingEvents.push(event);
};
