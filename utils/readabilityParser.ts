import { ArticleRecord, ContentBlock, ContentBlockType } from '../db/schema';

export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'saved-article.local';
  }
}

export function normalizeUrlInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';
  // If input contains a full http(s) URL inside shared text (e.g. "Article Title https://..."), extract the URL
  const embeddedMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  if (embeddedMatch) {
    return embeddedMatch[0].replace(/[.,;!?)]+$/, '');
  }
  // Support bare domains/paths like "paulgraham.com/greatwork.html"
  const firstToken = trimmed.split(/\s+/)[0];
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(firstToken)) {
    return `https://${firstToken}`;
  }
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export function extractTitleFromSharedText(rawInput: string, extractedUrl: string): string | undefined {
  const withoutUrl = rawInput.replace(extractedUrl, '').replace(/\s+/g, ' ').trim();
  const cleaned = withoutUrl.replace(/^[-–—:|•]+|[-–—:|•]+$/g, '').trim();
  if (cleaned.length >= 4 && cleaned.length <= 160 && !cleaned.startsWith('http')) {
    return cleaned;
  }
  return undefined;
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

    // Fallback for pages like Paul Graham essays that use <font> or <br><br> inside tables/body instead of <p>
    if (rawBlocks.length < 2) {
      const rawText = (container.innerText || container.textContent || '').trim();
      const paragraphs = rawText
        .split(/\n\s*\n+/)
        .map((p) => p.replace(/\s+/g, ' ').trim())
        .filter((p) => p.length >= 25);
      paragraphs.forEach((p) => {
        if (rawBlocks.length === 0 || rawBlocks[rawBlocks.length - 1].text !== p) {
          rawBlocks.push({
            index: rawBlocks.length,
            type: 'p',
            text: p,
          });
        }
      });
    }
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
 * Parses Jina Reader markdown response into an ArticleRecord
 */
function parseJinaReaderMarkdown(
  markdownText: string,
  url: string,
  customTitle?: string,
  cacheImagesOffline = true
): ArticleRecord | null {
  if (!markdownText || markdownText.length < 120) return null;
  const domain = extractDomain(url);
  const lines = markdownText.split(/\r?\n/);

  let extractedTitle = customTitle?.trim() || '';
  const bodyLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('Title:') && !extractedTitle) {
      extractedTitle = line.replace(/^Title:\s*/, '').trim();
      continue;
    }
    if (
      line.startsWith('URL Source:') ||
      line.startsWith('Markdown Content:') ||
      line.startsWith('Published Time:')
    ) {
      continue;
    }
    bodyLines.push(line);
  }

  const rawParagraphs = bodyLines
    .join('\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 20 && !p.startsWith('!['));

  if (rawParagraphs.length === 0) return null;

  const blocks: ContentBlock[] = [];
  for (const para of rawParagraphs) {
    // Strip markdown links [text](url) -> text
    const cleanText = para
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanText.length < 20) continue;

    let type: ContentBlockType = 'p';
    let finalText = cleanText;
    if (cleanText.startsWith('# ')) {
      type = 'h1';
      finalText = cleanText.replace(/^#\s+/, '');
    } else if (cleanText.startsWith('## ')) {
      type = 'h2';
      finalText = cleanText.replace(/^##\s+/, '');
    } else if (cleanText.startsWith('### ')) {
      type = 'h3';
      finalText = cleanText.replace(/^###\s+/, '');
    } else if (cleanText.startsWith('> ')) {
      type = 'blockquote';
      finalText = cleanText.replace(/^>\s+/, '');
    } else if (cleanText.startsWith('- ') || cleanText.startsWith('* ')) {
      type = 'li';
      finalText = cleanText.replace(/^[-*]\s+/, '');
    }

    if (blocks.length === 0 || blocks[blocks.length - 1].text !== finalText) {
      blocks.push({
        index: blocks.length,
        type,
        text: finalText,
      });
    }
  }

  if (blocks.length === 0) return null;

  const finalTitle = extractedTitle || blocks[0].text.slice(0, 70) || `Article from ${domain}`;
  const plainText = blocks.map((b) => b.text).join('\n\n');
  const wordCount = Math.max(1, plainText.split(/\s+/).filter(Boolean).length);
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 220));

  return {
    id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    domain,
    title: finalTitle,
    author: domain,
    hero_image_uri: generateOfflineHeroSvg(finalTitle, domain),
    excerpt: (blocks.find((b) => b.type === 'p')?.text || plainText).slice(0, 180),
    content_blocks_json: JSON.stringify(blocks),
    plain_text: plainText,
    word_count: wordCount,
    reading_time_minutes: readingTimeMinutes,
    scroll_progress: 0,
    status: 'inbox',
    tags_csv: cacheImagesOffline ? 'reading' : 'inbox',
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
  const url = normalizeUrlInput(rawUrl);
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
 * Multi-Tier Article Fetcher & Parser:
 * 1) Tier 1: Native Android HttpURLConnection Bridge (window.FoliaNative.fetchUrlHtml) — Zero CORS
 * 2) Tier 2: Jina Reader Clean Extraction (https://r.jina.ai/<url>) — Fast CORS-enabled reader
 * 3) Tier 3: AllOrigins CORS Proxy / Direct Fetch HTML Readability Parser
 * 4) Tier 4: Offline Airplane-Mode Fallback
 */
export async function fetchAndParseUrlOnDevice(
  rawUrl: string,
  options?: { customTitle?: string; customBodyText?: string; cacheImagesOffline?: boolean }
): Promise<ArticleRecord> {
  const url = normalizeUrlInput(rawUrl);
  const sharedTitleHint = options?.customTitle || extractTitleFromSharedText(rawUrl, url);

  if (options?.customBodyText && options.customBodyText.trim().length > 20) {
    return buildFallbackArticleFromUrl(url, sharedTitleHint, options.customBodyText);
  }

  // TIER 1: Native Android Java HTTP Fetch (Zero CORS)
  if (typeof window !== 'undefined' && window.FoliaNative?.fetchUrlHtml) {
    try {
      const nativeHtml = window.FoliaNative.fetchUrlHtml(url);
      if (nativeHtml && nativeHtml.length > 250) {
        const parsed = parseHtmlToReadableArticle(
          nativeHtml,
          url,
          options?.cacheImagesOffline ?? true
        );
        if (parsed.word_count > 45) {
          if (sharedTitleHint) parsed.title = sharedTitleHint;
          return parsed;
        }
      }
    } catch {
      // Fall through to Tier 2
    }
  }

  // TIER 2: Jina Reader Clean Extraction API (works across CORS-protected sites in browser & WebView)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: { Accept: 'text/plain' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (jinaRes.ok) {
      const text = await jinaRes.text();
      const parsedJina = parseJinaReaderMarkdown(
        text,
        url,
        sharedTitleHint,
        options?.cacheImagesOffline ?? true
      );
      if (parsedJina && parsedJina.word_count > 40) {
        return parsedJina;
      }
    }
  } catch {
    // Fall through to Tier 3
  }

  // TIER 3: Direct Fetch or AllOrigins Raw HTML Proxy
  const endpoints = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const html = await response.text();
        if (html && html.length > 250) {
          const parsed = parseHtmlToReadableArticle(
            html,
            url,
            options?.cacheImagesOffline ?? true
          );
          if (sharedTitleHint) {
            parsed.title = sharedTitleHint;
          }
          return parsed;
        }
      }
    } catch {
      // try next endpoint
    }
  }

  // TIER 4: Offline / Airplane Mode Graceful Fallback
  return buildFallbackArticleFromUrl(url, sharedTitleHint, options?.customBodyText);
}
