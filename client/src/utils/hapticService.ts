import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const lastHapticAt = new Map<string, number>();

function canRun(channel: string, minimumGapMs: number): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const now = Date.now();
  const previous = lastHapticAt.get(channel) ?? 0;
  if (now - previous < minimumGapMs) return false;
  lastHapticAt.set(channel, now);
  return true;
}

export function hapticImpact(style: ImpactStyle, channel = 'impact', minimumGapMs = 100): void {
  if (!canRun(channel, minimumGapMs)) return;
  void Haptics.impact({ style }).catch(() => undefined);
}

export function hapticNotification(type: NotificationType, channel = 'notification', minimumGapMs = 500): void {
  if (!canRun(channel, minimumGapMs)) return;
  void Haptics.notification({ type }).catch(() => undefined);
}
