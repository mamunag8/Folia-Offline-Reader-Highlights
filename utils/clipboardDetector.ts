import { db } from '../db/database';

export function extractValidUrlFromText(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return null;
  try {
    const u = new URL(match[0]);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
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

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      const url = extractValidUrlFromText(text);
      if (url && !dismissedUrls.has(url) && !db.hasArticleWithUrl(url)) {
        return url;
      }
    }
  } catch {
    // Clipboard permission not granted or unavailable without user gesture
  }
  return null;
}
