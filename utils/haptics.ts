export function triggerHaptic(type: 'light' | 'medium' | 'success' = 'light'): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'light') navigator.vibrate(10);
      else if (type === 'medium') navigator.vibrate(20);
      else navigator.vibrate([12, 30, 18]);
    }
  } catch {
    // Ignore on platforms where vibrate is unsupported
  }
}
