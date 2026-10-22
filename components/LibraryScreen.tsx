import React, { useMemo, useState } from 'react';
import {
  ArticleRecord,
  ArticleStatus,
  HighlightRecord,
  ReaderSettingsRecord,
  TagRecord,
} from '../db/schema';
import { FONT_FAMILIES, ThemeTokens } from '../constants/theme';
import {
  LANGUAGE_MAP,
  LanguageCode,
  SUPPORTED_LANGUAGES,
  UI_TRANSLATIONS,
} from '../constants/i18n';
import { db } from '../db/database';
import { fetchAndParseUrlOnDevice } from '../utils/readabilityParser';
import { extractValidUrlFromText } from '../utils/clipboardDetector';
import { triggerHaptic } from '../utils/haptics';
import {
  Search,
  Plus,
  Zap,
  Inbox,
  Star,
  Archive,
  Trash2,
  Clipboard,
  X,
  BookOpen,
  Sparkles,
  Link2,
  Clock,
  CheckCircle2,
  Globe,
} from 'lucide-react';

interface LibraryScreenProps {
  articles: ArticleRecord[];
  highlights: HighlightRecord[];
  tags: TagRecord[];
  settings: ReaderSettingsRecord;
  theme: ThemeTokens;
  clipboardDetectedUrl: string | null;
  onDismissClipboardUrl: (url: string) => void;
  onSelectArticle: (article: ArticleRecord, blockIndex?: number) => void;
  onUpdateSettings: (patch: Partial<ReaderSettingsRecord>) => void;
  onDataChanged: () => void;
  onToast: (msg: string) => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  articles,
  highlights,
  tags,
  settings,
  theme,
  clipboardDetectedUrl,
  onDismissClipboardUrl,
  onSelectArticle,
  onUpdateSettings,
  onDataChanged,
  onToast,
}) => {
  const ui = UI_TRANSLATIONS[settings.app_language || 'en'] || UI_TRANSLATIONS.en;
  const currentLangSpec = LANGUAGE_MAP[settings.app_language || 'en'] || LANGUAGE_MAP.en;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('inbox');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [customTitleInput, setCustomTitleInput] = useState('');
  const [customBodyInput, setCustomBodyInput] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  const filteredArticles = useMemo(() => {
    return db.searchArticles(searchQuery, statusFilter, activeTag);
  }, [articles, highlights, searchQuery, statusFilter, activeTag]);

  const highlightCountByArticle = useMemo(() => {
    const map = new Map<string, number>();
    highlights.forEach((h) => {
      map.set(h.article_id, (map.get(h.article_id) || 0) + 1);
    });
    return map;
  }, [highlights]);

  const handleQuickSaveUrl = async (targetUrl: string, title?: string, bodyText?: string) => {
    const cleaned = targetUrl.trim();
    if (!cleaned) return;
    setIsSavingUrl(true);
    triggerHaptic('medium');
    try {
      const parsed = await fetchAndParseUrlOnDevice(cleaned, {
        customTitle: title,
        customBodyText: bodyText,
        cacheImagesOffline: Boolean(settings.cache_images_offline),
      });
      db.upsertArticle(parsed);
      onDataChanged();
      setIsSaveModalOpen(false);
      setUrlInput('');
      setCustomTitleInput('');
      setCustomBodyInput('');
      if (clipboardDetectedUrl === targetUrl) {
        onDismissClipboardUrl(targetUrl);
      }
      triggerHaptic('success');
      onToast(`⚡ Saved "${parsed.title.slice(0, 36)}" for 100% offline reading`);
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handlePasteFromClipboardButton = async () => {
    triggerHaptic('light');
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const url = extractValidUrlFromText(text);
        if (url) {
          await handleQuickSaveUrl(url);
          return;
        }
      }
    } catch {
      // Fallback to opening the Save URL modal
    }
    setIsSaveModalOpen(true);
  };

  const handleToggleFavorite = (e: React.MouseEvent, art: ArticleRecord) => {
    e.stopPropagation();
    triggerHaptic('light');
    const next: ArticleStatus = art.status === 'favorite' ? 'inbox' : 'favorite';
    db.updateArticleStatus(art.id, next);
    onDataChanged();
    onToast(next === 'favorite' ? '⭐ Added to Favorites' : 'Moved back to Inbox');
  };

  const handleToggleArchive = (e: React.MouseEvent, art: ArticleRecord) => {
    e.stopPropagation();
    triggerHaptic('light');
    const next: ArticleStatus = art.status === 'archive' ? 'inbox' : 'archive';
    db.updateArticleStatus(art.id, next);
    onDataChanged();
    onToast(next === 'archive' ? '🗂️ Archived article' : 'Moved back to Inbox');
  };

  const handleDeleteArticle = (e: React.MouseEvent, art: ArticleRecord) => {
    e.stopPropagation();
    triggerHaptic('medium');
    db.deleteArticle(art.id);
    onDataChanged();
    onToast('🗑️ Removed article from local database');
  };

  const handleSelectLanguage = (code: LanguageCode) => {
    triggerHaptic('success');
    onUpdateSettings({
      app_language: code,
      translate_target_lang: code,
    });
    setIsLanguageModalOpen(false);
    const spec = LANGUAGE_MAP[code];
    onToast(`${spec.flag} Switched language to ${spec.nativeName} (${spec.name})`);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top Header */}
      <header
        className="border-b px-4 pt-4 pb-3 sm:px-6"
        style={{
          backgroundColor: theme.backgroundPrimary,
          borderColor: theme.borderSubtle,
        }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl font-serif text-lg font-bold shadow-xs"
              style={{
                backgroundColor: theme.brandAccent,
                color: theme.brandAccentText,
              }}
            >
              F
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-xl font-bold tracking-tight"
                  style={{ fontFamily: FONT_FAMILIES.serif.cssFamily }}
                >
                  Folia
                </h1>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor: `${theme.brandAccent}22`,
                    color: theme.brandAccent,
                  }}
                >
                  <Zap className="h-3 w-3" /> {ui.offlineReady}
                </span>
              </div>
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                {ui.appSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* 15-Language Selector Pill */}
            <button
              onClick={() => setIsLanguageModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors"
              style={{
                backgroundColor: theme.surfaceCard,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary,
              }}
              title="App & Article Translation Language (15 Languages)"
            >
              <Globe className="h-3.5 w-3.5" style={{ color: theme.brandAccent }} />
              <span>
                {currentLangSpec.flag} {currentLangSpec.code.toUpperCase()}
              </span>
            </button>

            <button
              onClick={handlePasteFromClipboardButton}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors"
              style={{
                backgroundColor: theme.surfaceCard,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary,
              }}
              title="Paste link from clipboard"
            >
              <Clipboard className="h-3.5 w-3.5" style={{ color: theme.brandAccent }} />
              <span>{ui.pasteLink}</span>
            </button>

            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs transition-transform active:scale-95"
              style={{
                backgroundColor: theme.brandAccent,
                color: theme.brandAccentText,
              }}
            >
              <Plus className="h-4 w-4" />
              <span>{ui.saveUrl}</span>
            </button>
          </div>
        </div>

        {/* Smart Clipboard URL Detection Banner (Algorithm B) */}
        {clipboardDetectedUrl && (
          <div
            className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs shadow-sm"
            style={{
              backgroundColor: theme.surfaceCard,
              borderColor: theme.brandAccent,
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0" style={{ color: theme.brandAccent }} />
              <div className="truncate">
                <span className="font-semibold">Copied link detected: </span>
                <span className="underline opacity-80">{clipboardDetectedUrl}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleQuickSaveUrl(clipboardDetectedUrl)}
                disabled={isSavingUrl}
                className="rounded-xl px-3 py-1 font-semibold"
                style={{
                  backgroundColor: theme.brandAccent,
                  color: theme.brandAccentText,
                }}
              >
                + Save Now
              </button>
              <button
                onClick={() => onDismissClipboardUrl(clipboardDetectedUrl)}
                className="rounded-lg p-1 opacity-70 hover:opacity-100"
                aria-label="Dismiss clipboard prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Instant Local SQLite Full-Text Search Bar */}
        <div
          className="mb-3 flex items-center gap-2 rounded-2xl border px-3.5 py-2.5"
          style={{
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
          }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: theme.textSecondary }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: theme.textPrimary }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="rounded-full p-0.5"
              style={{ color: theme.textSecondary }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Filter Chips & User Tag Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {(
            [
              { id: 'inbox', label: ui.inbox, icon: Inbox },
              { id: 'favorite', label: ui.favorites, icon: Star },
              { id: 'archive', label: ui.archived, icon: Archive },
              { id: 'all', label: ui.allSaved, icon: BookOpen },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic('light');
                  setStatusFilter(tab.id);
                }}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: active ? theme.brandAccent : theme.surfaceCard,
                  color: active ? theme.brandAccentText : theme.textPrimary,
                  borderColor: active ? theme.brandAccent : theme.borderSubtle,
                }}
              >
                {tab.label}
              </button>
            );
          })}

          <div className="mx-1 h-4 w-px shrink-0" style={{ backgroundColor: theme.borderSubtle }} />

          {tags.map((tag) => {
            const isTagActive = activeTag === tag.name;
            return (
              <button
                key={tag.id}
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTag(isTagActive ? null : tag.name);
                }}
                className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-all"
                style={{
                  backgroundColor: isTagActive ? theme.brandAccent : theme.surfaceElevated,
                  color: isTagActive ? theme.brandAccentText : theme.textSecondary,
                  borderColor: isTagActive ? theme.brandAccent : theme.borderSubtle,
                }}
              >
                #{tag.name}
              </button>
            );
          })}
        </div>
      </header>

      {/* Article Cards List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-3.5">
          {filteredArticles.length === 0 ? (
            <div
              className="rounded-3xl border p-10 text-center"
              style={{
                backgroundColor: theme.surfaceCard,
                borderColor: theme.borderSubtle,
              }}
            >
              <BookOpen
                className="mx-auto mb-3 h-10 w-10 opacity-40"
                style={{ color: theme.brandAccent }}
              />
              <h3
                className="mb-1 text-lg font-bold"
                style={{ fontFamily: FONT_FAMILIES.serif.cssFamily }}
              >
                No articles match this filter
              </h3>
              <p className="mb-4 text-xs" style={{ color: theme.textSecondary }}>
                Save any web link to strip ads and read 100% offline with multi-color highlights.
              </p>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setActiveTag(null);
                  setSearchQuery('');
                }}
                className="rounded-xl px-4 py-2 text-xs font-semibold"
                style={{
                  backgroundColor: theme.brandAccent,
                  color: theme.brandAccentText,
                }}
              >
                {ui.allSaved}
              </button>
            </div>
          ) : (
            filteredArticles.map((art) => {
              const hlCount = highlightCountByArticle.get(art.id) || 0;
              const pct = Math.round((art.scroll_progress || 0) * 100);
              const tagList = art.tags_csv
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);

              return (
                <div
                  key={art.id}
                  onClick={() => onSelectArticle(art)}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border transition-all hover:shadow-md"
                  style={{
                    backgroundColor: theme.surfaceCard,
                    borderColor: theme.borderSubtle,
                  }}
                >
                  <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      {/* Top row: Domain badge + Reading Time + Highlights badge */}
                      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className="inline-flex items-center gap-1.5 font-semibold"
                          style={{ color: theme.brandAccent }}
                        >
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                            style={{
                              backgroundColor: `${theme.brandAccent}22`,
                              color: theme.brandAccent,
                            }}
                          >
                            {art.domain.charAt(0).toUpperCase()}
                          </span>
                          {art.domain}
                        </span>

                        <span style={{ color: theme.textSecondary }}>•</span>

                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: theme.textSecondary }}
                        >
                          <Clock className="h-3 w-3" />
                          {art.reading_time_minutes} {ui.minRead}
                        </span>

                        {hlCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              backgroundColor: '#FEF08A',
                              color: '#713F12',
                            }}
                          >
                            <Sparkles className="h-3 w-3" /> {hlCount} {ui.highlightsCount}
                          </span>
                        )}
                      </div>

                      {/* Bold Serif Title */}
                      <h2
                        className="mb-1.5 text-lg leading-snug font-bold group-hover:underline"
                        style={{
                          fontFamily: FONT_FAMILIES.serif.cssFamily,
                          color: theme.textPrimary,
                        }}
                      >
                        {art.title}
                      </h2>

                      {/* Excerpt */}
                      {art.excerpt && (
                        <p
                          className="mb-3 line-clamp-2 text-xs leading-relaxed"
                          style={{ color: theme.textSecondary }}
                        >
                          {art.excerpt}
                        </p>
                      )}

                      {/* Bottom row: Tags + Quick Gesture / Action Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {tagList.map((t) => (
                            <span
                              key={t}
                              className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: theme.surfaceElevated,
                                color: theme.textSecondary,
                              }}
                            >
                              #{t}
                            </span>
                          ))}
                          <span
                            className="font-mono text-[11px]"
                            style={{ color: theme.textSecondary }}
                          >
                            {pct}% {ui.readPct}
                          </span>
                        </div>

                        {/* Swipe / Tactile Card Actions (Archive, Favorite, Delete) */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleToggleFavorite(e, art)}
                            className="rounded-lg p-1.5 transition-colors"
                            style={{
                              backgroundColor:
                                art.status === 'favorite' ? '#FEF08A' : theme.surfaceElevated,
                              color: art.status === 'favorite' ? '#713F12' : theme.textSecondary,
                            }}
                            title={art.status === 'favorite' ? 'Unfavorite' : 'Favorite'}
                          >
                            <Star
                              className="h-3.5 w-3.5"
                              fill={art.status === 'favorite' ? 'currentColor' : 'none'}
                            />
                          </button>

                          <button
                            onClick={(e) => handleToggleArchive(e, art)}
                            className="rounded-lg p-1.5 transition-colors"
                            style={{
                              backgroundColor:
                                art.status === 'archive'
                                  ? `${theme.brandAccent}33`
                                  : theme.surfaceElevated,
                              color:
                                art.status === 'archive' ? theme.brandAccent : theme.textSecondary,
                            }}
                            title={art.status === 'archive' ? 'Unarchive to Inbox' : 'Archive'}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleDeleteArticle(e, art)}
                            className="rounded-lg p-1.5 text-red-500/80 transition-colors hover:bg-red-500/10"
                            style={{ backgroundColor: theme.surfaceElevated }}
                            title="Delete offline copy"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Offline Hero Thumbnail */}
                    {art.hero_image_uri && (
                      <img
                        src={art.hero_image_uri}
                        alt={art.title}
                        className="h-24 w-full shrink-0 rounded-xl border object-cover sm:h-24 sm:w-32"
                        style={{ borderColor: theme.borderSubtle }}
                      />
                    )}
                  </div>

                  {/* Thin Bottom Progress Bar showing exact reading progress */}
                  <div className="h-1 w-full" style={{ backgroundColor: theme.surfaceElevated }}>
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: theme.brandAccent,
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 15-Language Built-in Localization & Translator Modal */}
      {isLanguageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setIsLanguageModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border p-6 shadow-2xl"
            style={{
              backgroundColor: theme.surfaceCard,
              borderColor: theme.borderSubtle,
              color: theme.textPrimary,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5" style={{ color: theme.brandAccent }} />
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: FONT_FAMILIES.serif.cssFamily }}
                >
                  {ui.appLanguageLabel}
                </h3>
              </div>
              <button
                onClick={() => setIsLanguageModalOpen(false)}
                className="rounded-full p-1"
                style={{ color: theme.textSecondary }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-xs" style={{ color: theme.textSecondary }}>
              Select your preferred language for the Folia interface, full-article bilingual
              translation, and native Text-to-Speech voice synthesis:
            </p>

            <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = settings.app_language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang.code)}
                    className="flex items-center gap-2 rounded-2xl border p-2.5 text-left transition-all"
                    style={{
                      backgroundColor: active ? theme.brandAccent : theme.surfaceElevated,
                      color: active ? theme.brandAccentText : theme.textPrimary,
                      borderColor: active ? theme.brandAccent : theme.borderSubtle,
                    }}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold">{lang.nativeName}</div>
                      <div className="truncate text-[10px] opacity-75">{lang.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Save URL / Offline Article Parser Modal */}
      {isSaveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setIsSaveModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border p-6 shadow-2xl"
            style={{
              backgroundColor: theme.surfaceCard,
              borderColor: theme.borderSubtle,
              color: theme.textPrimary,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" style={{ color: theme.brandAccent }} />
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: FONT_FAMILIES.serif.cssFamily }}
                >
                  Save Web Article for Offline Reading
                </h3>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="rounded-full p-1"
                style={{ color: theme.textSecondary }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-xs leading-relaxed" style={{ color: theme.textSecondary }}>
              Folia fetches the URL directly on your device, strips ads, popups, and tracking
              scripts, and stores clean paragraphs in your local SQLite database.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuickSaveUrl(urlInput, customTitleInput, customBodyInput);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold">Article URL *</label>
                <input
                  type="text"
                  required
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://paulgraham.com/read.html"
                  autoFocus
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                  style={{
                    backgroundColor: theme.backgroundPrimary,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary,
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Custom Title{' '}
                  <span className="font-normal opacity-70">(Optional — auto-detected)</span>
                </label>
                <input
                  type="text"
                  value={customTitleInput}
                  onChange={(e) => setCustomTitleInput(e.target.value)}
                  placeholder="Leave blank to extract og:title automatically"
                  className="w-full rounded-xl border px-3.5 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: theme.backgroundPrimary,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary,
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Paste Article Text{' '}
                  <span className="font-normal opacity-70">
                    (Optional — for paywalled or offline notes)
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={customBodyInput}
                  onChange={(e) => setCustomBodyInput(e.target.value)}
                  placeholder="Optionally paste raw article text here to format directly into a distraction-free offline edition..."
                  className="w-full rounded-xl border p-3 text-xs outline-none"
                  style={{
                    backgroundColor: theme.backgroundPrimary,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary,
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold"
                  style={{
                    backgroundColor: theme.surfaceElevated,
                    color: theme.textSecondary,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUrl}
                  className="rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm"
                  style={{
                    backgroundColor: theme.brandAccent,
                    color: theme.brandAccentText,
                  }}
                >
                  {isSavingUrl ? 'Parsing On-Device...' : '⚡ Parse & Save Offline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
