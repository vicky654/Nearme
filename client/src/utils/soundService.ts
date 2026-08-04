let isSoundEnabled = true;

try {
  const saved = localStorage.getItem('nearme_sound_enabled');
  if (saved !== null) {
    isSoundEnabled = JSON.parse(saved);
  }
} catch {
  // Fallback default true
}

export function setSoundEnabled(enabled: boolean) {
  isSoundEnabled = enabled;
  try {
    localStorage.setItem('nearme_sound_enabled', JSON.stringify(enabled));
  } catch {
    // Ignore storage error
  }
}

export function getSoundEnabled(): boolean {
  return isSoundEnabled;
}

export function playNotificationSound(type: 'friend_request' | 'message') {
  if (!isSoundEnabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';

    if (type === 'friend_request') {
      // Pleasant double chime: F5 (698Hz) -> C6 (1046Hz)
      osc.frequency.setValueAtTime(698.46, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      // Soft message pop: A5 (880Hz)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // Gracefully catch audio permission or autoplay restrictions
  }
}
