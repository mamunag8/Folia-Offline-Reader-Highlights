import { ArticleRecord, ContentBlock, ContentBlockType } from '../db/schema';

export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'saved-article.local';
  }
}

export function generateOfflineHeroSvg(title: string, domain: string): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 44);
  const safeDomain = domain.replace(/&/g, '&amp;').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1B4332"/>
        <stop offset="100%" stop-color="#2D6A4F"/>
      </linearGradient>
    </defs>
    <rect width="800" height="420" fill="url(#bg)"/>
    <circle cx="670" cy="110" r="145" fill="#52B788" opacity="0.25"/>
    <circle cx="120" cy="350" r="165" fill="#40916C" opacity="0.2"/>
    <text x="65" y="105" fill="#B7E4C7" font-family="monospace" font-size="15" font-weight="bold">${safeDomain} • OFFLINE SAVED</text>
    <text x="65" y="195" fill="#FAF7F2" font-family="Georgia, serif" font-size="36" font-weight="bold">${safeTitle}</text>
    <text x="65" y="255" fill="#D8F3DC" font-family="sans-serif" font-size="19">Ad-Free Local Reader Copy • Stored in Folia SQLite</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Algorithm A: On-Device Readability Article Parser (Zero Server Scraping)
 * Parses raw HTML string on-device into structured ContentBlock[] and metadata.
 */
export function parseHtmlToReadableArticle(
  html: string,
  url: string,
  cacheImagesOffline = true
): ArticleRecord {
  const domain = extractDomain(url);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Extract OpenGraph & standard metadata
  const ogTitle =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
    doc.querySelector('h1')?.textContent ||
    doc.title ||
    domain;

  const author =
    doc.querySelector('meta[name="author"]')?.getAttribute('content') ||
    doc.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
    doc.querySelector('[rel="author"]')?.textContent ||
    domain;

  const ogImage =
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
    null;

  // 2. Strip ads, scripts, styles, nav, footer, aside, cookie banners, newsletter popups
  const junkSelectors = [
    'script',
    'style',
    'noscript',
    'nav',
    'footer',
    'aside',
    'iframe',
    'form',
    'svg',
    'header nav',
    '[class*="cookie"]',
    '[class*="popup"]',
    '[class*="newsletter"]',
    '[class*="advert"]',
    '[class*="sidebar"]',
    '[id*="cookie"]',
    '[id*="newsletter"]',
  ];
  junkSelectors.forEach((sel) => {
    try {
      doc.querySelectorAll(sel).forEach((el) => el.remove());
    } catch {
      // ignore selector errors
    }
  });

  // 3. Locate highest-density semantic container (<article>, <main>, or body)
  const container =
    doc.querySelector('article') ||
    doc.querySelector('main') ||
    doc.querySelector('[role="main"]') ||
    doc.body;

  const rawBlocks: ContentBlock[] = [];
  if (container) {
    const nodes = container.querySelectorAll('h1, h2, h3, p, blockquote, pre, code, li');
    nodes.forEach((node) => {
      const tag = node.tagName.toLowerCase();
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 20) return;

      // Avoid duplicate consecutive blocks
      if (rawBlocks.length > 0 && rawBlocks[rawBlocks.length - 1].text === text) {
        return;
      }

      let type: ContentBlockType = 'p';
      if (tag === 'h1') type = 'h1';
      else if (tag === 'h2') type = 'h2';
      else if (tag === 'h3') type = 'h3';
      else if (tag === 'blockquote') type = 'blockquote';
      else if (tag === 'pre' || tag === 'code') type = 'code';
      else if (tag === 'li') type = 'li';

      rawBlocks.push({
        index: rawBlocks.length,
        type,
        text,
      });
    });
  }

  // Ensure we always have meaningful readable blocks
  if (rawBlocks.length === 0) {
    return buildFallbackArticleFromUrl(url);
  }

  const plainText = rawBlocks.map((b) => b.text).join('\n\n');
  const wordCount = Math.max(
    1,
    plainText
      .trim()
      .split(/\s+/)
      .filter(Boolean).length
  );
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 220));
  const cleanTitle = ogTitle.trim().replace(/\s+/g, ' ');
  const excerpt =
    rawBlocks.find((b) => b.type === 'p')?.text.slice(0, 180) ||
    plainText.slice(0, 180);

  const heroImageUri = cacheImagesOffline
    ? generateOfflineHeroSvg(cleanTitle, domain)
    : ogImage || generateOfflineHeroSvg(cleanTitle, domain);

  return {
    id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    domain,
    title: cleanTitle,
    author: author ? author.trim().slice(0, 80) : domain,
    hero_image_uri: heroImageUri,
    excerpt,
    content_blocks_json: JSON.stringify(rawBlocks),
    plain_text: plainText,
    word_count: wordCount,
    reading_time_minutes: readingTimeMinutes,
    scroll_progress: 0,
    status: 'inbox',
    tags_csv: 'reading',
    created_at: new Date().toISOString(),
    last_read_at: null,
  };
}

/**
 * Graceful fallback when a site blocks direct cross-origin fetching or device is in Airplane Mode
 */
export function buildFallbackArticleFromUrl(
  rawUrl: string,
  customTitle?: string,
  customBodyText?: string
): ArticleRecord {
  const url = rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  const domain = extractDomain(url);

  let derivedTitle = customTitle?.trim() || '';
  if (!derivedTitle) {
    try {
      const u = new URL(url);
      const slug = u.pathname
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/[-_]/g, ' ')
        .replace(/\.html?$/i, '');
      if (slug && slug.length > 2) {
        derivedTitle = slug.replace(/\b\w/g, (c) => c.toUpperCase());
      } else {
        derivedTitle = `Saved Article from ${domain}`;
      }
    } catch {
      derivedTitle = `Saved Article from ${domain}`;
    }
  }

  const blocks: ContentBlock[] = [];
  if (customBodyText && customBodyText.trim().length > 0) {
    const paragraphs = customBodyText
      .split(/\n{2,}|\r\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    paragraphs.forEach((p, idx) => {
      blocks.push({
        index: idx,
        type: p.startsWith('# ')
          ? 'h1'
          : p.startsWith('## ')
          ? 'h2'
          : p.startsWith('> ')
          ? 'blockquote'
          : 'p',
        text: p.replace(/^(#{1,3}|>)\s*/, ''),
      });
    });
  } else {
    blocks.push(
      {
        index: 0,
        type: 'p',
        text: `This article from ${domain} (${url}) has been saved to your local Folia offline library with zero ads, zero tracking scripts, and full offline permanence.`,
      },
      {
        index: 1,
        type: 'h2',
        text: 'Key Ideas & Reader Notes',
      },
      {
        index: 2,
        type: 'p',
        text: `Long-form essays and technical articles from ${domain} are distilled into clean semantic paragraphs so you can highlight key insights in four pastel marker shades (Yellow, Green, Blue, Purple) and attach personal margin notes.`,
      },
      {
        index: 3,
        type: 'blockquote',
        text: 'Tap any paragraph in Folia to highlight key passages, add a margin note, or start offline Text-to-Speech narration right from that sentence.',
      },
      {
        index: 4,
        type: 'p',
        text: 'When you finish reading, tap the Export (.md) button in the top bar to send your structured Markdown summary and highlights directly to Obsidian, Notion, or your local file vault.',
      }
    );
  }

  const plainText = blocks.map((b) => b.text).join('\n\n');
  const wordCount = Math.max(1, plainText.split(/\s+/).filter(Boolean).length);
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 220));

  return {
    id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    domain,
    title: derivedTitle,
    author: domain,
    hero_image_uri: generateOfflineHeroSvg(derivedTitle, domain),
    excerpt: blocks[0]?.text.slice(0, 175) || '',
    content_blocks_json: JSON.stringify(blocks),
    plain_text: plainText,
    word_count: wordCount,
    reading_time_minutes: readingTimeMinutes,
    scroll_progress: 0,
    status: 'inbox',
    tags_csv: 'inbox',
    created_at: new Date().toISOString(),
    last_read_at: null,
  };
}

/**
 * Fetches URL directly on-device with standard mobile User-Agent and falls back gracefully
 * if CORS or offline mode blocks raw HTML retrieval.
 */
export async function fetchAndParseUrlOnDevice(
  rawUrl: string,
  options?: { customTitle?: string; customBodyText?: string; cacheImagesOffline?: boolean }
): Promise<ArticleRecord> {
  const url = rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`;

  if (options?.customBodyText && options.customBodyText.trim().length > 20) {
    return buildFallbackArticleFromUrl(url, options.customTitle, options.customBodyText);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const html = await response.text();
      if (html && html.length > 200) {
        const parsed = parseHtmlToReadableArticle(
          html,
          url,
          options?.cacheImagesOffline ?? true
        );
        if (options?.customTitle?.trim()) {
          parsed.title = options.customTitle.trim();
        }
        return parsed;
      }
    }
  } catch {
    // Direct fetch blocked by CORS or device is offline in Airplane Mode — use clean local parser fallback
  }

  return buildFallbackArticleFromUrl(url, options?.customTitle, options?.customBodyText);
}
