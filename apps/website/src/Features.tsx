import { useState } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { SkillInstall } from './SkillInstall';
import { assetUrl, type Language } from './site';

const content = {
  zh: {
    label: '功能详解',
    title: '从打开文档，\n到读懂与分享。',
    intro: '读长文、看图形、检查纸张版式，再把内容分享出去。需要修改时，也能顺手调整源码。',
    onPage: '本页内容',
    sections: [
      {
        id: 'reading',
        name: '阅读与大纲',
        title: '让长文读起来更轻松。',
        answer:
          '直接打开 .md 或 .markdown 文件，阅读标题、表格、代码、公式、图片与脚注。用内容大纲跳转章节，或展开文章结构图，查看标题之间的层次。',
        points: [
          '调整文档字体、字号、行距与宽度，让版面适合当前屏幕。',
          '同时打开多份文档；退出后再次启动，可恢复打开的文档和各自的阅读位置。',
        ],
        image: 'feature-reading-zh.png',
        alt: '浮现的 Markdown 阅读界面，正文与左右导航区域',
        caption: '正文保持在视线中央，大纲帮助你找到方向。',
      },
      {
        id: 'visuals',
        name: '四种图形',
        title: '图形是文档的一部分。',
        answer:
          '浮现识别四种图形代码块，将源码渲染成可以阅读的图形。每个图形都支持查看源码、全屏查看与复制 SVG，方便核对与复用。',
        points: [
          '在 Markdown 的三个反引号后写入对应语言标签，并在结尾用三个反引号关闭代码块。',
          '保留作者在图形源码中定义的颜色与样式。',
        ],
        note: 'Vega-Lite 展示图表初始状态，支持已渲染标记的提示信息；不提供实时刷选或输入控件，也不加载外部数据与图片标记。',
      },
      {
        id: 'skill',
        name: '图形创作 Skill',
        title: '不知道画什么，也可以先交给 AI。',
        answer:
          'fuxian-diagram 是浮现的配套 AI Skill。它先理解文档中真正需要解释的内容，再选择 Mermaid、PlantUML、Vega-Lite 或 AntV Infographic，生成可编辑的 Markdown 图形源码。',
        points: [
          '适合给整篇文档配图，也可以针对某段流程、架构、数据或观点单独作图。',
          '它会保留来源事实与原有术语；具备渲染环境时，还会检查语法、渲染结果与阅读版面。',
          '安装后，在支持 Skills 的 AI 工具中直接提出“给这篇文档配图”即可使用。',
        ],
        note: '这是可选的创作辅助能力，不是浮现的运行依赖。不安装 Skill，也能正常阅读已有 Markdown 和图形。',
      },
      {
        id: 'paper',
        name: '纸张与 PDF',
        title: '先看纸上的样子，再分享。',
        answer:
          'A4 纸张预览把当前文档排成明确的页面，展示分页、页边距和页数。确认版式后导出 PDF，对方无需安装浮现也能阅读和打印。',
        points: [
          '打开文档，切换到“纸张”，检查分页，然后选择导出 PDF。',
          '导出等待所需内容与图形渲染完成。图形沿用渲染结果，错误会明确提示。',
        ],
        image: 'feature-paper-zh.png',
        alt: '浮现的 A4 纸张预览界面，展示页数、页面间隔与分页后的内容',
        caption: '页数、纸张间隔与分页位置，在导出前清楚可见。',
        note: '纸张预览显示实际分页；连续阅读中的 A4 宽度选项，仅限制阅读宽度。',
      },
      {
        id: 'editing',
        name: '轻量编辑',
        title: '发现一处要改，顺手改好。',
        answer:
          '切换到源码编辑模式，可以修改当前 Markdown，使用语法高亮、行号、查找替换和撤销重做。保存后回到阅读模式，查看修改后的内容。',
        points: [
          '使用 Ctrl / Cmd + S 显式保存，浮现不会静默覆盖你的源文件。',
          '有未保存修改时，切换或关闭文档会提示处理。',
        ],
        image: 'feature-editing-zh.png',
        alt: '浮现的 Markdown 源码编辑界面，显示行号、标题样式和保存状态',
        caption: '在原文里调整内容，保存后回到阅读。',
        note: '编辑与阅读是两个独立模式。回到阅读时，显示最近一次保存的内容。',
      },
      {
        id: 'requirements',
        name: '使用须知',
        title: '使用之前，了解这些细节。',
        answer: '选择适合设备的安装包，也了解文档中的哪些内容需要联网。',
        groups: [
          {
            title: '系统与安装',
            points: [
              '浮现免费提供，以 MIT 许可证开源。支持 Windows x64、macOS Apple Silicon 和 macOS Intel。',
              '安装包与版本说明发布在 GitHub Releases。当前安装包尚未签名，首次打开时系统可能要求手动允许。',
            ],
          },
          {
            title: '离线与联网',
            points: [
              '本地 Markdown、Mermaid 和内联数据的 Vega-Lite 可在本地渲染。',
              'PlantUML 默认使用公共渲染服务，会向配置的服务发送图形源码；也可设置本地或私有服务器。',
              '网络图片及 AntV Infographic 的在线资源需要访问对应服务，并非所有文档都能完全离线显示。',
            ],
          },
        ],
      },
    ],
    noteLabel: '使用说明',
    outlineTitle: '读到细节，也看得见全貌。',
    outlineBody: '从文章标题展开结构图，通过折叠、缩放与拖动，梳理章节之间的层次。',
    outlineCaption: '同一份技术分享文档，展开为多级文章大纲。',
    outlineNote: '文章大纲图由文档标题生成，用于阅读导航，不会作为正文插入导出的 PDF。',
    downloadGuide: '下载这份示例文档',
    sourceLabel: 'Markdown 源码',
    resultLabel: '在浮现中的渲染结果',
    resultAlt: '从打开 Markdown，到阅读与理解，再到导出 PDF 的三步流程图',
    galleryLabel: '选择图形语言',
    galleryCaptions: [
      'Mermaid · 用图形展开流程与关系。',
      'PlantUML · 描述参与者之间的交互顺序。',
      'Vega-Lite · 从多个视角理解数据。',
      'AntV Infographic · 让结构化信息更容易阅读。',
    ],
    table: ['语言标签', '适合表达', '官方文档'],
    kinds: ['流程、结构与关系', '软件架构与交互时序', '数据比较、分布与趋势', '叙事与结构化信息'],
    example: '一段可以放进 Markdown 的 Mermaid 示例',
    downloadExample: '下载示例 Markdown',
    code: '```mermaid\nflowchart LR\n  A[打开 Markdown] --> B[阅读与理解]\n  B --> C[导出 PDF]\n```',
    source: '更多示例见项目 README',
  },
  en: {
    label: 'Features',
    title: 'From opening a document\nto reading and sharing.',
    intro:
      'Read long documents, explore diagrams, check the page layout, and share your work. When something needs changing, make a quick update to the source.',
    onPage: 'On this page',
    sections: [
      {
        id: 'reading',
        name: 'Reading & outlines',
        title: 'Make long reads easier.',
        answer:
          'Open .md or .markdown files to read headings, tables, code, formulas, images, and footnotes. Jump between sections with the outline, or open an article structure map to see the heading hierarchy.',
        points: [
          'Adjust document font, size, line height, and width to suit your screen.',
          'Keep multiple documents open. Restarting the app restores documents and their individual reading positions.',
        ],
        image: 'feature-reading-en.png',
        alt: 'Markdown reading in Fuxian with document navigation and heading outline',
        caption: 'The document stays central, with an outline to help you navigate.',
      },
      {
        id: 'visuals',
        name: 'Four visual languages',
        title: 'Diagrams belong in the document.',
        answer:
          'Fuxian recognizes four visual code-block languages and renders their source into diagrams. Inspect source, view full screen, and copy SVG for checking and reuse.',
        points: [
          'Write the language label after three backticks, then close the block with another three backticks.',
          'Colors and styles defined in the diagram source are preserved.',
        ],
        note: 'Vega-Lite shows the initial chart state and tooltips on rendered marks. Live brushing and input widgets are not provided; external data and image marks are not loaded.',
      },
      {
        id: 'skill',
        name: 'Diagram authoring skill',
        title: 'Let AI decide what is worth drawing.',
        answer:
          'fuxian-diagram is an optional AI skill for Fuxian. It identifies what a document needs to explain, chooses Mermaid, PlantUML, Vega-Lite, or AntV Infographic, and produces editable Markdown diagram source.',
        points: [
          'Use it to illustrate a whole document or a specific process, architecture, dataset, or idea.',
          'It preserves source facts and terminology, then checks syntax, rendering, and reading layout when those tools are available.',
          'After installation, ask a skills-compatible AI tool to “add diagrams to this document.”',
        ],
        note: 'The skill is an optional authoring aid, not a Fuxian runtime dependency. Existing Markdown and diagrams work without it.',
      },
      {
        id: 'paper',
        name: 'Paper & PDF',
        title: 'See the pages before you share.',
        answer:
          'A4 paper preview lays out the current document as individual pages, showing pagination, margins, and page count. Export a PDF after checking the layout, so others can read and print without installing Fuxian.',
        points: [
          'Open a document, switch to Paper, inspect pagination, and select Export PDF.',
          'Export waits for required content and diagrams to render, reuses their rendered results, and reports failures explicitly.',
        ],
        image: 'feature-paper-en.png',
        alt: 'A4 paper preview in Fuxian showing the page count, gaps, and paginated content',
        caption: 'Inspect the page count, spacing, and page breaks before exporting.',
        note: 'Paper preview shows actual pages. The A4 width setting in continuous reading only constrains reading width.',
      },
      {
        id: 'editing',
        name: 'Lightweight editing',
        title: 'Make a change, then keep reading.',
        answer:
          'Switch to source editing to update the current Markdown, with syntax highlighting, line numbers, find and replace, and undo and redo. Save, then return to reading to see the updated content.',
        points: [
          'Save explicitly with Ctrl / Cmd + S. Fuxian does not silently overwrite source files.',
          'Switching or closing a document with unsaved changes prompts you to resolve them.',
        ],
        image: 'feature-editing-en.png',
        alt: 'Markdown source editing in Fuxian with line numbers, heading styles, and save status',
        caption: 'Update the source, save, and return to reading.',
        note: 'Editing and reading are separate modes. Returning to reading shows the most recently saved content.',
      },
      {
        id: 'requirements',
        name: 'Before you start',
        title: 'Know what your document needs.',
        answer:
          'Choose the installer for your device and understand which parts of a document need a connection.',
        groups: [
          {
            title: 'System & installation',
            points: [
              'Fuxian is free and open source under the MIT license, for Windows x64, macOS Apple Silicon, and macOS Intel.',
              'Installers and release notes are on GitHub Releases. Current installers are unsigned; your system may ask you to allow the app on first open.',
            ],
          },
          {
            title: 'Offline & online',
            points: [
              'Local Markdown, Mermaid, and Vega-Lite with inline data can render locally.',
              'PlantUML uses a public rendering service by default and sends diagram source to that service. You can configure a local or private server instead.',
              'Remote images and online AntV Infographic resources need their respective services, so not every document works fully offline.',
            ],
          },
        ],
      },
    ],
    noteLabel: 'Usage note',
    outlineTitle: 'See the details and the whole.',
    outlineBody:
      'Turn headings into an article structure map. Fold branches, zoom, and pan to explore how sections fit together.',
    outlineCaption: 'The same technical presentation, shown as a multi-level article outline.',
    outlineNote:
      'The article structure map is generated from headings for navigation; it is not inserted into the exported PDF.',
    downloadGuide: 'Download this example document',
    sourceLabel: 'Markdown source',
    resultLabel: 'Rendered in Fuxian',
    resultAlt:
      'A three-step flowchart from opening Markdown to reading and understanding, then exporting PDF',
    galleryLabel: 'Choose a visual language',
    galleryCaptions: [
      'Mermaid · Explore flows and relationships.',
      'PlantUML · Describe interactions between participants.',
      'Vega-Lite · Explore multiple views of your data.',
      'AntV Infographic · Make structured information easier to read.',
    ],
    table: ['Language label', 'Best suited to', 'Official documentation'],
    kinds: [
      'Processes, structures, and relationships',
      'Software architecture and interaction sequences',
      'Data comparisons, distributions, and trends',
      'Narrative and structured information',
    ],
    example: 'A Mermaid example you can put in Markdown',
    downloadExample: 'Download example Markdown',
    code: '```mermaid\nflowchart LR\n  A[Open Markdown] --> B[Read and understand]\n  B --> C[Export PDF]\n```',
    source: 'More examples in the project README',
  },
} as const;
const frameworks = [
  ['Mermaid', 'mermaid', 'https://mermaid.js.org/'],
  ['PlantUML', 'plantuml', 'https://plantuml.com/'],
  ['Vega-Lite', 'vega-lite', 'https://vega.github.io/vega-lite/'],
  ['AntV Infographic', 'infographic', 'https://infographic.antv.vision/'],
] as const;

export function Features({ language }: { language: Language }) {
  const t = content[language];
  return (
    <div className="features-page">
      <header className="features-heading" data-reveal>
        <p className="eyebrow">{t.label}</p>
        <h1>{t.title}</h1>
        <p className="features-intro">{t.intro}</p>
      </header>
      <div className="features-layout">
        <nav className="features-outline" aria-label={t.onPage}>
          <span>{t.onPage}</span>
          {t.sections.map((section, i) => (
            <a href={`#${section.id}`} key={section.id}>
              <small>0{i + 1}</small>
              {section.name}
            </a>
          ))}
        </nav>
        <div className="features-articles">
          {t.sections.map((section, i) => (
            <section id={section.id} className="feature-detail" key={section.id} data-reveal>
              <p className="eyebrow">
                0{i + 1} / {section.name}
              </p>
              <h2>{section.title}</h2>
              <p>{section.answer}</p>
              {'image' in section && (
                <FeatureFigure image={section.image} alt={section.alt} caption={section.caption} />
              )}
              {section.id === 'visuals' && <VisualGallery language={language} />}
              {section.id === 'skill' && <SkillInstall language={language} />}
              {'points' in section && (
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
              {section.id === 'reading' && (
                <div className="feature-subsection">
                  <h3>{t.outlineTitle}</h3>
                  <p>{t.outlineBody}</p>
                  <FeatureFigure
                    image={`feature-outline-${language}.png`}
                    alt={t.outlineCaption}
                    caption={t.outlineCaption}
                  />
                  <a
                    className="text-link"
                    href={assetUrl(`examples/reading-guide-${language}.md`)}
                    download
                  >
                    {t.downloadGuide} <ArrowRight size={15} />
                  </a>
                  <UsageNote label={t.noteLabel}>{t.outlineNote}</UsageNote>
                </div>
              )}
              {'groups' in section && (
                <div className="feature-requirements">
                  {section.groups.map((group) => (
                    <div key={group.title}>
                      <h3>{group.title}</h3>
                      <ul>
                        {group.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {section.id === 'visuals' && (
                <>
                  <div className="feature-table">
                    <table>
                      <caption>{t.sections[1].name}</caption>
                      <thead>
                        <tr>
                          {t.table.map((title) => (
                            <th key={title} scope="col">
                              {title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {frameworks.map(([name, fence, website], index) => (
                          <tr key={name}>
                            <th scope="row">
                              <code>{fence}</code>
                            </th>
                            <td>{t.kinds[index]}</td>
                            <td>
                              <a href={website} target="_blank" rel="noopener noreferrer">
                                {name} <ExternalLink size={12} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="feature-example">
                    <h3>{t.example}</h3>
                    <p className="example-label">{t.sourceLabel}</p>
                    <pre>
                      <code>{t.code}</code>
                    </pre>
                    <div className="example-result">
                      <p className="example-label">{t.resultLabel}</p>
                      <img
                        src={assetUrl(`images/example-flow-${language}.png`)}
                        alt={t.resultAlt}
                        width={language === 'zh' ? 550 : 640}
                        height={71}
                        loading="lazy"
                      />
                    </div>
                    <a
                      className="text-link"
                      href={assetUrl(`examples/reading-flow-${language}.md`)}
                      download
                    >
                      {t.downloadExample} <ArrowRight size={15} />
                    </a>
                  </div>
                </>
              )}
              {'note' in section && <UsageNote label={t.noteLabel}>{section.note}</UsageNote>}
            </section>
          ))}
          <a
            className="text-link"
            href={`https://github.com/def-peter/fuxian/blob/main/README${language === 'zh' ? '.zh-CN' : ''}.md`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.source} <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

function FeatureFigure({ image, alt, caption }: { image: string; alt: string; caption: string }) {
  return (
    <figure className="feature-figure">
      <img src={assetUrl(`images/${image}`)} alt={alt} width={1440} height={960} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function UsageNote({ label, children }: { label: string; children: string }) {
  return (
    <aside className="feature-note" aria-label={label}>
      <strong>{label}</strong>
      <p>{children}</p>
    </aside>
  );
}

const galleryImages = ['mermaid', 'plantuml', 'visualization', 'infographic'] as const;

function VisualGallery({ language }: { language: Language }) {
  const [selected, setSelected] = useState(0);
  const t = content[language];
  const select = (index: number, focus = false) => {
    setSelected(index);
    if (focus) document.getElementById(`feature-visual-tab-${index}`)?.focus();
  };
  return (
    <div className="feature-gallery">
      <div className="feature-visual-tabs" role="tablist" aria-label={t.galleryLabel}>
        {frameworks.map(([name], index) => (
          <button
            key={name}
            id={`feature-visual-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={selected === index}
            aria-controls={`feature-visual-panel-${index}`}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => select(index)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === 'ArrowRight') next = (index + 1) % frameworks.length;
              else if (event.key === 'ArrowLeft')
                next = (index + frameworks.length - 1) % frameworks.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = frameworks.length - 1;
              else return;
              event.preventDefault();
              select(next, true);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="feature-gallery-panels">
        {frameworks.map(([name], index) => (
          <figure
            key={name}
            id={`feature-visual-panel-${index}`}
            role="tabpanel"
            aria-labelledby={`feature-visual-tab-${index}`}
            aria-hidden={selected !== index}
            tabIndex={selected === index ? 0 : -1}
            className={
              selected === index ? 'feature-gallery-panel is-active' : 'feature-gallery-panel'
            }
          >
            <img
              src={assetUrl(`images/${galleryImages[index]}${language === 'en' ? '-en' : ''}.png`)}
              alt={t.galleryCaptions[index]}
              width={1868}
              height={1050}
              loading="lazy"
            />
            <figcaption>{t.galleryCaptions[index]}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
