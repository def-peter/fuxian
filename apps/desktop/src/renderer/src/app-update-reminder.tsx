import { ArrowUpCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLocalization } from '@/localization-context';

interface AppUpdateReminderProps {
  onDismiss(): void;
  onViewUpdate(): void;
  version: string;
}

export function AppUpdateReminder({
  onDismiss,
  onViewUpdate,
  version,
}: AppUpdateReminderProps): React.JSX.Element {
  const { t } = useLocalization();

  return (
    <Alert className="fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] border-line-subtle shadow-lg">
      <ArrowUpCircle aria-hidden="true" className="text-status-update" />
      <AlertTitle>{t('新版本 {version} 可用', { version })}</AlertTitle>
      <AlertDescription>
        <p>{t('更新不会自动下载，你可以在方便时处理。')}</p>
        <div className="mt-2 flex items-center gap-2">
          <Button onClick={onViewUpdate} size="sm">
            {t('查看更新')}
          </Button>
          <Button onClick={onDismiss} size="sm" variant="ghost">
            {t('稍后')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
