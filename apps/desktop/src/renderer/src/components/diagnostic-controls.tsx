import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useLocalization } from '@/localization-context';

export function DiagnosticControls(): React.JSX.Element {
  const { t } = useLocalization();
  const [busy, setBusy] = useState<'export' | 'clear'>();
  const [result, setResult] = useState<'exported' | 'cleared' | 'failed'>();
  const perform = async (action: 'export' | 'clear'): Promise<void> => {
    if (busy) return;
    setBusy(action);
    setResult(undefined);
    try {
      const outcome = await (action === 'export'
        ? window.fuxian.exportDiagnostics()
        : window.fuxian.clearDiagnostics());
      if (outcome.status === 'completed') setResult(action === 'export' ? 'exported' : 'cleared');
      if (outcome.status === 'failed') setResult('failed');
    } catch {
      setResult('failed');
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <section aria-labelledby="diagnostics-title" className="flex flex-col gap-3">
      <h3 id="diagnostics-title" className="text-sm font-medium">
        {t('诊断日志')}
      </h3>
      <p className="text-sm text-fg-secondary">
        {t('本机保留最近 7 天、最多 10 MB。不记录正文和文件名，路径匿名化，不会自动上传。')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={Boolean(busy)}
          onClick={() => void perform('export')}
          size="sm"
          variant="outline"
        >
          {busy === 'export' ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          {t('导出诊断日志')}
        </Button>
        <Button
          disabled={Boolean(busy)}
          onClick={() => void perform('clear')}
          size="sm"
          variant="ghost"
        >
          {busy === 'clear' ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Trash2 data-icon="inline-start" />
          )}
          {t('清理日志')}
        </Button>
      </div>
      <div aria-live="polite">
        {result === 'failed' ? (
          <Alert variant="destructive">
            <AlertTitle>{t('无法处理诊断日志')}</AlertTitle>
            <AlertDescription>{t('请检查保存位置和磁盘空间，然后重试。')}</AlertDescription>
          </Alert>
        ) : result ? (
          <p className="text-sm text-fg-secondary">
            {result === 'exported'
              ? t('日志已导出，你可以在反馈问题时附上此文件。')
              : t('历史日志已清理，文档和查看记录不受影响。')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
