import type { ImgHTMLAttributes } from 'react';
import fuxianAppIconUrl from '@/assets/fuxian-app-icon.svg?url';
import { cn } from '@/lib/utils';

interface FuxianMarkProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src'> {
  decorative?: boolean;
  label?: string;
}

export function FuxianMark({
  className,
  decorative = true,
  label = '浮现',
  ...props
}: FuxianMarkProps): React.JSX.Element {
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
