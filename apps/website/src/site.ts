export type Language = 'zh' | 'en';
export type Page = 'home' | 'features';
export const siteOrigin = 'https://def-peter.github.io';
export const siteBase = import.meta.env.BASE_URL;
export const assetUrl = (path: string) => `${siteBase}${path}`;
export const pageUrl = (language: Language, page: Page = 'home') =>
  `${siteBase}${language}/${page === 'features' ? 'features/' : ''}`;

export function resolveRoute(pathname: string): {
  language: Language;
  page: Page;
  isRoot: boolean;
} {
  const path = pathname.startsWith(siteBase) ? pathname.slice(siteBase.length) : pathname;
  const parts = path.split('/').filter(Boolean);
  return {
    language: parts[0] === 'en' ? 'en' : 'zh',
    page: parts[1] === 'features' ? 'features' : 'home',
    isRoot: parts.length === 0 || parts[0] === 'index.html',
  };
}

export const siteCopy = {
  zh: {
    features: '功能详解',
    intro:
      '面向 Windows 与 macOS 的 Markdown 桌面阅读器，让文字、图形与公式清晰呈现，也方便分享与导出 PDF。',
    title: '浮现 Fuxian — Markdown 阅读器与 PDF 导出',
    featureTitle: '功能详解 — Markdown 阅读、图形与 PDF | 浮现 Fuxian',
    featureDescription:
      '了解浮现的 Markdown 阅读与大纲、四种图形代码块、fuxian-diagram 图形创作 Skill、A4 纸张预览、PDF 导出和轻量编辑。',
    description:
      '浮现是一款免费的开源 Markdown 桌面阅读器，支持 Windows、macOS、Mermaid、PlantUML、Vega-Lite、AntV Infographic、A4 纸张预览与 PDF 导出。',
    faqTitle: '开始之前，你可能想了解。',
    faqLabel: '常见问题',
    moreReading: '了解阅读与大纲',
    moreVisuals: '查看图形支持与示例',
    more: '查看全部功能与使用说明',
    questions: [
      [
        '浮现支持哪些系统？',
        '支持 Windows x64、macOS Apple Silicon 和 macOS Intel。可以在 GitHub Releases 选择适合设备的安装包。',
      ],
      [
        '可以免费使用吗？',
        '可以。浮现免费提供，并以 MIT 许可证开源，源码和版本更新均可在 GitHub 查看。',
      ],
      [
        '支持哪些图形？',
        '支持 Mermaid、PlantUML、Vega-Lite 和 AntV Infographic。文档中的对应代码块会渲染为图形，可查看源码、全屏阅读并复制 SVG。',
      ],
      [
        '可以把带图形的 Markdown 导出为 PDF 吗？',
        '可以。打开文档后，可先切换到 A4 纸张预览检查分页，再导出 PDF。导出会等待所需图形渲染完成；使用网络资源时，需要确保相关资源可访问。',
      ],
    ],
  },
  en: {
    features: 'Features',
    intro:
      'A Markdown desktop reader for Windows and macOS. Read text, diagrams, and formulas clearly, then share your work as a PDF.',
    title: 'Fuxian — Markdown Reader & PDF Export',
    featureTitle: 'Features — Markdown, Diagrams & PDF | Fuxian',
    featureDescription:
      'Explore Markdown reading, four diagram languages, the fuxian-diagram authoring skill, A4 preview, PDF export, and lightweight editing in Fuxian.',
    description:
      'Fuxian is a free, open-source Markdown desktop reader for Windows and macOS, with Mermaid, PlantUML, Vega-Lite, AntV Infographic, A4 paper preview, and PDF export.',
    faqTitle: 'A few things before you start.',
    faqLabel: 'Common questions',
    moreReading: 'Explore reading and outlines',
    moreVisuals: 'Explore diagram support and examples',
    more: 'Explore all features and usage notes',
    questions: [
      [
        'Which operating systems are supported?',
        'Fuxian supports Windows x64, macOS Apple Silicon, and macOS Intel. Choose the installer for your device on GitHub Releases.',
      ],
      [
        'Is Fuxian free?',
        'Yes. Fuxian is free to use and open source under the MIT license. Source code and releases are available on GitHub.',
      ],
      [
        'Which diagrams are supported?',
        'Fuxian renders Mermaid, PlantUML, Vega-Lite, and AntV Infographic code blocks. You can inspect source, view diagrams full screen, and copy their SVG.',
      ],
      [
        'Can I export Markdown with diagrams to PDF?',
        'Yes. Open a document, inspect its pagination in A4 paper preview, and export a PDF. Export waits for required diagrams to finish rendering. Any network resources used by the document must be accessible.',
      ],
    ],
  },
} as const;
