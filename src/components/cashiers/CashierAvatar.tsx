import Image from 'next/image';
import { cn } from '@/lib/utils';

export function initialsOf(name: string): string {
  return (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export function CashierAvatar({
  name,
  src,
  size = 48,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  const textSize = size >= 64 ? 'text-2xl' : size >= 40 ? 'text-lg' : 'text-sm';

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn('shrink-0 rounded-full object-cover', className)}
        style={style}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700',
        textSize,
        className
      )}
      style={style}
    >
      {initialsOf(name)}
    </div>
  );
}