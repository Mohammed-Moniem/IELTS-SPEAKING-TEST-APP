import Image from 'next/image';

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = 'w-[148px]', priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/brand/spokio-logo-full.png"
      alt="Spokio"
      width={1128}
      height={430}
      priority={priority}
      className={`h-auto ${className}`}
    />
  );
}
