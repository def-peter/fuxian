import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BookOpenText,
  Download,
  ExternalLink,
  FileOutput,
  FileText,
  Languages,
  Menu,
  Monitor,
  X,
} from 'lucide-react';

import { Features } from './Features';
import { SkillInstall } from './SkillInstall';
import { trackWebsiteEvent, websiteEvents } from './analytics';
import { assetUrl, pageUrl, siteCopy, type Language, type Page } from './site';
type SceneId = 'read' | 'structure' | 'visualize';

const sceneIds = ['read', 'structure', 'visualize'] as const satisfies readonly SceneId[];
const releaseUrl = 'https://github.com/def-peter/fuxian/releases/latest';
const releasesUrl = 'https://github.com/def-peter/fuxian/releases';
const repoUrl = 'https://github.com/def-peter/fuxian';
const issuesUrl = 'https://github.com/def-peter/fuxian/issues';

const copy = {
  zh: {
    nav: { home: '首页', releases: '更新日志', feedback: '反馈' },
    sloganLead: '让内容精彩浮现，',
    title: ['让 Markdown', '值得阅读。'],
    stages: { source: '源码', reading: '阅读', share: '分享' },
    download: '免费下载',
    platform: 'Windows · macOS',
    sourceFile: 'visualization-showcase.md',
    sourceLines: [
      '# 六张图，看清这个月的生意',
      '',
      '```vega-lite',
      '{',
      '  "columns": 3,',
      '  "concat": [',
      '    {',
      '      "title": "成交额趋势",',
      '      "mark": "line"',
      '    },',
      '    {',
      '      "title": "渠道成交排行",',
      '      "mark": "bar"',
      '    },',
      '    {',
      '      "title": "新老客订单",',
      '      "mark": "arc"',
      '    }',
      '  ]',
      '}',
      '```',
    ],
    paperVisualAlt: '浮现纸张预览中的 Vega-Lite 六图经营看板',
    featureItems: [
      { title: '专注阅读', body: '沉浸式的 Markdown 阅读体验' },
      { title: '图表渲染', body: '让数据与图表清晰呈现' },
      { title: '一键导出', body: '生成清晰、好读的 PDF' },
      { title: '多端可用', body: 'Windows · macOS，随时打开' },
    ],
    readingEyebrow: '阅读，不止于预览',
    readingTitle: '源码退后一步，\n内容自然浮现。',
    readingIntro:
      '标题、表格、代码、公式、图片与脚注自然排开。长文有清楚的大纲，也能展开文章结构图。',
    scenes: {
      read: { label: '文档阅读', image: 'images/reading.webp', alt: '浮现的 Markdown 阅读界面' },
      structure: {
        label: '文章结构',
        image: 'images/outline-map.webp',
        alt: '浮现的文章大纲图',
      },
      visualize: {
        label: '数据图形',
        image: 'images/visualization.webp',
        alt: '浮现中的 Vega-Lite 数据图形',
      },
    },
    visualEyebrow: '四种图形语言',
    visualTitle: '代码块里的图形，\n也应该被看见。',
    visualBody:
      'Mermaid、PlantUML、Vega-Lite 和 AntV Infographic 都是文档的一部分。查看源码、全屏阅读、复制 SVG，再带着清晰的图形导出 PDF。',
    officialSite: '官方网站',
    frameworks: [
      {
        name: 'Mermaid',
        description: '流程与关系',
        website: 'https://mermaid.js.org/',
        image: 'images/mermaid.webp',
        alt: '浮现渲染 Mermaid 思维导图',
      },
      {
        name: 'PlantUML',
        description: '专业软件图',
        website: 'https://plantuml.com/',
        image: 'images/plantuml.webp',
        alt: '浮现渲染 PlantUML 顺序图',
      },
      {
        name: 'Vega-Lite',
        description: '数据可视化',
        website: 'https://vega.github.io/vega-lite/',
        image: 'images/visualization.webp',
        alt: '浮现渲染 Vega-Lite 数据看板',
      },
      {
        name: 'AntV Infographic',
        description: '叙事信息图',
        website: 'https://infographic.antv.vision/',
        image: 'images/infographic.webp',
        alt: '浮现渲染 AntV Infographic',
      },
    ],
    skillEyebrow: '图形创作 Skill',
    skillTitle: '让 AI 先读懂，\n再把重点画出来。',
    skillBody:
      'fuxian-diagram 会从内容中找出值得图示的部分，选择合适的图形语言，生成可编辑的 Markdown 源码，并在条件允许时检查语法与版面。',
    skillSteps: [
      ['识别重点', '找出流程、关系、结构与数据中最需要解释的部分。'],
      ['选择图形', '在 Mermaid、PlantUML、Vega-Lite 与 Infographic 中做选择。'],
      ['检查结果', '保留事实与术语，并检查源码、渲染结果和阅读版面。'],
    ],
    skillOptional: 'Skill 是可选的配套能力；不安装也能正常使用浮现阅读 Markdown。',
    skillMore: '了解 Skill 的用途与安装',
    finalTitle: '让下一次阅读，\n从浮现开始。',
    finalBody: '免费下载，支持 Windows 与 macOS。',
    unsigned: '当前安装包尚未签名，首次打开时系统可能要求手动允许。',
    footer: '让内容精彩浮现。',
    language: 'English',
    menu: '打开菜单',
    github: '查看 GitHub 仓库',
  },
  en: {
    nav: { home: 'Home', releases: 'Releases', feedback: 'Feedback' },
    sloganLead: 'Bring content to life.',
    title: ['Make Markdown', 'worth reading.'],
    stages: { source: 'Source', reading: 'Reading', share: 'Share' },
    download: 'Free download',
    platform: 'Windows · macOS',
    sourceFile: 'visualization-showcase-en.md',
    sourceLines: [
      '# Six charts, one clear month',
      '',
      '```vega-lite',
      '{',
      '  "columns": 3,',
      '  "concat": [',
      '    {',
      '      "title": "Revenue trend",',
      '      "mark": "line"',
      '    },',
      '    {',
      '      "title": "Revenue by channel",',
      '      "mark": "bar"',
      '    },',
      '    {',
      '      "title": "New vs. returning",',
      '      "mark": "arc"',
      '    }',
      '  ]',
      '}',
      '```',
    ],
    paperVisualAlt: 'A six-chart Vega-Lite dashboard in Fuxian paper preview',
    featureItems: [
      { title: 'Focused reading', body: 'A calm, immersive Markdown experience' },
      { title: 'Visual rendering', body: 'Diagrams and data, rendered clearly' },
      { title: 'One-click export', body: 'Create clear, readable PDFs' },
      { title: 'Desktop ready', body: 'Windows · macOS, ready anytime' },
    ],
    readingEyebrow: 'Reading beyond preview',
    readingTitle: 'Source steps back.\nContent comes to life.',
    readingIntro:
      'Headings, tables, code, math, images, and footnotes settle naturally on the page. Long reads get a clear outline and an article structure map.',
    scenes: {
      read: {
        label: 'Document reading',
        image: 'images/reading-en.webp',
        alt: 'Markdown reading in Fuxian',
      },
      structure: {
        label: 'Article structure',
        image: 'images/outline-map-en.webp',
        alt: 'Article structure map in Fuxian',
      },
      visualize: {
        label: 'Data visuals',
        image: 'images/visualization-en.webp',
        alt: 'Vega-Lite data visuals in Fuxian',
      },
    },
    visualEyebrow: 'Four visual languages',
    visualTitle: 'Visuals in code blocks\ndeserve to be seen.',
    visualBody:
      'Mermaid, PlantUML, Vega-Lite, and AntV Infographic belong in the document. Inspect source, focus the view, copy SVG, and carry crisp visuals into PDF.',
    officialSite: 'Official website',
    frameworks: [
      {
        name: 'Mermaid',
        description: 'Flows and relationships',
        website: 'https://mermaid.js.org/',
        image: 'images/mermaid-en.webp',
        alt: 'Mermaid mind map rendered in Fuxian',
      },
      {
        name: 'PlantUML',
        description: 'Software diagrams',
        website: 'https://plantuml.com/',
        image: 'images/plantuml-en.webp',
        alt: 'PlantUML sequence diagram rendered in Fuxian',
      },
      {
        name: 'Vega-Lite',
        description: 'Data visualization',
        website: 'https://vega.github.io/vega-lite/',
        image: 'images/visualization-en.webp',
        alt: 'Vega-Lite dashboard rendered in Fuxian',
      },
      {
        name: 'AntV Infographic',
        description: 'Visual storytelling',
        website: 'https://infographic.antv.vision/',
        image: 'images/infographic-en.webp',
        alt: 'AntV Infographic rendered in Fuxian',
      },
    ],
    skillEyebrow: 'Diagram authoring skill',
    skillTitle: 'Let AI understand the content,\nthen draw what matters.',
    skillBody:
      'fuxian-diagram finds content worth visualizing, chooses an appropriate visual language, produces editable Markdown source, and checks syntax and layout when the environment allows.',
    skillSteps: [
      [
        'Find the focus',
        'Identify the flows, relationships, structures, and data that need explanation.',
      ],
      ['Choose a visual', 'Select Mermaid, PlantUML, Vega-Lite, or Infographic for the content.'],
      [
        'Check the result',
        'Preserve facts and terminology, then inspect source, rendering, and layout.',
      ],
    ],
    skillOptional: 'The skill is optional. Fuxian reads Markdown normally without it.',
    skillMore: 'Explore the skill and installation',
    finalTitle: 'Your next read\nstarts with Fuxian.',
    finalBody: 'Free to download. Available for Windows and macOS.',
    unsigned:
      'Current builds are unsigned. Your system may ask you to allow the app on first open.',
    footer: 'Bring content to life.',
    language: '中文',
    menu: 'Open menu',
    github: 'View GitHub repository',
  },
} as const;

const featureIcons = [BookOpenText, BarChart3, FileOutput, Monitor] as const;

function getDownloadLabel(language: Language) {
  if (typeof navigator === 'undefined') return copy[language].download;
  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes('mac')) return language === 'zh' ? '下载 macOS 版' : 'Download for macOS';
  if (agent.includes('win')) return language === 'zh' ? '下载 Windows 版' : 'Download for Windows';
  return copy[language].download;
}

export function App({ language, page }: { language: Language; page: Page }) {
  const [scene, setScene] = useState<SceneId>('read');
  const [sceneCycle, setSceneCycle] = useState(0);
  const [sceneDelay, setSceneDelay] = useState(4_000);
  const [readingInView, setReadingInView] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [topbarScrolled, setTopbarScrolled] = useState(false);
  const [visualIndex, setVisualIndex] = useState(0);
  const [visualCycle, setVisualCycle] = useState(0);
  const [visualDelay, setVisualDelay] = useState(3_000);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState<string>(copy[language].download);
  const readingSection = useRef<HTMLElement>(null);
  const frameworkTabs = useRef<HTMLDivElement>(null);
  const t = copy[language];
  const sceneIndex = sceneIds.indexOf(scene);
  const heroScene = t.scenes.visualize;
  const frameworks = t.frameworks;
  const extra = siteCopy[language];
  const homeAnchor = (hash: string) => (page === 'home' ? hash : `${pageUrl(language)}${hash}`);
  const languageHref = pageUrl(language === 'zh' ? 'en' : 'zh', page);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = page === 'features' ? extra.featureTitle : extra.title;
    setDownloadLabel(getDownloadLabel(language));
  }, [language, page, extra]);

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      const previousBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      target.scrollIntoView({ block: 'start' });
      document.documentElement.style.scrollBehavior = previousBehavior;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [page]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const updateTopbar = () => setTopbarScrolled(window.scrollY > 12);
    updateTopbar();
    window.addEventListener('scroll', updateTopbar, { passive: true });
    return () => window.removeEventListener('scroll', updateTopbar);
  }, []);

  useEffect(() => {
    const section = readingSection.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setReadingInView(entry?.isIntersecting ?? false),
      { threshold: 0.3 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      reduceMotion ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      document.documentElement.classList.remove('reveal-ready');
      return;
    }

    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('reveal-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    elements.forEach((element) => {
      if (element.getBoundingClientRect().top < window.innerHeight * 0.92) {
        element.classList.add('reveal-visible');
      }
      observer.observe(element);
    });
    document.documentElement.classList.add('reveal-ready');

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('reveal-ready');
    };
  }, [page, reduceMotion]);

  useEffect(() => {
    if (!readingInView || reduceMotion) return;
    const timeout = window.setTimeout(() => {
      setScene(sceneIds[(sceneIndex + 1) % sceneIds.length] ?? sceneIds[0]);
      setSceneDelay(4_000);
    }, sceneDelay);
    return () => window.clearTimeout(timeout);
  }, [readingInView, reduceMotion, scene, sceneCycle, sceneDelay, sceneIndex]);

  useEffect(() => {
    if (page !== 'home') return;
    const timeout = window.setTimeout(() => {
      setVisualIndex((current) => (current + 1) % frameworks.length);
      setVisualDelay(3_000);
    }, visualDelay);
    return () => window.clearTimeout(timeout);
  }, [page, frameworks.length, visualCycle, visualDelay, visualIndex]);

  useEffect(() => {
    const tabs = frameworkTabs.current;
    const activeTab = tabs?.querySelector<HTMLElement>(`[data-framework-index="${visualIndex}"]`);
    if (!tabs || !activeTab) return;
    tabs.scrollTo({
      behavior: reduceMotion ? 'auto' : 'smooth',
      left: activeTab.offsetLeft - (tabs.clientWidth - activeTab.offsetWidth) / 2,
    });
  }, [language, reduceMotion, visualIndex]);

  const selectFramework = (index: number) => {
    setVisualIndex(index);
    setVisualDelay(5_000);
    setVisualCycle((current) => current + 1);
  };

  const selectScene = (id: SceneId) => {
    setScene(id);
    setSceneDelay(6_000);
    setSceneCycle((current) => current + 1);
  };

  const moveFrameworkFocus = (current: HTMLButtonElement, index: number) => {
    selectFramework(index);
    const tabs = current.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[index]?.focus();
  };

  return (
    <div className="site-shell">
      <header
        className={`topbar${topbarScrolled ? ' topbar-scrolled' : ''}${menuOpen ? ' topbar-menu-open' : ''}`}
      >
        <a
          className="brand"
          href={homeAnchor('#top')}
          aria-label={language === 'zh' ? '浮现首页' : 'Fuxian home'}
        >
          <img src={assetUrl('images/fuxian-mark.webp')} alt="" />
          <span>{language === 'zh' ? '浮现' : 'Fuxian'}</span>
        </a>
        <nav
          className={menuOpen ? 'nav-links nav-links-open' : 'nav-links'}
          aria-label="Primary navigation"
        >
          <a
            href={homeAnchor('#top')}
            aria-current={page === 'home' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {t.nav.home}
          </a>
          <a
            href={pageUrl(language, 'features')}
            aria-current={page === 'features' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {extra.features}
          </a>
          <a href={releasesUrl} target="_blank" rel="noreferrer">
            {t.nav.releases}
          </a>
          <a href={issuesUrl} target="_blank" rel="noreferrer">
            {t.nav.feedback}
          </a>
          <a
            className="mobile-github"
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackWebsiteEvent(websiteEvents.githubClick);
              setMenuOpen(false);
            }}
          >
            GitHub <ExternalLink size={14} aria-hidden="true" />
          </a>
          <a
            className="language-button mobile-language"
            href={languageHref}
            lang={language === 'zh' ? 'en' : 'zh-CN'}
          >
            <Languages size={16} /> {t.language}
          </a>
        </nav>
        <div className="topbar-actions">
          <a
            className="github-link"
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.github}
            onClick={() => trackWebsiteEvent(websiteEvents.githubClick)}
          >
            <span className="github-mark" aria-hidden="true" />
            <span className="github-tooltip" aria-hidden="true">
              {t.github}
            </span>
          </a>
          <a
            className="language-button"
            href={languageHref}
            lang={language === 'zh' ? 'en' : 'zh-CN'}
          >
            <Languages size={16} /> {t.language}
          </a>
          <a
            className="nav-download"
            href={releaseUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackWebsiteEvent(websiteEvents.downloadClick)}
          >
            <Download size={17} />
            <span>
              {t.download}
              <small>{t.platform}</small>
            </span>
          </a>
          <button
            className="menu-button"
            type="button"
            aria-label={t.menu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <main id="top">
        {page === 'home' ? (
          <>
            <section className="transformation-hero">
              <div className="hero-title-row">
                <p className="slogan-lead">{t.sloganLead}</p>
                <h1>
                  {t.title[0]} <span className="title-phrase">{t.title[1]}</span>
                </h1>
                <span className="title-stroke" aria-hidden="true" />
              </div>
              <p className="hero-intro">{extra.intro}</p>
              <div className="transformation-flow">
                <article className="flow-stage source-stage">
                  <StageLabel number="01" label={t.stages.source} />
                  <div className="source-window">
                    <WindowBar label={t.sourceFile} />
                    <ol>
                      {t.sourceLines.map((line, index) => (
                        <li
                          key={`${index}-${line}`}
                          className={line.startsWith('#') ? 'syntax-heading' : ''}
                        >
                          <code>
                            {line.startsWith('#') ? (
                              <>
                                <span className="syntax-heading-mark">#</span>
                                {line.slice(1)}
                              </>
                            ) : (
                              line || '\u00a0'
                            )}
                          </code>
                        </li>
                      ))}
                    </ol>
                  </div>
                </article>
                <FlowArrow />
                <article className="flow-stage reader-stage">
                  <StageLabel number="02" label={t.stages.reading} />
                  <div className="reader-window">
                    <img src={assetUrl(heroScene.image)} alt={heroScene.alt} />
                  </div>
                </article>
                <FlowArrow />
                <article className="flow-stage export-stage">
                  <StageLabel number="03" label={t.stages.share} />
                  <div className="paper-stack" aria-label={t.stages.share}>
                    <img
                      className="paper-sheet paper-sheet-diagram"
                      src={assetUrl(
                        language === 'zh'
                          ? 'images/paper-diagram.webp'
                          : 'images/paper-diagram-en.webp',
                      )}
                      alt=""
                      aria-hidden="true"
                    />
                    <img
                      className="paper-sheet paper-sheet-visualization"
                      src={assetUrl(
                        language === 'zh'
                          ? 'images/paper-visualization.webp'
                          : 'images/paper-visualization-en.webp',
                      )}
                      alt={t.paperVisualAlt}
                    />
                  </div>
                </article>
              </div>
              <div className="feature-strip">
                {t.featureItems.map((item, index) => {
                  const Icon = featureIcons[index]!;
                  return (
                    <div className="feature-item" key={item.title}>
                      <span className="feature-icon">
                        <Icon size={22} strokeWidth={1.7} />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="reading-section" id="product" ref={readingSection} data-reveal>
              <div className="reading-heading">
                <div className="reading-heading-title">
                  <p className="eyebrow">01 / {t.readingEyebrow}</p>
                  <h2>{t.readingTitle}</h2>
                </div>
                <div>
                  <p className="reading-intro">{t.readingIntro}</p>
                  <a
                    className="text-link section-more"
                    href={`${pageUrl(language, 'features')}#reading`}
                  >
                    {extra.moreReading} <ArrowRight size={15} />
                  </a>
                </div>
              </div>
              <div className="scene-tabs" role="tablist" aria-label={t.readingEyebrow}>
                <span
                  className="scene-tab-indicator"
                  style={{ transform: `translateX(${sceneIndex * 100}%)` }}
                  aria-hidden="true"
                />
                {sceneIds.map((id, index) => (
                  <button
                    key={id}
                    id={`scene-tab-${id}`}
                    type="button"
                    role="tab"
                    aria-controls="scene-panel"
                    aria-selected={scene === id}
                    tabIndex={scene === id ? 0 : -1}
                    onClick={() => selectScene(id)}
                    onKeyDown={(event) => {
                      let nextIndex: number;
                      if (event.key === 'ArrowRight') nextIndex = (index + 1) % sceneIds.length;
                      else if (event.key === 'ArrowLeft')
                        nextIndex = (index + sceneIds.length - 1) % sceneIds.length;
                      else if (event.key === 'Home') nextIndex = 0;
                      else if (event.key === 'End') nextIndex = sceneIds.length - 1;
                      else return;
                      event.preventDefault();
                      const nextId = sceneIds[nextIndex] ?? sceneIds[0];
                      selectScene(nextId);
                      document.getElementById(`scene-tab-${nextId}`)?.focus();
                    }}
                  >
                    <span>0{index + 1}</span>
                    {t.scenes[id].label}
                  </button>
                ))}
              </div>
              <div
                className="scene-image"
                id="scene-panel"
                role="tabpanel"
                aria-labelledby={`scene-tab-${scene}`}
              >
                <div className="scene-frame">
                  {sceneIds.map((id) => {
                    const item = t.scenes[id];
                    const active = scene === id;
                    return (
                      <img
                        className={active ? 'scene-slide scene-slide-active' : 'scene-slide'}
                        key={`${language}-${id}`}
                        src={assetUrl(item.image)}
                        alt={active ? item.alt : ''}
                        aria-hidden={!active}
                        decoding="async"
                        loading="lazy"
                      />
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="visual-section" id="visuals" data-reveal>
              <div className="visual-copy">
                <p className="eyebrow">02 / {t.visualEyebrow}</p>
                <h2>{t.visualTitle}</h2>
                <p>{t.visualBody}</p>
                <a
                  className="text-link section-more"
                  href={`${pageUrl(language, 'features')}#visuals`}
                >
                  {extra.moreVisuals} <ArrowRight size={15} />
                </a>
                <div
                  className="framework-tabs"
                  ref={frameworkTabs}
                  role="tablist"
                  aria-label={t.visualEyebrow}
                >
                  {frameworks.map((framework, index) => (
                    <button
                      id={`framework-tab-${index}`}
                      key={framework.name}
                      data-framework-index={index}
                      type="button"
                      role="tab"
                      aria-controls="framework-panel"
                      aria-selected={visualIndex === index}
                      tabIndex={visualIndex === index ? 0 : -1}
                      onClick={() => selectFramework(index)}
                      onKeyDown={(event) => {
                        const lastIndex = frameworks.length - 1;
                        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                          event.preventDefault();
                          moveFrameworkFocus(
                            event.currentTarget,
                            index === lastIndex ? 0 : index + 1,
                          );
                        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                          event.preventDefault();
                          moveFrameworkFocus(
                            event.currentTarget,
                            index === 0 ? lastIndex : index - 1,
                          );
                        } else if (event.key === 'Home' || event.key === 'End') {
                          event.preventDefault();
                          moveFrameworkFocus(
                            event.currentTarget,
                            event.key === 'Home' ? 0 : lastIndex,
                          );
                        }
                      }}
                    >
                      <span className="framework-index">0{index + 1}</span>
                      <strong>{framework.name}</strong>
                      <small>{framework.description}</small>
                      <ArrowRight className="framework-arrow" size={16} />
                    </button>
                  ))}
                </div>
                <nav className="framework-sites" aria-label={t.officialSite}>
                  <span className="framework-sites-label">{t.officialSite}</span>
                  <div>
                    {frameworks.map((framework) => (
                      <a
                        className="framework-site-link"
                        href={framework.website}
                        key={framework.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={
                          language === 'zh'
                            ? `${framework.name} 官方网站，新标签页打开`
                            : `${framework.name} official website, opens in a new tab`
                        }
                      >
                        {framework.name}
                        <ExternalLink aria-hidden="true" size={13} />
                      </a>
                    ))}
                  </div>
                </nav>
              </div>
              <div
                className="visual-image"
                id="framework-panel"
                role="tabpanel"
                aria-labelledby={`framework-tab-${visualIndex}`}
              >
                <div className="visual-frame">
                  {frameworks.map((framework, index) => (
                    <img
                      className={
                        index === visualIndex ? 'visual-slide visual-slide-active' : 'visual-slide'
                      }
                      key={framework.name}
                      src={assetUrl(framework.image)}
                      alt={index === visualIndex ? framework.alt : ''}
                      aria-hidden={index !== visualIndex}
                      decoding="async"
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="skill-section" id="skill" data-reveal>
              <div className="skill-copy">
                <p className="eyebrow">03 / {t.skillEyebrow}</p>
                <h2>{t.skillTitle}</h2>
                <p>{t.skillBody}</p>
                <a
                  className="text-link section-more"
                  href={`${pageUrl(language, 'features')}#skill`}
                >
                  {t.skillMore} <ArrowRight size={15} />
                </a>
              </div>
              <div className="skill-panel">
                <ol className="skill-steps">
                  {t.skillSteps.map(([title, body], index) => (
                    <li key={title}>
                      <span>0{index + 1}</span>
                      <div>
                        <strong>{title}</strong>
                        <p>{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <SkillInstall language={language} />
                <p className="skill-optional">{t.skillOptional}</p>
              </div>
            </section>

            <section className="faq-section" aria-labelledby="faq-title" data-reveal>
              <div className="faq-heading">
                <p className="eyebrow">{extra.faqLabel}</p>
                <h2 id="faq-title">{extra.faqTitle}</h2>
                <a className="text-link section-more" href={pageUrl(language, 'features')}>
                  {extra.more} <ArrowRight size={15} />
                </a>
              </div>
              <div className="faq-list">
                {extra.questions.map(([question, answer]) => (
                  <details key={question}>
                    <summary>
                      {question}
                      <span aria-hidden="true">+</span>
                    </summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </section>
          </>
        ) : (
          <Features language={language} />
        )}

        <section className="download-section" id="download" data-reveal>
          <div className="download-brand">
            <img
              src={assetUrl('images/fuxian-app-icon.webp')}
              alt=""
              width="96"
              height="96"
              loading="lazy"
            />
            <span>{language === 'zh' ? '浮现' : 'Fuxian'}</span>
          </div>
          <div className="download-copy">
            <p className="eyebrow">
              {page === 'home' ? '04 / ' : ''}
              {t.download}
            </p>
            <h2>{t.finalTitle}</h2>
            <p>{t.finalBody}</p>
          </div>
          <div className="download-action">
            <a
              href={releaseUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackWebsiteEvent(websiteEvents.downloadClick)}
            >
              <Download size={20} />
              <span>
                {downloadLabel}
                <small>{t.platform}</small>
              </span>
            </a>
            <p>{t.unsigned}</p>
          </div>
        </section>
      </main>
      <footer>
        <span>{t.footer}</span>
        <div>
          <a href={pageUrl(language, 'features')}>{extra.features}</a>
          <a href={repoUrl} onClick={() => trackWebsiteEvent(websiteEvents.githubClick)}>
            GitHub
          </a>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}

function StageLabel({ number, label }: { number: string; label: string }) {
  return (
    <div className="stage-label">
      <span>{number}</span>
      <h2>{label}</h2>
    </div>
  );
}

function WindowBar({ label }: { label: string }) {
  return (
    <div className="window-bar">
      <span className="traffic-lights" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <FileText size={13} />
      <span>{label}</span>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flow-arrow" aria-hidden="true">
      <ArrowRight className="desktop-arrow" size={35} strokeWidth={1.5} />
      <ArrowDown className="mobile-arrow" size={32} strokeWidth={1.5} />
    </div>
  );
}
