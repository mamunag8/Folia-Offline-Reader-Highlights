import {
  ArticleRecord,
  ArticleStatus,
  HighlightRecord,
  INITIAL_TAGS,
  ReaderSettingsRecord,
  SEED_ARTICLES,
  SEED_HIGHLIGHTS,
  SQLITE_MIGRATION_DDL,
  TagRecord,
} from './schema';
import { HighlightColor } from '../constants/theme';

const STORAGE_KEYS = {
  SETTINGS: 'folia_sqlite_reader_settings_v1',
  ARTICLES: 'folia_sqlite_articles_v1',
  HIGHLIGHTS: 'folia_sqlite_highlights_v1',
  TAGS: 'folia_sqlite_tags_v1',
  INITIALIZED: 'folia_sqlite_initialized_v1',
};

const DEFAULT_SETTINGS: ReaderSettingsRecord = {
  id: 1,
  theme_mode: 'paper',
  font_family: 'serif',
  font_size: 18,
  line_height: 1.65,
  tts_rate: 1.0,
  auto_clipboard_prompt: 1,
  cache_images_offline: 1,
  app_language: 'en',
  translate_target_lang: 'es',
};

class LocalSQLiteDatabase {
  private initialized = false;

  public init(): void {
    if (this.initialized) return;
    try {
      const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!isInit) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(SEED_ARTICLES));
        localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(SEED_HIGHLIGHTS));
        localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(INITIAL_TAGS));
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, '1');
      }
      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }

  public getMigrationDDL(): string {
    return SQLITE_MIGRATION_DDL;
  }

  public getSettings(): ReaderSettingsRecord {
    this.init();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public updateSettings(patch: Partial<ReaderSettingsRecord>): ReaderSettingsRecord {
    this.init();
    const current = this.getSettings();
    const updated: ReaderSettingsRecord = { ...current, ...patch, id: 1 };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }

  public getAllArticles(): ArticleRecord[] {
    this.init();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ARTICLES);
      if (!raw) return SEED_ARTICLES;
      const list = JSON.parse(raw) as ArticleRecord[];
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch {
      return SEED_ARTICLES;
    }
  }

  public getArticleById(id: string): ArticleRecord | null {
    return this.getAllArticles().find((a) => a.id === id) || null;
  }

  public hasArticleWithUrl(url: string): boolean {
    const normalized = url.trim().toLowerCase().replace(/\/+$/, '');
    return this.getAllArticles().some(
      (a) => a.url.trim().toLowerCase().replace(/\/+$/, '') === normalized
    );
  }

  public upsertArticle(article: ArticleRecord): ArticleRecord {
    this.init();
    const all = this.getAllArticles();
    const existingIdx = all.findIndex((a) => a.id === article.id || a.url === article.url);
    if (existingIdx >= 0) {
      all[existingIdx] = { ...all[existingIdx], ...article };
    } else {
      all.unshift(article);
    }
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(all));
    return article;
  }

  public updateArticleStatus(id: string, status: ArticleStatus): void {
    const all = this.getAllArticles().map((a) => (a.id === id ? { ...a, status } : a));
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(all));
  }

  public updateArticleProgress(id: string, scroll_progress: number): void {
    const clamped = Math.max(0, Math.min(1, Number(scroll_progress.toFixed(2))));
    const all = this.getAllArticles().map((a) =>
      a.id === id
        ? {
            ...a,
            scroll_progress: clamped,
            last_read_at: new Date().toISOString(),
          }
        : a
    );
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(all));
  }

  public updateArticleTags(id: string, tags: string[]): void {
    const cleaned = Array.from(
      new Set(tags.map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))
    );
    const all = this.getAllArticles().map((a) =>
      a.id === id ? { ...a, tags_csv: cleaned.join(',') } : a
    );
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(all));

    // Also register any new tags into tags table
    const existingTags = this.getAllTags();
    let changed = false;
    for (const tagName of cleaned) {
      if (!existingTags.some((t) => t.name.toLowerCase() === tagName)) {
        existingTags.push({
          id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: tagName,
          color_hex: '#2D6A4F',
        });
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(existingTags));
    }
  }

  public deleteArticle(id: string): void {
    const all = this.getAllArticles().filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(all));
    // ON DELETE CASCADE for highlights
    const highlights = this.getAllHighlights().filter((h) => h.article_id !== id);
    localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(highlights));
  }

  /**
   * Full-Text Search across article titles, domains, authors, full body plain_text, and attached highlights/notes
   */
  public searchArticles(
    query: string,
    statusFilter: ArticleStatus | 'all',
    tagFilter: string | null
  ): ArticleRecord[] {
    const all = this.getAllArticles();
    const highlights = this.getAllHighlights();
    const q = query.trim().toLowerCase();

    return all.filter((art) => {
      if (statusFilter !== 'all' && art.status !== statusFilter) {
        return false;
      }
      if (tagFilter) {
        const artTags = art.tags_csv
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        if (!artTags.includes(tagFilter.toLowerCase())) {
          return false;
        }
      }
      if (!q) return true;

      const inArticle =
        art.title.toLowerCase().includes(q) ||
        art.domain.toLowerCase().includes(q) ||
        (art.author && art.author.toLowerCase().includes(q)) ||
        art.plain_text.toLowerCase().includes(q) ||
        art.tags_csv.toLowerCase().includes(q);

      if (inArticle) return true;

      const artHighlights = highlights.filter((h) => h.article_id === art.id);
      return artHighlights.some(
        (h) =>
          h.highlighted_text.toLowerCase().includes(q) ||
          (h.note && h.note.toLowerCase().includes(q))
      );
    });
  }

  public getAllHighlights(): HighlightRecord[] {
    this.init();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HIGHLIGHTS);
      if (!raw) return SEED_HIGHLIGHTS;
      const list = JSON.parse(raw) as HighlightRecord[];
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch {
      return SEED_HIGHLIGHTS;
    }
  }

  public getHighlightsForArticle(articleId: string): HighlightRecord[] {
    return this.getAllHighlights()
      .filter((h) => h.article_id === articleId)
      .sort((a, b) => a.block_index - b.block_index);
  }

  public upsertHighlight(params: {
    article_id: string;
    block_index: number;
    highlighted_text: string;
    color: HighlightColor;
    note?: string | null;
  }): HighlightRecord {
    const all = this.getAllHighlights();
    const existingIdx = all.findIndex(
      (h) => h.article_id === params.article_id && h.block_index === params.block_index
    );

    if (existingIdx >= 0) {
      const updated: HighlightRecord = {
        ...all[existingIdx],
        highlighted_text: params.highlighted_text,
        color: params.color,
        note: params.note !== undefined ? params.note : all[existingIdx].note,
      };
      all[existingIdx] = updated;
      localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(all));
      return updated;
    } else {
      const created: HighlightRecord = {
        id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        article_id: params.article_id,
        block_index: params.block_index,
        highlighted_text: params.highlighted_text,
        color: params.color,
        note: params.note || null,
        created_at: new Date().toISOString(),
      };
      all.unshift(created);
      localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(all));
      return created;
    }
  }

  public updateHighlightNote(highlightId: string, note: string | null): void {
    const all = this.getAllHighlights().map((h) =>
      h.id === highlightId ? { ...h, note: note && note.trim() ? note.trim() : null } : h
    );
    localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(all));
  }

  public updateHighlightColor(highlightId: string, color: HighlightColor): void {
    const all = this.getAllHighlights().map((h) =>
      h.id === highlightId ? { ...h, color } : h
    );
    localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(all));
  }

  public deleteHighlight(highlightId: string): void {
    const all = this.getAllHighlights().filter((h) => h.id !== highlightId);
    localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(all));
  }

  public getAllTags(): TagRecord[] {
    this.init();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TAGS);
      if (!raw) return INITIAL_TAGS;
      return JSON.parse(raw) as TagRecord[];
    } catch {
      return INITIAL_TAGS;
    }
  }

  public addTag(name: string, color_hex = '#2D6A4F'): TagRecord {
    const cleaned = name.trim().toLowerCase().replace(/^#/, '');
    const all = this.getAllTags();
    const existing = all.find((t) => t.name.toLowerCase() === cleaned);
    if (existing) return existing;
    const created: TagRecord = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleaned,
      color_hex,
    };
    all.push(created);
    localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(all));
    return created;
  }

  public resetToSampleData(): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(SEED_ARTICLES));
    localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(SEED_HIGHLIGHTS));
    localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(INITIAL_TAGS));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, '1');
  }
}

export const db = new LocalSQLiteDatabase();
