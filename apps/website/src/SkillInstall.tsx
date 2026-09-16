import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';

import { trackWebsiteEvent, websiteEvents } from './analytics';
import type { Language } from './site';

const installCommand = 'npx skills add def-peter/fuxian --skill fuxian-diagram';

const copy = {
  zh: {
    label: '安装 fuxian-diagram',
    copy: '复制安装命令',
    copied: '已复制',
    guide: '查看完整 Skill 指南',
    guideUrl: 'https://github.com/def-peter/fuxian/blob/main/skills/fuxian-diagram/README.zh-CN.md',
  },
  en: {
    label: 'Install fuxian-diagram',
    copy: 'Copy install command',
    copied: 'Copied',
    guide: 'Read the full skill guide',
    guideUrl: 'https://github.com/def-peter/fuxian/blob/main/skills/fuxian-diagram/README.md',
  },
} as const;

export function SkillInstall({ language }: { language: Language }) {
  const [copied, setCopied] = useState(false);
  const t = copy[language];

  const copyCommand = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(installCommand);
    trackWebsiteEvent(websiteEvents.skillInstallCopy);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };

  return (
    <div className="skill-install">
      <p>{t.label}</p>
      <div className="skill-command">
        <code>{installCommand}</code>
        <button type="button" onClick={copyCommand} aria-label={t.copy}>
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          <span>{copied ? t.copied : t.copy}</span>
        </button>
      </div>
      <a href={t.guideUrl} target="_blank" rel="noopener noreferrer">
        {t.guide} <ExternalLink size={13} aria-hidden="true" />
      </a>
    </div>
  );
}
