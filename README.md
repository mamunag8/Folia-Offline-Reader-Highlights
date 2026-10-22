# Folia-Offline-Reader-Highlights

# Folia: Offline Reader & Highlights (`com.kasbllc.folia`)

**Folia: Offline Reader & Highlights** (Home Screen Label: **Folia**) is a 100% free, serverless, local-first Read-It-Later, offline article saver, built-in 15-language full-article & side-by-side bilingual translator, 4-color highlighter, and native Text-to-Speech listener that strips ads and clutter from any web link and exports highlights directly to Markdown (`.md`) for Obsidian and Notion.

---

## Core Architecture & Features

- **100% Serverless & Local-First:** Zero backend server costs, zero login walls, zero cloud subscriptions, and zero advertisements.
- **Built-In 15-Language Full Article & Bilingual Translation Engine:** Full UI localization (with automatic LTR/RTL layout switching) plus instant full-article and single-paragraph translation across 15 global languages (`en`, `ar`, `fa`, `es`, `fr`, `de`, `zh`, `hi`, `ru`, `pt`, `ja`, `tr`, `ko`, `it`, `ur`), supporting both Side-by-Side Bilingual Mode and Translated-Only Mode with local SQLite caching.
- **Algorithm A — On-Device Readability Article Parser:** Fetches raw HTML directly from the device, extracts OpenGraph metadata, strips ads/popups/sidebars, and structures clean `h1 | h2 | h3 | p | blockquote | code | li` blocks with offline SVG cover caching.
- **Algorithm B — Smart Clipboard & Share Sheet URL Detector:** Automatically detects copied `http://` or `https://` links on app foreground and prompts a 1-tap offline save banner.
- **Algorithm C — Interactive 4-Color Highlighter & Margin Notes:** Tap any paragraph in the Clean Reader View to highlight in Yellow, Green, Blue, or Purple, attach inline margin notes, translate individual paragraphs, copy text, or start TTS playback from that exact paragraph.
- **Algorithm D — Native Text-to-Speech (TTS) Controller:** Sequential paragraph reading (original or translated text with matching BCP-47 voice locales) with live visual block outlining, auto-scroll, and speed cycling (`1.0x -> 1.25x -> 1.5x -> 2.0x -> 0.75x`).
- **Algorithm E — 1-Tap Obsidian / Notion Markdown Exporter & Competitor Importer:** Exports single-article or full-library highlights to `.md` and supports full JSON library backup/restore plus Pocket `.html` and Instapaper `.csv` batch imports.
- **Literary Paper & Ink Design System:** Three eye-comfort themes (`☀️ Paper #FAF7F2`, `📜 Sepia #F3E9D2`, `🌙 Ink #111315`) and three selectable font families (`Serif`, `Sans`, `Mono`).

---

## Project Structure

- `app.json` & `capacitor.config.ts` — Native iOS & Android (`com.kasbllc.folia`) configuration
- `constants/theme.ts` — Color tokens, 4-color highlight marker palette, and typography presets
- `constants/i18n.ts` — 15-language localization dictionary, RTL/LTR metadata, and BCP-47 TTS voice locales
- `db/schema.ts` & `db/database.ts` — SQLite schema (`reader_settings`, `articles`, `highlights`, `tags`), Full-Text Search engine, and 3 pre-populated offline sample articles
- `utils/` — `readabilityParser.ts`, `clipboardDetector.ts`, `ttsController.ts`, `translator.ts`, `exporters.ts`, `haptics.ts`
- `components/` — `LibraryScreen.tsx`, `ReaderView.tsx`, `TypographySheet.tsx`, `HighlightsHubScreen.tsx`, `SettingsScreen.tsx`
- `app/` — Modular route entry points (`_layout.tsx`, `(tabs)/`, `reader/[id].tsx`)
- `play-store-submission/` — Signed release `.aab`, `.apk`, `PRIVACY_POLICY.html`, `PLAY_STORE_CONSOLE_GUIDE.md`, and store graphics
