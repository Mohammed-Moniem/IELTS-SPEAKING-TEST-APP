const DEFAULT_SITE_URL = 'https://spokio.app';

function normalizeSiteUrl(value: string): string {
  if (!value.trim()) {
    return DEFAULT_SITE_URL;
  }

  const withProtocol = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;

  try {
    const normalized = new URL(withProtocol);
    return normalized.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const siteConfig = {
  name: 'Spokio',
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL)
} as const;

