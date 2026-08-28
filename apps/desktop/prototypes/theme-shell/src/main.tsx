import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Search,
  Settings,
} from 'lucide-react';
import logo from '../../../src/renderer/src/assets/fuxian-lockup-zh-CN.png';
import './styles.css';

// Four token-only variants of the existing reader shell, switchable via ?variant=A|B|C|D.
const variants = {
  A: {
    name: '当前基线',
    note: '矿物绿',
    tokens: {
      accent: '#25684f',
      border: '#d5dcda',
      error: '#a74d44',
      focus: '#4b856e',
      foreground: '#29302f',
      hover: '#e4ebe8',
      muted: '#66716e',
      panel: '#eef1f4',
      paper: '#fcfdfd',
      primary: '#25684f',
      primaryForeground: '#ffffff',
      selected: '#d2e4dc',
      selectedForeground: '#245d47',
      shell: '#edf0f2',
      success: '#317558',
      toolbar: '#f8fafb',
      warning: '#9b6b24',
    },
  },
  B: {
    name: '冷灰中性',
    note: '#F2F5F7',
    tokens: {
      accent: '#343a40',
      border: '#d6dce1',
      error: '#a8453d',
      focus: '#5b6672',
      foreground: '#25292d',
      hover: '#e7ebee',
      muted: '#6a737c',
      panel: '#f2f5f7',
      paper: '#ffffff',
      primary: '#292d32',
      primaryForeground: '#ffffff',
      selected: '#e0e5e9',
      selectedForeground: '#25292d',
      shell: '#e9edf0',
      success: '#59645f',
      toolbar: '#f9fafb',
      warning: '#727b83',
    },
  },
  C: {
    name: '分层灰阶',
    note: '强化层级',
    tokens: {
      accent: '#25292c',
      border: '#c8cfd4',
      error: '#9f4740',
      focus: '#666f76',
      foreground: '#1f2326',
      hover: '#dfe4e7',
      muted: '#5e666d',
      panel: '#f0f2f4',
      paper: '#ffffff',
      primary: '#222629',
      primaryForeground: '#ffffff',
      selected: '#d4d9de',
      selectedForeground: '#171a1d',
      shell: '#e3e7ea',
      success: '#545e59',
      toolbar: '#fafafa',
      warning: '#6f767c',
    },
  },
  D: {
    name: '中性 + 语义色',
    note: '推荐',
    tokens: {
      accent: '#30363b',
      border: '#d3d9de',
      error: '#b34a42',
      focus: '#4b6f8c',
      foreground: '#24282b',
      hover: '#e8ecef',
      muted: '#687078',
      panel: '#f2f5f7',
      paper: '#ffffff',
      primary: '#272b2e',
      primaryForeground: '#ffffff',
      selected: '#e0e5e9',
      selectedForeground: '#24282b',
      shell: '#e8ecef',
      success: '#39755e',
      toolbar: '#ffffff',
      warning: '#946823',
    },
  },
} as const;

type VariantKey = keyof typeof variants;

const variantKeys = Object.keys(variants) as VariantKey[];
const swatchTokens = ['shell', 'panel', 'paper', 'selected', 'primary', 'focus'] as const;

const readVariant = (): VariantKey => {
  const value = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
  return variantKeys.includes(value as VariantKey) ? (value as VariantKey) : 'A';
};

const documents = ['浮现项目设计决策.md', 'PlantUML 导出问题复盘.md', 'Markdown 阅读体验清单.md'];

const outline = ['产品边界', '阅读界面', '图表呈现', '外部更新', 'PDF 交付'];

function IconButton({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}): React.JSX.Element {
  return (
    <button className="icon-button" aria-label={label} title={label} type="button">
      {children}
    </button>
  );
}

function ReaderShell({ variant }: { variant: VariantKey }): React.JSX.Element {
  const palette = variants[variant];
  const style = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(palette.tokens).map(([name, value]) => [`--${name}`, value]),
      ) as React.CSSProperties,
    [palette],
  );

  return (
    <div className="app-shell" style={style} data-variant={variant}>
      <aside className="document-session" aria-label="文档会话">
        <header className="session-header">
          <img src={logo} alt="浮现" />
          <div className="header-actions">
            <IconButton label="折叠文档会话">
              <ChevronsLeft />
            </IconButton>
            <IconButton label="打开 Markdown">
              <FolderOpen />
            </IconButton>
            <IconButton label="设置">
              <Settings />
            </IconButton>
          </div>
        </header>

        <section className="session-group">
          <div className="group-heading">
            <ChevronDown />
            <strong>正在打开</strong>
            <span>3</span>
          </div>
          <div className="document-list">
            {documents.map((document, index) => (
              <button
                aria-current={index === 0 ? 'page' : undefined}
                className="document-item"
                key={document}
                type="button"
              >
                <FileText />
                <span>{document}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="session-group recent-group">
          <div className="group-heading">
            <ChevronDown />
            <strong>最近打开</strong>
            <span>2</span>
          </div>
          <div className="document-list subdued">
            <button className="document-item" type="button">
              <FileText />
              <span>Electron 安全边界.md</span>
            </button>
            <button className="document-item" type="button">
              <FileText />
              <span>完成文档样式规范.md</span>
            </button>
          </div>
        </section>
      </aside>

      <header className="document-toolbar">
        <div className="document-identity">
          <FileText />
          <strong>浮现项目设计决策.md</strong>
          <span className="revision-status">已更新 · 11:32</span>
        </div>
        <div className="toolbar-actions">
          <IconButton label="在源文件位置显示">
            <ExternalLink />
          </IconButton>
          <IconButton label="导出 PDF">
            <Download />
          </IconButton>
          <IconButton label="查找">
            <Search />
          </IconButton>
          <button className="primary-action" type="button">
            <FolderOpen />
            打开其他文档
          </button>
          <IconButton label="折叠内容目录">
            <ChevronsRight />
          </IconButton>
        </div>
      </header>

      <main className="document-stage">
        <article className="finished-document">
          <div className="paper-inner">
            <h1>浮现：完成文档阅读器</h1>
            <p className="lead">
              将 Markdown 源文档呈现为安静、可信、适合阅读与 PDF 交付的完成文档。
            </p>

            <h2>产品边界</h2>
            <p>
              浮现不是编辑器，也不是知识库。它负责处理排版、公式、图表和本地资源，让读者直接面对整理完成的内容。
            </p>
            <blockquote>文档始终是视觉中心，应用外壳只提供导航和文档级命令。</blockquote>

            <h2>阅读界面</h2>
            <p>
              左侧保留正在打开与最近打开的文档，右侧内容目录跟随当前标题。中央白色文档面保持最大视觉权重。
            </p>
            <pre>
              <code>{`\`\`\`mermaid\ngraph LR\n  Source --> FinishedDocument\n\`\`\``}</code>
            </pre>
          </div>
        </article>
      </main>

      <aside className="content-outline" aria-label="内容目录">
        <header>
          <strong>内容目录</strong>
        </header>
        <nav>
          <button className="outline-root" type="button">
            浮现：完成文档阅读器
          </button>
          {outline.map((item, index) => (
            <button className={index === 0 ? 'active' : ''} key={item} type="button">
              {item}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}

function PrototypeSwitcher({
  current,
  onChange,
}: {
  current: VariantKey;
  onChange: (variant: VariantKey) => void;
}): React.JSX.Element {
  const currentIndex = variantKeys.indexOf(current);
  const cycle = (offset: number): void => {
    const next = variantKeys[(currentIndex + offset + variantKeys.length) % variantKeys.length];
    if (next) onChange(next);
  };

  return (
    <div className="prototype-switcher" role="toolbar" aria-label="配色原型切换">
      <button aria-label="上一套配色" onClick={() => cycle(-1)} title="上一套配色" type="button">
        <ChevronLeft />
      </button>
      <div className="variant-state">
        <span className="variant-label">
          {current} · {variants[current].name}
        </span>
        <span className="variant-note">{variants[current].note}</span>
      </div>
      <div className="swatches" aria-hidden="true">
        {swatchTokens.map((token) => (
          <span key={token} style={{ background: variants[current].tokens[token] }} />
        ))}
      </div>
      <button aria-label="下一套配色" onClick={() => cycle(1)} title="下一套配色" type="button">
        <ChevronRight />
      </button>
    </div>
  );
}

function App(): React.JSX.Element {
  const [variant, setVariant] = useState<VariantKey>(readVariant);

  const updateVariant = (next: VariantKey): void => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState({}, '', url);
    setVariant(next);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = variantKeys.indexOf(variant);
      const offset = event.key === 'ArrowLeft' ? -1 : 1;
      const next = variantKeys[(index + offset + variantKeys.length) % variantKeys.length];
      if (next) updateVariant(next);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [variant]);

  return (
    <>
      <ReaderShell variant={variant} />
      <PrototypeSwitcher current={variant} onChange={updateVariant} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
