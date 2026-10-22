import { FontFamilyMode, HighlightColor, ThemeMode } from '../constants/theme';
import { LanguageCode } from '../constants/i18n';

export type ContentBlockType = 'h1' | 'h2' | 'h3' | 'p' | 'blockquote' | 'code' | 'li';

export interface ContentBlock {
  index: number;
  type: ContentBlockType;
  text: string;
}

export type ArticleStatus = 'inbox' | 'archive' | 'favorite';

export interface ReaderSettingsRecord {
  id: 1;
  theme_mode: ThemeMode;
  font_family: FontFamilyMode;
  font_size: number; // 15 to 26
  line_height: number; // 1.4 to 1.9
  tts_rate: number; // 0.75 to 2.0
  auto_clipboard_prompt: number; // 1 or 0
  cache_images_offline: number; // 1 or 0
  app_language: LanguageCode; // UI & default translation language
  translate_target_lang: LanguageCode; // Preferred target language for article translation
}

export interface ArticleRecord {
  id: string;
  url: string;
  domain: string;
  title: string;
  author: string | null;
  hero_image_uri: string | null;
  excerpt: string | null;
  content_blocks_json: string; // JSON string of ContentBlock[]
  plain_text: string;
  word_count: number;
  reading_time_minutes: number;
  scroll_progress: number; // 0.0 to 1.0
  status: ArticleStatus;
  tags_csv: string; // e.g., 'tech,essays'
  created_at: string;
  last_read_at: string | null;
}

export interface HighlightRecord {
  id: string;
  article_id: string;
  block_index: number;
  highlighted_text: string;
  color: HighlightColor;
  note: string | null;
  created_at: string;
}

export interface TagRecord {
  id: string;
  name: string;
  color_hex: string;
}

export const SQLITE_MIGRATION_DDL = `
-- 1. User Reading Preferences & Settings
CREATE TABLE IF NOT EXISTS reader_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme_mode TEXT NOT NULL DEFAULT 'paper',    -- 'paper' | 'sepia' | 'dark'
  font_family TEXT NOT NULL DEFAULT 'serif',   -- 'serif' | 'sans' | 'mono'
  font_size INTEGER NOT NULL DEFAULT 18,       -- 15 to 26
  line_height REAL NOT NULL DEFAULT 1.65,
  tts_rate REAL NOT NULL DEFAULT 1.0,          -- 0.75 to 2.0
  auto_clipboard_prompt INTEGER NOT NULL DEFAULT 1
);

-- 2. Saved Offline Articles Table
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,                        -- e.g., 'paulgraham.com'
  title TEXT NOT NULL,
  author TEXT,
  hero_image_uri TEXT,                         -- Local cached file path or URL
  excerpt TEXT,
  content_blocks_json TEXT NOT NULL,           -- JSON array of clean paragraphs/headings/quotes/code
  plain_text TEXT NOT NULL,                    -- Used for offline full-text search & TTS narration
  word_count INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes INTEGER NOT NULL DEFAULT 1,
  scroll_progress REAL NOT NULL DEFAULT 0,     -- 0.0 to 1.0 (remembers exact reading position)
  status TEXT NOT NULL DEFAULT 'inbox',        -- 'inbox' | 'archive' | 'favorite'
  tags_csv TEXT DEFAULT '',                    -- Comma-separated tags e.g. 'tech,essays'
  created_at TEXT NOT NULL,
  last_read_at TEXT
);

-- 3. Multi-Color Highlights & Margin Notes Table
CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  block_index INTEGER NOT NULL,                -- Index of the paragraph block in content_blocks_json
  highlighted_text TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'yellow',        -- 'yellow' | 'green' | 'blue' | 'purple'
  note TEXT,                                   -- Optional user margin note attached to the highlight
  created_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- 4. Collections / Tags Table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color_hex TEXT NOT NULL DEFAULT '#2D6A4F'
);
`;

export const INITIAL_TAGS: TagRecord[] = [
  { id: 'tag-essays', name: 'essays', color_hex: '#2D6A4F' },
  { id: 'tag-tech', name: 'tech', color_hex: '#0C4A6E' },
  { id: 'tag-design', name: 'design', color_hex: '#9C4A1A' },
  { id: 'tag-productivity', name: 'productivity', color_hex: '#4C1D95' },
];

const sample1Blocks: ContentBlock[] = [
  {
    index: 0,
    type: 'p',
    text: 'If you collected lists of techniques for doing great work in a lot of different fields, what would the intersection look like? I decided to find out by making it.',
  },
  {
    index: 1,
    type: 'h2',
    text: '1. Choosing What to Work On',
  },
  {
    index: 2,
    type: 'p',
    text: 'The first step is to decide what to work on. The work you choose needs to have three qualities: it has to be something you have a natural aptitude for, that you have a deep interest in, and that offers scope to do great work.',
  },
  {
    index: 3,
    type: 'blockquote',
    text: 'Curiosity is the best guide. Your curiosity never lies, and it knows more than you do about what is worth paying attention to.',
  },
  {
    index: 4,
    type: 'p',
    text: 'In practice you don’t have to worry much about the third criterion. Ambitious people are if anything already too conservative about it. So all you need to do is find something you have an aptitude for and great interest in.',
  },
  {
    index: 5,
    type: 'h2',
    text: '2. The Compounding Effect of Deep Focus',
  },
  {
    index: 6,
    type: 'p',
    text: 'Great work happens by focusing consistently on something you are genuinely curious about. Even a small daily advance compounds into extraordinary originality over a decade when distractions are ruthlessly eliminated.',
  },
  {
    index: 7,
    type: 'li',
    text: 'Follow your own independent curiosity rather than fashionable consensus topics.',
  },
  {
    index: 8,
    type: 'li',
    text: 'Protect large blocks of uninterrupted reading and thinking time every morning.',
  },
  {
    index: 9,
    type: 'li',
    text: 'Write down half-formed questions in the margins—most breakthroughs begin as a single anomaly noticed while reading deeply.',
  },
  {
    index: 10,
    type: 'p',
    text: 'When you read actively—highlighting the sentences that surprise you and writing brief margin notes in your own words—you transform passive consumption into original synthesis.',
  },
];

const sample2Blocks: ContentBlock[] = [
  {
    index: 0,
    type: 'p',
    text: 'Cloud apps have given us seamless collaboration, yet they have quietly taken away true ownership of our personal knowledge. When a startup shuts down its servers or locks your library behind a recurring subscription, years of your curated articles and notes can vanish overnight.',
  },
  {
    index: 1,
    type: 'h2',
    text: 'The Seven Ideals of Local-First Software',
  },
  {
    index: 2,
    type: 'p',
    text: 'In local-first software, the primary copy of your data lives right on your own device in an open, inspectable database like SQLite or plain Markdown files. Remote cloud drives serve only as an encrypted backup or user-controlled sync conduit—never a gatekeeper.',
  },
  {
    index: 3,
    type: 'blockquote',
    text: 'Your thoughts, highlights, and reading archive belong on your device first—accessible in Airplane Mode today and readable fifty years from now.',
  },
  {
    index: 4,
    type: 'code',
    text: `// Local-First Architecture Principle\nconst article = await sqlite.getArticle(id);\n// Zero network latency, zero server subscription, 100% user ownership\nawait exportToObsidianMarkdown(article, highlights);`,
  },
  {
    index: 5,
    type: 'h2',
    text: 'Why Plain Text & Markdown Endure',
  },
  {
    index: 6,
    type: 'p',
    text: 'Proprietary cloud databases come and go, but UTF-8 Markdown (.md) and open JSON backups are immortal. By exporting your reading highlights directly to Markdown, your Second Brain in Obsidian, Notion, or Logseq remains permanently yours.',
  },
];

const sample3Blocks: ContentBlock[] = [
  {
    index: 0,
    type: 'p',
    text: 'Modern web pages are engineered for fragmentation: auto-playing videos, sticky newsletter popups, cookie walls, and algorithmic sidebars compete for every millisecond of your visual cortex.',
  },
  {
    index: 1,
    type: 'h2',
    text: 'Principles of Literary Paper & Ink',
  },
  {
    index: 2,
    type: 'p',
    text: 'True reading comprehension requires visual tranquility. Replacing harsh #FFFFFF blue-light glare with warm cream paper (#FAF7F2) or vintage parchment sepia (#F3E9D2) reduces ciliary muscle fatigue during long-form reading sessions.',
  },
  {
    index: 3,
    type: 'blockquote',
    text: 'Technology should inform and calm us, bringing the tactile serenity of a physical book to the digital screen.',
  },
  {
    index: 4,
    type: 'p',
    text: 'Pairing visual reading with native offline Text-to-Speech (TTS) engages dual sensory channels. Listening at 1.25x while following highlighted paragraphs boosts retention and turns any commute or walk into a serene seminar.',
  },
];

// Inline SVG Data URI Hero Illustrations so they work 100% offline in Airplane Mode out of the box!
const heroSvg1 = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1B4332"/>
        <stop offset="100%" stop-color="#2D6A4F"/>
      </linearGradient>
    </defs>
    <rect width="800" height="420" fill="url(#g1)"/>
    <circle cx="660" cy="110" r="140" fill="#40916C" opacity="0.35"/>
    <circle cx="140" cy="340" r="180" fill="#52B788" opacity="0.2"/>
    <rect x="70" y="75" width="110" height="32" rx="16" fill="#D8F3DC" opacity="0.2"/>
    <text x="125" y="96" fill="#D8F3DC" font-family="Georgia, serif" font-size="14" text-anchor="middle" font-weight="bold">ESSAY • FOCUS</text>
    <text x="70" y="185" fill="#FAF7F2" font-family="Georgia, serif" font-size="44" font-weight="bold">How to Do Great Work</text>
    <text x="70" y="235" fill="#B7E4C7" font-family="sans-serif" font-size="21">Curiosity, compounding focus &amp; independent inquiry</text>
  </svg>`
)}`;

const heroSvg2 = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420">
    <defs>
      <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0C4A6E"/>
        <stop offset="100%" stop-color="#1E3A8A"/>
      </linearGradient>
    </defs>
    <rect width="800" height="420" fill="url(#g2)"/>
    <circle cx="650" cy="300" r="160" fill="#0284C7" opacity="0.28"/>
    <rect x="70" y="75" width="155" height="32" rx="16" fill="#BAE6FD" opacity="0.2"/>
    <text x="147" y="96" fill="#BAE6FD" font-family="monospace" font-size="13" text-anchor="middle" font-weight="bold">LOCAL-FIRST • SQLITE</text>
    <text x="70" y="180" fill="#FAF7F2" font-family="Georgia, serif" font-size="40" font-weight="bold">The Local-First Software</text>
    <text x="70" y="230" fill="#FAF7F2" font-family="Georgia, serif" font-size="40" font-weight="bold">Manifesto</text>
    <text x="70" y="280" fill="#BAE6FD" font-family="sans-serif" font-size="20">Zero servers, offline permanence &amp; Markdown ownership</text>
  </svg>`
)}`;

const heroSvg3 = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420">
    <defs>
      <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#7C2D12"/>
        <stop offset="100%" stop-color="#9C4A1A"/>
      </linearGradient>
    </defs>
    <rect width="800" height="420" fill="url(#g3)"/>
    <circle cx="680" cy="100" r="130" fill="#FDBA74" opacity="0.22"/>
    <rect x="70" y="75" width="145" height="32" rx="16" fill="#FFEDD5" opacity="0.2"/>
    <text x="142" y="96" fill="#FFEDD5" font-family="Georgia, serif" font-size="13" text-anchor="middle" font-weight="bold">CALM DESIGN</text>
    <text x="70" y="185" fill="#FAF7F2" font-family="Georgia, serif" font-size="42" font-weight="bold">Designing for Calm Attention</text>
    <text x="70" y="235" fill="#FED7AA" font-family="sans-serif" font-size="20">Literary typography, warm paper &amp; distraction-free reading</text>
  </svg>`
)}`;

export const SEED_ARTICLES: ArticleRecord[] = [
  {
    id: 'art-great-work',
    url: 'https://paulgraham.com/greatwork.html',
    domain: 'paulgraham.com',
    title: 'How to Do Great Work',
    author: 'Paul Graham',
    hero_image_uri: heroSvg1,
    excerpt:
      'If you collected lists of techniques for doing great work in a lot of different fields, what would the intersection look like? Curiosity, deep focus, and compounding daily progress.',
    content_blocks_json: JSON.stringify(sample1Blocks),
    plain_text: sample1Blocks.map((b) => b.text).join('\n\n'),
    word_count: 1320,
    reading_time_minutes: 6,
    scroll_progress: 0.65,
    status: 'inbox',
    tags_csv: 'essays,productivity',
    created_at: '2026-10-19T09:15:00.000Z',
    last_read_at: '2026-10-21T08:30:00.000Z',
  },
  {
    id: 'art-local-first',
    url: 'https://www.inkandswitch.com/local-first/',
    domain: 'inkandswitch.com',
    title: 'The Local-First Software Manifesto',
    author: 'Martin Kleppmann, Adam Wiggins et al.',
    hero_image_uri: heroSvg2,
    excerpt:
      'In local-first software, the primary copy of your data lives right on your own device in an open database like SQLite or plain Markdown files—accessible offline forever.',
    content_blocks_json: JSON.stringify(sample2Blocks),
    plain_text: sample2Blocks.map((b) => b.text).join('\n\n'),
    word_count: 890,
    reading_time_minutes: 4,
    scroll_progress: 0.4,
    status: 'favorite',
    tags_csv: 'tech,essays',
    created_at: '2026-10-20T14:20:00.000Z',
    last_read_at: '2026-10-21T10:15:00.000Z',
  },
  {
    id: 'art-calm-attention',
    url: 'https://calmtech.org/papers/designing-for-calm-attention',
    domain: 'calmtech.org',
    title: 'Designing for Calm Attention',
    author: 'Clara Vance',
    hero_image_uri: heroSvg3,
    excerpt:
      'Replacing harsh blue-light glare with warm cream paper and pairing clean typography with offline Text-to-Speech brings the serenity of a physical book to your pocket.',
    content_blocks_json: JSON.stringify(sample3Blocks),
    plain_text: sample3Blocks.map((b) => b.text).join('\n\n'),
    word_count: 660,
    reading_time_minutes: 3,
    scroll_progress: 0.2,
    status: 'inbox',
    tags_csv: 'design,productivity',
    created_at: '2026-10-21T07:45:00.000Z',
    last_read_at: null,
  },
];

export const SEED_HIGHLIGHTS: HighlightRecord[] = [
  {
    id: 'hl-sample-1',
    article_id: 'art-great-work',
    block_index: 3,
    highlighted_text:
      'Curiosity is the best guide. Your curiosity never lies, and it knows more than you do about what is worth paying attention to.',
    color: 'yellow',
    note: 'Core compass for selecting high-leverage projects—audit weekly tasks against genuine curiosity.',
    created_at: '2026-10-19T09:22:00.000Z',
  },
  {
    id: 'hl-sample-2',
    article_id: 'art-great-work',
    block_index: 6,
    highlighted_text:
      'Great work happens by focusing consistently on something you are genuinely curious about. Even a small daily advance compounds into extraordinary originality over a decade when distractions are ruthlessly eliminated.',
    color: 'green',
    note: 'Keep mornings 100% offline in Airplane Mode for deep reading and synthesis.',
    created_at: '2026-10-19T09:26:00.000Z',
  },
  {
    id: 'hl-sample-3',
    article_id: 'art-local-first',
    block_index: 3,
    highlighted_text:
      'Your thoughts, highlights, and reading archive belong on your device first—accessible in Airplane Mode today and readable fifty years from now.',
    color: 'blue',
    note: 'Why Folia stores everything locally in SQLite and exports clean Markdown (.md) for Obsidian & Notion.',
    created_at: '2026-10-20T14:35:00.000Z',
  },
  {
    id: 'hl-sample-4',
    article_id: 'art-calm-attention',
    block_index: 3,
    highlighted_text:
      'Technology should inform and calm us, bringing the tactile serenity of a physical book to the digital screen.',
    color: 'purple',
    note: 'Literary Paper & Ink design principle (#FAF7F2 warm cream background).',
    created_at: '2026-10-21T08:00:00.000Z',
  },
];
