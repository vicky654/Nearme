export const FUNKY_AVATAR_STYLES = [
  'fun-emoji',
  'bottts-neutral',
  'adventurer',
  'lorelei',
  'avataaars',
  'micah',
  'personas',
  'big-smile',
] as const;

export type FunkyAvatarStyle = (typeof FUNKY_AVATAR_STYLES)[number];

export function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getFunkyAvatarUrl(seed: string, styleOverride?: string): string {
  const cleanSeed = (seed || 'explorer').trim();
  const style =
    styleOverride && FUNKY_AVATAR_STYLES.includes(styleOverride as any)
      ? styleOverride
      : FUNKY_AVATAR_STYLES[hashSeed(cleanSeed) % FUNKY_AVATAR_STYLES.length];
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(cleanSeed)}`;
}

export function isLetterOrLegacyAvatar(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase();
  return lower.includes('/initials/') || lower.includes('initials/svg') || lower.trim() === '';
}

export function getValidAvatarUrl(avatarUrl?: string | null, fallbackSeed: string = 'explorer'): string {
  if (isLetterOrLegacyAvatar(avatarUrl)) {
    return getFunkyAvatarUrl(fallbackSeed);
  }
  return avatarUrl!;
}
