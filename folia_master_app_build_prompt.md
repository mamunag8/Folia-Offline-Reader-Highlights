# MASTER BUILD PROMPT — Folia: Offline Reader & Highlights (iOS & Android)

You are an elite Principal Mobile Architect and Product Designer. Build a complete, production-ready, native cross-platform mobile application (iOS and Android) called **"Folia: Offline Reader & Highlights"** (Home Screen Icon Label: **Folia**).

---

## 1. PRODUCT OVERVIEW & CORE RULES

* **App Name:** Folia: Offline Reader & Highlights (Short Name: **Folia**)
* **Core Purpose:** A calm, distraction-free Read-It-Later, offline article saver, multi-color highlighter, and Text-to-Speech listener that strips ads and clutter from any web link and exports highlights directly to Markdown (Obsidian/Notion).
* **100% Serverless & Local-First Mandate (CRITICAL):**
  * This app must have **ZERO backend server costs**, **NO user login/signup walls**, **NO cloud subscriptions**, and **NO advertisements**.
  * Article parsing and ad-stripping happen **100% on the user's device** by fetching the target URL's HTML and cleaning it locally into structured reader blocks.
  * All articles, cached images, highlights, and notes are stored 100% locally on the device using SQLite (`expo-sqlite`) and the local file system (`expo-file-system`).
  * Audio narration runs 100% locally and free using the phone's native OS Text-to-Speech engine (`expo-speech`).
  * Cloud backup and PKM sync use native OS Auto-Backup plus 1-tap **Markdown (`.md`) Export** (for Obsidian/Notion) and **JSON Backup Export/Import** to the user's own Google Drive or iCloud Drive.

---

## 2. RECOMMENDED NATIVE TECH STACK

Build the app using **React Native with Expo (Managed Workflow, SDK 52+)** and **TypeScript**:

* **Navigation:** `expo-router` (3-tab bottom navigation + full-screen distraction-free Reader route + modal bottom sheets)
* **Local Database:** `expo-sqlite` (with Full-Text Search search queries across article titles, body text, and highlights)
* **Local File & Image Cache:** `expo-file-system` (saves article hero images offline so articles load in Airplane Mode)
* **Text-to-Speech (Audio Reader):** `expo-speech` (native offline iOS & Android voice synthesis with rate/pitch control)
* **Clipboard & Share Sheet:** `expo-clipboard` (automatic clipboard URL detection on app foreground) + `expo-sharing` + `expo-document-picker`
* **Animations & Gestures:** `react-native-reanimated` + `react-native-gesture-handler` (swipe-to-archive, smooth reader progress bar, floating highlight toolbar)
* **Haptics:** `expo-haptics` (subtle tactile feedback on saving articles, highlighting text, and archiving)
* **Icons:** `lucide-react-native`

---

## 3. UI/UX DESIGN SYSTEM ("LITERARY PAPER & INK")

Implement three curated reading themes designed for zero eye strain and deep focus:

### Color Tokens

1. **Light Theme ("Warm Kindle Paper" — Default):**
   * `backgroundPrimary`: `#FAF7F2` (Soft Cream Paper)
   * `surfaceCard`: `#FFFFFF`
   * `textPrimary`: `#1C1B18` (Deep Charcoal Ink)
   * `textSecondary`: `#6E6A63`
   * `brandAccent`: `#2D6A4F` (Botanical Forest Green)
   * `borderSubtle`: `#E8E2D9`

2. **Sepia Theme ("Vintage Parchment" — Reader Option):**
   * `backgroundPrimary`: `#F3E9D2`
   * `surfaceCard`: `#FAF3E3`
   * `textPrimary`: `#2C221E`
   * `textSecondary`: `#705E52`
   * `brandAccent`: `#9C4A1A` (Warm Sienna)
   * `borderSubtle`: `#E2D4B7`

3. **Dark Theme ("Midnight OLED Ink"):**
   * `backgroundPrimary`: `#111315`
   * `surfaceCard`: `#1A1D21`
   * `textPrimary`: `#E5E7EB`
   * `textSecondary`: `#9CA3AF`
   * `brandAccent`: `#6EE7B7` (Soft Sage Mint)
   * `borderSubtle`: `#262A30`

### Highlight Marker Palette (Light Mode / Dark Mode)
* `yellow` (Key Insight): `#FEF08A` / `#713F12`
* `green` (Actionable / Quote): `#BBF7D0` / `#14532D`
* `blue` (Definition / Fact): `#BAE6FD` / `#0C4A6E`
* `purple` (Question / Idea): `#E9D5FF` / `#4C1D95`

### Typography & Reading Ergonomics
* Support 3 selectable reader font families: **Serif** (Georgia / Lora style for long-form literature), **Sans-Serif** (Inter / System clean UI), and **Monospace** (for technical/coding articles).
* Adjustable font size (`15px` to `26px`), line height (`1.4` to `1.9`), and paragraph spacing.

---

## 4. LOCAL SQLITE DATABASE SCHEMA

Initialize these 4 tables automatically on first app launch:

```sql
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
```

Seed the database on first launch with **3 rich, complete offline sample articles** (with pre-populated multi-color highlights and margin notes) so the user can immediately test reading, highlighting, Text-to-Speech listening, and Markdown export without needing to paste a URL first:
1. *"How to Do Great Work"* (Essay style — 6 min read, with 2 sample highlights)
2. *"The Local-First Software Manifesto"* (Tech deep-dive — 4 min read, with 1 highlight + note)
3. *"Designing for Calm Attention"* (Productivity guide — 3 min read)

---

## 5. CORE ON-DEVICE ALGORITHMS TO IMPLEMENT

### Algorithm A: On-Device Readability Article Parser (Zero Server Scraping)
When a user saves any URL:
1. Fetch the raw HTML string directly from the user's phone using `fetch(url)` with a standard mobile browser User-Agent header.
2. Parse the HTML on-device:
   * Extract OpenGraph metadata (`og:title`, `og:image`, `og:site_name`, `author`, `<title>`).
   * Strip all `<script>`, `<style>`, `<nav>`, `<footer>`, `<aside>`, `<iframe_ads>`, cookie banners, and newsletter popups.
   * Extract semantic reading blocks from `<article>`, `<main>`, or the highest-density text container into a clean JSON array of blocks:
     `type ContentBlock = { index: number; type: 'h1' | 'h2' | 'h3' | 'p' | 'blockquote' | 'code' | 'li'; text: string }`.
3. Calculate `word_count` and `reading_time_minutes = Math.max(1, Math.round(word_count / 220))`.
4. Download the hero image (`og:image`) locally into `FileSystem.documentDirectory` so the article displays its cover image even in Airplane Mode.

### Algorithm B: Smart Clipboard & Share Sheet URL Detector
1. Whenever the app opens or returns to the foreground, check `Clipboard.getStringAsync()`.
2. If the clipboard contains a valid `http://` or `https://` URL that is not yet in the `articles` table, display a sleek floating toast banner at the top of the screen:
   `🔗 Copied link detected: " Save to Folia Offline? " [ + Save Now ] [ ✕ ]`
3. Also provide a prominent `[ + Paste Link ]` button on the home screen and support incoming OS Share Sheet URLs.

### Algorithm C: Interactive Paragraph & Span Highlighter
Inside the Clean Reader View:
1. Users can tap or long-press any paragraph/sentence block (or select text) to summon a floating **Highlight & Note Pill Bar**:
   `[ 🟡 ] [ 🟢 ] [ 🔵 ] [ 🟣 ]  |  [ 💬 Add Note ]  |  [ 📋 Copy ]  |  [ 🔊 Read From Here ]`
2. Tapping a color immediately highlights the text in that marker shade, triggers a light haptic pulse, and saves the record to the `highlights` SQLite table.
3. Tapping `[ 💬 Add Note ]` opens a compact inline margin-note input directly beneath the highlighted block.

### Algorithm D: Native Offline Text-to-Speech (TTS) Audio Controller
1. Tapping `[ 🎧 Listen ]` at the top of any article starts reading the article's `content_blocks_json` sequentially using `expo-speech`.
2. **Live Sentence Sync:** As `expo-speech` reads Block $i$, gently outline/highlight Block $i$ on the screen and auto-scroll the reader so the user can follow along visually.
3. Render a persistent **Floating Audio Mini-Player** at the bottom of the screen with:
   * `[ ⏮ Prev Paragraph ]` / `[ ⏯ Play/Pause ]` / `[ ⏭ Next Paragraph ]`
   * Speed cycle button: `[ 1.0x ]` $\rightarrow$ `[ 1.25x ]` $\rightarrow$ `[ 1.5x ]` $\rightarrow$ `[ 2.0x ]` $\rightarrow$ `[ 0.75x ]`.

### Algorithm E: 1-Tap Obsidian / Notion Markdown Exporter & Pocket Importer
1. **Markdown Export (`.md`):** For any article (or all highlights across the library), format a clean Markdown document:
   ```markdown
   # {Article Title}
   - **Source:** [{domain}]({url})
   - **Author:** {author}
   - **Saved Date:** {created_at}

   ## ✨ Highlights & Notes
   > "{highlighted_text}"
   *— Note: {note}*
   ```
   Save to a temporary `.md` file via `expo-file-system` and open the native OS Share Sheet (`expo-sharing`) so the user can send it directly to **Obsidian**, **Notion**, **Apple Notes**, or **Google Drive**.
2. **Competitor Importer:** In Settings, allow users to pick a Pocket `.html` export, Instapaper `.csv`, or Folia `.json` backup file via `expo-document-picker` and batch-import their links locally.

---

## 6. SCREEN-BY-SCREEN SPECIFICATIONS

### Screen 1: Tab 1 — Reading Library (Home Screen)
* **Top Header:**
  * App brand title **Folia**, offline status badge (`⚡ 100% Offline Ready`), and a `[ + Save URL ]` button.
  * Instant local search bar (`🔍 Search titles, full article text, or highlights...`).
  * Filter chips: `📥 Inbox`, `⭐ Favorites`, `🗂️ Archived`, plus user Tag pills (`#tech`, `#essays`, `#design`).
* **Smart Clipboard Banner:** Conditional 1-tap banner when a new web URL is detected on the clipboard.
* **Article Cards List:**
  * Shows Domain favicon/name (`paulgraham.com`), Article Title (bold Serif), estimated reading time (`6 min read`), highlight count badge (`✨ 3 highlights`), and a thin bottom progress bar showing how far the user has read (`65%`).
  * **Swipe Gestures:** Swipe right to Archive (`🗂️`), swipe left to Favorite (`⭐`) or Delete (`🗑️`).

### Screen 2: Distraction-Free Clean Reader View (Full Screen)
* **Top Minimal Bar (Auto-hides on scroll down):**
  * Back arrow, Reading Progress bar (`0%` to `100%`), `[ 🎧 Listen ]` TTS button, `[ Aa ]` Typography & Theme sheet button, and `[ 📤 Export .md ]` share button.
* **Article Header:**
  * Domain badge, Large Serif Title, Author, Published/Saved Date, Word Count, and `[ + Add Tag ]` chip.
* **Clean Body Canvas:**
  * Renders structured `content_blocks_json` with generous margins.
  * Displays existing user highlights in their chosen pastel marker colors (`yellow`, `green`, `blue`, `purple`) with any attached margin notes rendered as a sleek callout card right underneath the paragraph.
  * Tapping any paragraph opens the **Floating Highlighter & Note Toolbar**.
* **Bottom Floating TTS Bar (when audio is active):**
  * Shows current paragraph progress, Play/Pause, Skip Forward/Back, and `1.25x` speed toggle.

### Screen 3: Typography & Theme Customizer (Bottom Sheet `[ Aa ]`)
* **Theme Picker:** 3 tactile cards: `☀️ Paper (#FAF7F2)`, `📜 Sepia (#F3E9D2)`, `🌙 Ink (#111315)`.
* **Font Family Selector:** `Serif` | `Sans` | `Mono`.
* **Font Size Stepper:** `A-` slider/buttons to `A+` (`15px`–`26px`).
* **Line Spacing Toggle:** `Compact`, `Comfortable`, `Spacious`.

### Screen 4: Tab 2 — "My Highlights & Notes" Hub (Second Brain View)
* A dedicated feed of **every highlight and note** the user has ever saved across all articles.
* **Filter Controls:** Filter by Marker Color (`All`, `🟡 Yellow`, `🟢 Green`, `🔵 Blue`, `🟣 Purple`) or search within highlights.
* **Flashcard / Daily Review Carousel:** At the top of the screen, display a `"✨ Daily Rediscovery"` card that surfaces 3 random highlights from past reading so the user remembers what they read.
* **1-Tap Bulk Export:** Button `[ 📤 Export All Highlights to Markdown ]` for Obsidian/Notion users.

### Screen 5: Tab 3 — Settings, Backup & Competitor Importer
* **Reading Stats Banner:** Total Articles Saved, Words Read, and Total Highlights Created.
* **Zero-Cost Data Ownership & Sync:**
  * `[ 📤 Export Full Library Backup (JSON) ]` (Save to Google Drive / iCloud Drive).
  * `[ 📥 Restore / Import Backup (JSON / CSV / HTML) ]` (Supports Folia JSON, Pocket HTML, and Instapaper CSV).
* **Clipboard & Offline Preferences:** Toggle automatic clipboard URL detection and offline image caching.

---

## 7. NATIVE ANDROID & iOS CONFIGURATION (`app.json`)

Configure `app.json` with clean permissions and automatic OS cloud backup:

* **iOS (`ios.infoPlist`):**
  * `UIBackgroundModes`: `["audio"]` (allows Text-to-Speech article narration to continue when the screen locks)
* **Android (`android`):**
  * `permissions`: `["INTERNET", "VIBRATE"]`
  * `allowBackup`: `true` (enables automatic zero-cost encrypted Google Drive app data backup on Android devices)

---

## 8. EXECUTION INSTRUCTIONS

1. Generate the complete modular project file tree (`app/`, `components/`, `db/`, `utils/`, `constants/`).
2. Write complete, runnable TypeScript code for every file—never leave `// TODO` or unimplemented placeholders.
3. Ensure the on-device HTML Readability parser works on real live URLs pasted by the user AND includes a graceful fallback if a site blocks direct fetching.
4. Initialize the SQLite database on first launch with the 3 rich sample articles and sample highlights so the user can immediately experience the Clean Reader, Multi-Color Highlighter, TTS Audio Reader, and Markdown Exporter out of the box.