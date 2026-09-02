import type { ImgHTMLAttributes } from 'react';
import fuxianAppIconUrl from '@/assets/fuxian-app-icon.png?url';
import fuxianMarkUrl from '@/assets/fuxian-mark.png?url';
import { cn } from '@/lib/utils';

interface FuxianImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src'> {
  decorative?: boolean;
  label?: string;
}

function FuxianImage({
  className,
  decorative = true,
  label = '浮现',
  src,
  ...props
}: FuxianImageProps & { src: string }): React.JSX.Element {
  return (
    <img
      alt={decorative ? '' : label}
      aria-hidden={decorative || undefined}
      className={cn('shrink-0', className)}
      draggable={false}
      src={src}
      {...props}
    />
  );
}

export function FuxianAppIcon(props: FuxianImageProps): React.JSX.Element {
  return <FuxianImage src={fuxianAppIconUrl} {...props} />;
}

export function FuxianMark(props: FuxianImageProps): React.JSX.Element {
  return <FuxianImage src={fuxianMarkUrl} {...props} />;
}
