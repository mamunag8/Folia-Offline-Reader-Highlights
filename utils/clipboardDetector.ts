import { db } from '../db/database';

export function extractValidUrlFromText(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  if (match) {
    try {
      const cleaned = match[0].replace(/[.,;!?)]+$/, '');
      const u = new URL(cleaned);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u.toString();
      }
    } catch {
      // fall through
    }
  }

  // Also check if the user copied a bare domain + path like "paulgraham.com/superlinear.html"
  const firstToken = trimmed.split(/\s+/)[0];
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\/[^\s]+$/i.test(firstToken)) {
    try {
      const u = new URL(`https://${firstToken}`);
      return u.toString();
    } catch {
      return null;
    }
  }
  return null;
}

export function extractAllUrlsFromText(raw: string): string[] {
  if (!raw) return [];
  const matches = raw.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  const urls: string[] = [];
  for (const m of matches) {
    try {
      const cleaned = m.replace(/[.,;!?)]+$/, '');
      const u = new URL(cleaned).toString();
      if (!urls.includes(u)) urls.push(u);
    } catch {
      // ignore invalid
    }
  }
  if (urls.length === 0) {
    const single = extractValidUrlFromText(raw);
    if (single) urls.push(single);
  }
  return urls;
}

/**
 * Reads clipboard text using Android Native Bridge first (no permission popup),
 * falling back to Web Clipboard API.
 */
export async function readClipboardTextAny(): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.FoliaNative?.getClipboardText) {
      const nativeClip = window.FoliaNative.getClipboardText();
      if (nativeClip && nativeClip.trim()) {
        return nativeClip.trim();
      }
    }
  } catch {
    // fallback to navigator.clipboard
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const webClip = await navigator.clipboard.readText();
      if (webClip && webClip.trim()) {
        return webClip.trim();
      }
    }
  } catch {
    // Clipboard permission denied or unavailable
  }
  return '';
}

/**
 * Algorithm B: Smart Clipboard & Share Sheet URL Detector
 * Checks clipboard when app opens or returns to foreground.
 */
export async function checkClipboardForNewUrl(
  dismissedUrls: Set<string>
): Promise<string | null> {
  const settings = db.getSettings();
  if (!settings.auto_clipboard_prompt) return null;

  const text = await readClipboardTextAny();
  const url = extractValidUrlFromText(text);
  if (url && !dismissedUrls.has(url) && !db.hasArticleWithUrl(url)) {
    return url;
  }
  return null;
}
