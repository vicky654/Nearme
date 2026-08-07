export const FUNKY_AVATAR_PRESETS = [
  { id: 'fun-emoji', label: 'Funky Emoji', description: '3D expression icons' },
  { id: 'bottts-neutral', label: 'Cyber Robot', description: 'Funky colorful robots' },
  { id: 'adventurer', label: 'Adventure Hero', description: 'RPG character art' },
  { id: 'lorelei', label: 'Lorelei Art', description: 'Sleek illustrated portraits' },
  { id: 'avataaars', label: 'Avataaars', description: 'Modern vector characters' },
  { id: 'micah', label: 'Micah Aesthetic', description: 'Minimalist character art' },
  { id: 'personas', label: 'Vector Personas', description: 'Dynamic vector style' },
  { id: 'big-smile', label: 'Big Smile', description: 'Bright cheerful avatars' },
] as const;

export type FunkyAvatarPresetId = (typeof FUNKY_AVATAR_PRESETS)[number]['id'];

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
  const validStyles = FUNKY_AVATAR_PRESETS.map((p) => p.id);
  const style =
    styleOverride && validStyles.includes(styleOverride as any)
      ? styleOverride
      : validStyles[hashSeed(cleanSeed) % validStyles.length];
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(cleanSeed)}`;
}

export function isLetterOrLegacyAvatar(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase();
  return lower.includes('/initials/') || lower.includes('initials/svg') || lower.trim() === '';
}

export function getValidAvatarUrl(
  avatarUrl?: string | null,
  fallbackSeed: string = 'explorer'
): string {
  if (isLetterOrLegacyAvatar(avatarUrl)) {
    return getFunkyAvatarUrl(fallbackSeed);
  }
  return avatarUrl!;
}
