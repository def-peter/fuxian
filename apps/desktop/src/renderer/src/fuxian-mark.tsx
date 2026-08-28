import type { ImgHTMLAttributes } from 'react';
import fuxianAppIconUrl from '@/assets/fuxian-app-icon.png?url';
import fuxianLockupEnUsUrl from '@/assets/fuxian-lockup-en-US.png?url';
import fuxianLockupZhCnUrl from '@/assets/fuxian-lockup-zh-CN.png?url';
import { cn } from '@/lib/utils';

interface FuxianImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src'> {
  decorative?: boolean;
  label?: string;
}

export type FuxianLockupLocale = 'en-US' | 'zh-CN';

interface FuxianLockupProps extends FuxianImageProps {
  locale?: FuxianLockupLocale;
}

const fuxianLockupUrls: Record<FuxianLockupLocale, string> = {
  'en-US': fuxianLockupEnUsUrl,
  'zh-CN': fuxianLockupZhCnUrl,
};

export function FuxianMark({
  className,
  decorative = true,
  label = '浮现',
  ...props
}: FuxianImageProps): React.JSX.Element {
  return (
    <img
      alt={decorative ? '' : label}
      aria-hidden={decorative || undefined}
      className={cn('shrink-0', className)}
      draggable={false}
      src={fuxianAppIconUrl}
      {...props}
    />
  );
}

export function FuxianLockup({
  className,
  decorative = true,
  locale = 'zh-CN',
  label = locale === 'zh-CN' ? '浮现' : 'Fuxian',
  ...props
}: FuxianLockupProps): React.JSX.Element {
  return (
    <img
      alt={decorative ? '' : label}
      aria-hidden={decorative || undefined}
      className={cn('shrink-0', className)}
      draggable={false}
      src={fuxianLockupUrls[locale]}
      {...props}
    />
  );
}
