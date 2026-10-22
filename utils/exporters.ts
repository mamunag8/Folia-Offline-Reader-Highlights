import { ArticleRecord, HighlightRecord } from '../db/schema';
import { db } from '../db/database';
import { buildFallbackArticleFromUrl } from './readabilityParser';

/**
 * Algorithm E: 1-Tap Obsidian / Notion Markdown Exporter & Competitor Importer
 */
export function formatArticleMarkdown(
  article: ArticleRecord,
  highlights: HighlightRecord[]
): string {
  const savedDate = new Date(article.created_at).toISOString().split('T')[0];
  const lines: string[] = [
    `# ${article.title}`,
    `- **Source:** [${article.domain}](${article.url})`,
    `- **Author:** ${article.author || article.domain}`,
    `- **Saved Date:** ${savedDate}`,
  ];

  if (article.tags_csv) {
    const formattedTags = article.tags_csv
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `#${t}`)
      .join(' ');
    if (formattedTags) {
      lines.push(`- **Tags:** ${formattedTags}`);
    }
  }

  lines.push('');
  lines.push('## ✨ Highlights & Notes');

  if (highlights.length === 0) {
    lines.push('_No highlights recorded for this article yet._');
  } else {
    highlights.forEach((hl) => {
      lines.push(`> "${hl.highlighted_text}"`);
      if (hl.note && hl.note.trim()) {
        lines.push(`*— Note: ${hl.note.trim()}*`);
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

export function formatAllHighlightsMarkdown(
  articles: ArticleRecord[],
  highlights: HighlightRecord[]
): string {
  const header = [
    '# Folia — Second Brain Highlights & Margin Notes',
    `- **Exported Date:** ${new Date().toISOString().split('T')[0]}`,
    `- **Total Highlights:** ${highlights.length}`,
    '',
    '---',
    '',
  ];

  const byArticle = new Map<string, HighlightRecord[]>();
  highlights.forEach((h) => {
    const list = byArticle.get(h.article_id) || [];
    list.push(h);
    byArticle.set(h.article_id, list);
  });

  const sections: string[] = [];
  articles.forEach((art) => {
    const artHighlights = byArticle.get(art.id);
    if (!artHighlights || artHighlights.length === 0) return;
    sections.push(formatArticleMarkdown(art, artHighlights));
    sections.push('\n---\n');
  });

  return [...header, ...sections].join('\n');
}

export async function shareOrDownloadFile(
  filename: string,
  content: string,
  mimeType = 'text/markdown;charset=utf-8'
): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      const file = new File([content], filename, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: filename,
          text: content,
          files: [file],
        });
        return;
      }
    }
  } catch {
    // Fall back to direct file download
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportFullLibraryJson(): string {
  const payload = {
    app: 'Folia: Offline Reader & Highlights',
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    settings: db.getSettings(),
    tags: db.getAllTags(),
    articles: db.getAllArticles(),
    highlights: db.getAllHighlights(),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Competitor Importer: Supports Folia JSON Backup, Pocket HTML Export, and Instapaper CSV Export
 */
export function importBackupOrCompetitorFile(
  filename: string,
  rawContent: string
): { importedArticles: number; importedHighlights: number; sourceFormat: string } {
  const lower = filename.toLowerCase();

  // 1. Folia JSON Backup
  if (lower.endsWith('.json') || rawContent.trim().startsWith('{')) {
    const data = JSON.parse(rawContent);
    let artCount = 0;
    let hlCount = 0;

    if (Array.isArray(data.articles)) {
      data.articles.forEach((art: ArticleRecord) => {
        if (art && art.url && art.title) {
          db.upsertArticle(art);
          artCount += 1;
        }
      });
    }
    if (Array.isArray(data.highlights)) {
      data.highlights.forEach((hl: HighlightRecord) => {
        if (hl && hl.article_id && hl.highlighted_text) {
          db.upsertHighlight({
            article_id: hl.article_id,
            block_index: hl.block_index || 0,
            highlighted_text: hl.highlighted_text,
            color: hl.color || 'yellow',
            note: hl.note || null,
          });
          hlCount += 1;
        }
      });
    }
    return {
      importedArticles: artCount,
      importedHighlights: hlCount,
      sourceFormat: 'Folia JSON Backup',
    };
  }

  // 2. Pocket HTML Export (<a href="https://..." tags="...">Title</a>)
  if (lower.endsWith('.html') || lower.endsWith('.htm') || rawContent.includes('<a ')) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawContent, 'text/html');
    const links = Array.from(doc.querySelectorAll('a[href^="http"]'));
    let count = 0;
    links.slice(0, 100).forEach((a) => {
      const href = a.getAttribute('href');
      const title = (a.textContent || '').trim();
      const tagsAttr = a.getAttribute('tags') || 'pocket-import';
      if (href && !db.hasArticleWithUrl(href)) {
        const art = buildFallbackArticleFromUrl(href, title || undefined);
        art.tags_csv = tagsAttr;
        db.upsertArticle(art);
        count += 1;
      }
    });
    return {
      importedArticles: count,
      importedHighlights: 0,
      sourceFormat: 'Pocket HTML Export',
    };
  }

  // 3. Instapaper CSV Export (URL,Title,Selection,Folder,Timestamp)
  const lines = rawContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let csvCount = 0;
  lines.forEach((line, idx) => {
    if (idx === 0 && line.toLowerCase().startsWith('url,')) return;
    const match = line.match(/https?:\/\/[^\s,"]+/i);
    if (match) {
      const url = match[0];
      if (!db.hasArticleWithUrl(url)) {
        const parts = line.split(',');
        const titleCandidate = parts[1]?.replace(/^"|"$/g, '').trim();
        const art = buildFallbackArticleFromUrl(url, titleCandidate || undefined);
        art.tags_csv = 'instapaper';
        db.upsertArticle(art);
        csvCount += 1;
      }
    }
  });

  return {
    importedArticles: csvCount,
    importedHighlights: 0,
    sourceFormat: 'Instapaper CSV',
  };
}
