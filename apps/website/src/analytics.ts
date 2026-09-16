export const websiteEvents = {
  downloadClick: 'download_click',
  featureDetailClick: 'feature_detail_click',
  githubClick: 'github_click',
  sectionViewDownload: 'section_view_download',
  sectionViewFaq: 'section_view_faq',
  sectionViewHero: 'section_view_hero',
  sectionViewReading: 'section_view_reading',
  sectionViewSkill: 'section_view_skill',
  sectionViewVisuals: 'section_view_visuals',
  skillInstallCopy: 'skill_install_copy',
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
const viewedSections = new Set<WebsiteEvent>();
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

export const observeWebsiteSections = (
  sections: ReadonlyArray<{ element: Element | null; event: WebsiteEvent }>,
): (() => void) => {
  if (!enabled || !('IntersectionObserver' in window)) return () => undefined;

  const eventsByElement = new Map<Element, WebsiteEvent>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const event = eventsByElement.get(entry.target);
        if (event && !viewedSections.has(event)) {
          viewedSections.add(event);
          trackWebsiteEvent(event);
        }
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
  );

  for (const { element, event } of sections) {
    if (!element || viewedSections.has(event)) continue;
    eventsByElement.set(element, event);
    observer.observe(element);
  }

  return () => observer.disconnect();
};
