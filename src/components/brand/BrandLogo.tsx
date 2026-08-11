import Image from 'next/image';
import { cn } from '@/lib/cn';

export function BrandLogo({
  size = 64,
  alt = 'Rajaklana KPI Kasir',
  priority = false,
  className,
}: {
  size?: number;
  alt?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn('object-contain', className)}
    />
  );
}
