import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useLocalization } from '@/localization-context';

interface UnsavedChangesDialogProps {
  actionDescription: string;
  error?: string;
  name: string;
  onCancel(): void;
  onDiscard(): void;
  onSave(): void;
  open: boolean;
  saving: boolean;
}

export function UnsavedChangesDialog({
  actionDescription,
  error,
  name,
  onCancel,
  onDiscard,
  onSave,
  open,
  saving,
}: UnsavedChangesDialogProps): React.JSX.Element {
  const { t } = useLocalization();
  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && !saving && onCancel()} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('保存对“{name}”的修改？', { name })}</DialogTitle>
          <DialogDescription>
            {t('{action}前需要处理尚未保存的 Markdown 源码。恢复草稿不能代替正式保存。', {
              action: actionDescription,
            })}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p aria-live="assertive" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={saving} onClick={onCancel} variant="outline">
            {t('取消')}
          </Button>
          <Button disabled={saving} onClick={onDiscard} variant="secondary">
            {t('不保存')}
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
            {t('保存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExternalConflictDialogProps {
  error?: string;
  name: string;
  onAdoptDisk(): void;
  onKeepLocal(): void;
  onSaveAs(): void;
  saving: boolean;
}

export function ExternalConflictDialog({
  error,
  name,
  onAdoptDisk,
  onKeepLocal,
  onSaveAs,
  saving,
}: ExternalConflictDialogProps): React.JSX.Element {
  const { t } = useLocalization();
  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle aria-hidden="true" className="size-4" />
            <DialogTitle>{t('“{name}”已在外部修改', { name })}</DialogTitle>
          </div>
          <DialogDescription>
            {t(
              '浮现保留了本地编辑内容和最新磁盘版本。请选择要继续使用的版本，任何内容都不会被静默覆盖。',
            )}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p aria-live="assertive" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="sm:justify-between">
          <Button disabled={saving} onClick={onAdoptDisk} variant="outline">
            {t('采用磁盘版本')}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button disabled={saving} onClick={onSaveAs} variant="secondary">
              {t('另存为')}
            </Button>
            <Button disabled={saving} onClick={onKeepLocal}>
              {saving ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              {t('保留本地修改')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
