import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArticleRecord,
  ContentBlock,
  HighlightRecord,
  ReaderSettingsRecord,
} from '../db/schema';
import {
  FONT_FAMILIES,
  HIGHLIGHT_PALETTE,
  HighlightColor,
  ThemeTokens,
} from '../constants/theme';
import {
  LANGUAGE_MAP,
  LanguageCode,
  SUPPORTED_LANGUAGES,
  UI_TRANSLATIONS,
} from '../constants/i18n';
import { db } from '../db/database';
import { ttsController, TTSState } from '../utils/ttsController';
import { formatArticleMarkdown, shareOrDownloadFile } from '../utils/exporters';
import {
   getCachedArticleTranslation,
  TranslatedArticlePayload,
  translateFullArticle,
  translateSingleText,
} from '../utils/translator';
import { triggerHaptic } from '../utils/haptics';
import { TypographySheet } from './TypographySheet';
import {
  ArrowLeft,
  Headphones,
  Share2,
  MessageSquare,
  Copy,
  Volume2,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Trash2,
  Check,
  Sparkles,
  BookOpen,
  Clock,
  Tag,
  Globe,
  Languages,
  X,
} from 'lucide-react';

interface ReaderViewProps {
  article: ArticleRecord;
  settings: ReaderSettingsRecord;
  theme: ThemeTokens;
  initialBlockIndex?: number | null;
  onBack: () => void;
  onUpdateSettings: (patch: Partial<ReaderSettingsRecord>) => void;
  onDataChanged: () => void;
  onToast: (msg: string) => void;
}

type TranslationViewMode = 'original' | 'bilingual' | 'translated';

export const ReaderView: React.FC<ReaderViewProps> = ({
  article,
  settings,
  theme,
  initialBlockIndex,
  onBack,
  onUpdateSettings,
  onDataChanged,
  onToast,
}) => {
  const ui = UI_TRANSLATIONS[settings.app_language || 'en'] || UI_TRANSLATIONS.en;

  const blocks: ContentBlock[] = useMemo(() => {
    try {
      return JSON.parse(article.content_blocks_json) as ContentBlock[];
    } catch {
      return [{ index: 0, type: 'p', text: article.plain_text }];
    }
  }, [article.content_blocks_json, article.plain_text]);

  const [highlights, setHighlights] = useState<HighlightRecord[]>(() =>
    db.getHighlightsForArticle(article.id)
  );
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [editingNoteBlockIndex, setEditingNoteBlockIndex] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isTypographyOpen, setIsTypographyOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(article.scroll_progress || 0);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [articleTags, setArticleTags] = useState<string[]>(() =>
    article.tags_csv
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  );
  const [ttsState, setTtsState] = useState<TTSState>(() => ttsController.getState());
  const [ttsBarVisible, setTtsBarVisible] = useState(false);

  // Full Article & Block Multi-Language Translation State (Strictly OFF / 'original' by default!)
  const [targetLang, setTargetLang] = useState<LanguageCode>(
    settings.translate_target_lang || 'es'
  );
  const [translationMode, setTranslationMode] = useState<TranslationViewMode>('original');
  const [isTranslationDrawerOpen, setIsTranslationDrawerOpen] = useState(false);
  const [isTranslatingArticle, setIsTranslatingArticle] = useState(false);
  const [articleTranslation, setArticleTranslation] = useState<TranslatedArticlePayload | null>(
    null
  );
  const [singleBlockTranslations, setSingleBlockTranslations] = useState<Record<number, string>>({});

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Build active blocks for TTS (uses translated blocks only when user explicitly activates translation)
  const activeTtsBlocks = useMemo(() => {
    if (translationMode !== 'original' && articleTranslation) {
      return blocks.map((b) => ({
        ...b,
        text: articleTranslation.translatedBlocks[b.index] || b.text,
      }));
    }
    return blocks;
  }, [blocks, translationMode, articleTranslation]);

  // Initialize TTS & reset translation to Original when opening an article
  useEffect(() => {
    setTranslationMode('original');
    setArticleTranslation(null);
    setSingleBlockTranslations({});
    ttsController.loadBlocks(blocks, settings.tts_rate, 'en');
    const unsub = ttsController.subscribe((st) => {
      setTtsState(st);
      if (st.isPlaying) {
        setTtsBarVisible(true);
        const node = blockRefs.current[st.activeBlockIndex];
        if (node) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
    return () => {
      unsub();
      ttsController.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id]);

  // Sync updated blocks or explicit translation language to TTS without stopping active playback
  useEffect(() => {
    const activeVoiceLang: LanguageCode =
      translationMode !== 'original' ? targetLang : 'en';
    ttsController.updateBlocks(activeTtsBlocks, activeVoiceLang);
  }, [activeTtsBlocks, targetLang, translationMode]);

  useEffect(() => {
    if (initialBlockIndex !== undefined && initialBlockIndex !== null) {
      setTimeout(() => {
        const el = blockRefs.current[initialBlockIndex];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setSelectedBlockIndex(initialBlockIndex);
        }
      }, 150);
    }
  }, [initialBlockIndex]);

  const handleRunFullTranslation = async (lang: LanguageCode, mode: TranslationViewMode = 'bilingual') => {
    triggerHaptic('medium');
    setTargetLang(lang);
    onUpdateSettings({ translate_target_lang: lang });
    setIsTranslatingArticle(true);
    try {
      const result = await translateFullArticle(article.id, article.title, blocks, lang);
      setArticleTranslation(result);
      setTranslationMode(mode);
      const spec = LANGUAGE_MAP[lang];
      triggerHaptic('success');
      onToast(`${spec.flag} Translated full article to ${spec.nativeName} (${spec.name})`);
    } finally {
      setIsTranslatingArticle(false);
    }
  };

  const handleTranslateSingleBlock = async (block: ContentBlock) => {
    triggerHaptic('light');
    const spec = LANGUAGE_MAP[targetLang];
    onToast(`${spec.flag} Translating paragraph to ${spec.nativeName}...`);
    const translated = await translateSingleText(block.text, targetLang);
    setSingleBlockTranslations((prev) => ({
      ...prev,
      [block.index]: translated,
    }));
  };

  const refreshHighlights = () => {
    setHighlights(db.getHighlightsForArticle(article.id));
    onDataChanged();
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const currentTop = target.scrollTop;
    const maxScroll = Math.max(1, target.scrollHeight - target.clientHeight);
    const ratio = Math.max(0, Math.min(1, currentTop / maxScroll));
    setScrollProgress(ratio);

    if (currentTop > lastScrollTopRef.current + 18 && currentTop > 90) {
      setHeaderHidden(true);
    } else if (currentTop < lastScrollTopRef.current - 12 || currentTop < 60) {
      setHeaderHidden(false);
    }
    lastScrollTopRef.current = currentTop;

    db.updateArticleProgress(article.id, ratio);
  };

  const handleApplyHighlight = (block: ContentBlock, color: HighlightColor) => {
    triggerHaptic('medium');
    const existing = highlights.find((h) => h.block_index === block.index);
    db.upsertHighlight({
      article_id: article.id,
      block_index: block.index,
      highlighted_text: block.text,
      color,
      note: existing?.note ?? null,
    });
    refreshHighlights();
    onToast(`${HIGHLIGHT_PALETTE[color].emoji} Highlight saved (${HIGHLIGHT_PALETTE[color].purpose})`);
  };

  const handleRemoveHighlight = (blockIndex: number) => {
    const existing = highlights.find((h) => h.block_index === blockIndex);
    if (!existing) return;
    triggerHaptic('light');
    db.deleteHighlight(existing.id);
    refreshHighlights();
    setSelectedBlockIndex(null);
    setEditingNoteBlockIndex(null);
    onToast('Highlight removed');
  };

  const handleOpenNoteEditor = (block: ContentBlock) => {
    triggerHaptic('light');
    let existing = highlights.find((h) => h.block_index === block.index);
    if (!existing) {
      existing = db.upsertHighlight({
        article_id: article.id,
        block_index: block.index,
        highlighted_text: block.text,
        color: 'yellow',
        note: null,
      });
      refreshHighlights();
    }
    setNoteDraft(existing.note || '');
    setEditingNoteBlockIndex(block.index);
  };

  const handleSaveMarginNote = (block: ContentBlock) => {
    triggerHaptic('success');
    const existing = highlights.find((h) => h.block_index === block.index);
    db.upsertHighlight({
      article_id: article.id,
      block_index: block.index,
      highlighted_text: block.text,
      color: existing?.color || 'yellow',
      note: noteDraft.trim() || null,
    });
    setEditingNoteBlockIndex(null);
    refreshHighlights();
    onToast('💬 Margin note saved to SQLite');
  };

  const handleCopyParagraph = async (text: string) => {
    triggerHaptic('light');
    try {
      await navigator.clipboard.writeText(text);
      onToast('📋 Paragraph copied to clipboard');
    } catch {
      onToast('📋 Copied text');
    }
    setSelectedBlockIndex(null);
  };

  const handleResetToOriginalLanguage = () => {
    triggerHaptic('light');
    setTranslationMode('original');
    setSingleBlockTranslations({});
    onToast('🌐 Original language restored (Translation Off)');
  };

  const handleReadFromHere = (blockIndex: number) => {
    triggerHaptic('light');
    setTtsBarVisible(true);
    ttsController.startFromBlock(blockIndex);
    setSelectedBlockIndex(null);
    onToast(`🔊 Reading aloud from paragraph ${blockIndex + 1}`);
  };

  const handleStartListenTop = () => {
    triggerHaptic('light');
    setTtsBarVisible(true);
    if (ttsState.isPlaying) {
      ttsController.togglePlayPause();
    } else {
      ttsController.startFromBlock(ttsState.activeBlockIndex || 0);
      onToast('🔊 Audio narration started');
    }
  };

  const handleCycleSpeed = () => {
    triggerHaptic('light');
    const next = ttsController.cycleRate();
    onUpdateSettings({ tts_rate: next });
  };

  const handleExportMarkdown = async () => {
    triggerHaptic('success');
    const md = formatArticleMarkdown(article, highlights);
    const safeSlug = article.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    await shareOrDownloadFile(`${safeSlug || 'folia-notes'}.md`, md);
    onToast('📤 Exported clean Markdown (.md) for Obsidian / Notion');
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTagText.trim().toLowerCase().replace(/^#/, '');
    if (!cleaned) return;
    const next = Array.from(new Set([...articleTags, cleaned]));
    setArticleTags(next);
    db.updateArticleTags(article.id, next);
    setNewTagText('');
    setShowAddTagInput(false);
    onDataChanged();
    onToast(`Added #${cleaned}`);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const next = articleTags.filter((t) => t !== tagToRemove);
    setArticleTags(next);
    db.updateArticleTags(article.id, next);
    onDataChanged();
  };

  const isDark = settings.theme_mode === 'dark';
  const fontSpec = FONT_FAMILIES[settings.font_family];
  const progressPercent = Math.round(scrollProgress * 100);
  const targetLangSpec = LANGUAGE_MAP[targetLang] || LANGUAGE_MAP.es;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden transition-colors duration-200"
      style={{
        backgroundColor: theme.backgroundPrimary,
        color: theme.textPrimary,
      }}
    >
      {/* Top Reading Progress Bar */}
      <div className="z-30 h-1 w-full" style={{ backgroundColor: theme.borderSubtle }}>
        <div
          className="h-full transition-all duration-150"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: theme.brandAccent,
          }}
        />
      </div>

      {/* Top Minimal Bar (Auto-hides on scroll down) */}
      <header
        className={`z-20 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 transition-all duration-200 sm:px-5 ${
          headerHidden ? '-translate-y-full opacity-0 pointer-events-none h-0 py-0 border-none' : 'translate-y-0 opacity-100'
        }`}
        style={{
          backgroundColor: theme.backgroundPrimary,
          borderColor: theme.borderSubtle,
        }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onDataChanged();
              onBack();
            }}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: theme.surfaceElevated,
              color: theme.textPrimary,
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{ui.tabLibrary}</span>
          </button>
          <span
            className="hidden rounded-lg px-2 py-0.5 font-mono text-xs font-semibold sm:inline-block"
            style={{
              backgroundColor: theme.surfaceElevated,
              color: theme.textSecondary,
            }}
          >
            {progressPercent}% {ui.readPct}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Built-in Full Article Multi-Language Translator Button */}
          <button
            onClick={() => setIsTranslationDrawerOpen(!isTranslationDrawerOpen)}
            className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all"
            style={{
              backgroundColor:
                translationMode !== 'original' || isTranslationDrawerOpen
                  ? theme.brandAccent
                  : theme.surfaceElevated,
              color:
                translationMode !== 'original' || isTranslationDrawerOpen
                  ? theme.brandAccentText
                  : theme.textPrimary,
              borderColor:
                translationMode !== 'original' ? theme.brandAccent : theme.borderSubtle,
            }}
            title="Translate Full Article (15 Main Languages)"
          >
            <Languages className="h-3.5 w-3.5" />
            <span>
              {isTranslatingArticle
                ? ui.translating
                : translationMode !== 'original'
                ? `${targetLangSpec.flag} ${targetLangSpec.nativeName}`
                : `🌐 ${ui.translateArticle}`}
            </span>
          </button>

          <button
            onClick={handleStartListenTop}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all"
            style={{
              backgroundColor: ttsState.isPlaying ? theme.brandAccent : theme.surfaceElevated,
              color: ttsState.isPlaying ? theme.brandAccentText : theme.textPrimary,
            }}
          >
            <Headphones className="h-3.5 w-3.5" />
            <span>{ttsState.isPlaying ? ui.listening : ui.listen}</span>
          </button>

          <button
            onClick={() => setIsTypographyOpen(true)}
            className="rounded-xl border px-2.5 py-1.5 font-serif text-xs font-bold transition-colors"
            style={{
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.borderSubtle,
              color: theme.textPrimary,
            }}
            title="Typography & Theme"
          >
            Aa
          </button>

          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: theme.brandAccent,
              color: theme.brandAccentText,
            }}
            title="Export to Obsidian / Notion Markdown (.md)"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>{ui.exportMd}</span>
          </button>
        </div>
      </header>

      {/* Collapsible Built-In Multi-Language Full Translation Bar */}
      {isTranslationDrawerOpen && (
        <div
          className="z-20 border-b px-4 py-3 shadow-md transition-all"
          style={{
            backgroundColor: theme.surfaceCard,
            borderColor: theme.brandAccent,
          }}
        >
          <div className="mx-auto max-w-2xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Globe className="h-4 w-4" style={{ color: theme.brandAccent }} />
                <span>Built-In Full Article Translator (15 Languages • Offline Cached)</span>
              </div>

              {/* View Mode Switcher: Original | Bilingual Side-by-Side | Translated Full Text */}
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'original', label: `${ui.originalLanguage} (Off)` },
                    { id: 'bilingual', label: ui.bilingualMode },
                    { id: 'translated', label: ui.translatedOnly },
                  ] as const
                ).map((m) => {
                  const active = translationMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (m.id === 'original') {
                          handleResetToOriginalLanguage();
                        } else {
                          handleRunFullTranslation(targetLang, m.id);
                        }
                      }}
                      className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all"
                      style={{
                        backgroundColor: active ? theme.brandAccent : theme.surfaceElevated,
                        color: active ? theme.brandAccentText : theme.textPrimary,
                        borderColor: active ? theme.brandAccent : theme.borderSubtle,
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 15 Main Global Languages Horizontal Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelectedLang = targetLang === lang.code && translationMode !== 'original';
                return (
                  <button
                    key={lang.code}
                    onClick={() =>
                      handleRunFullTranslation(
                        lang.code,
                        translationMode === 'original' ? 'bilingual' : translationMode
                      )
                    }
                    className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: isSelectedLang ? theme.brandAccent : theme.surfaceElevated,
                      color: isSelectedLang ? theme.brandAccentText : theme.textPrimary,
                      borderColor: isSelectedLang ? theme.brandAccent : theme.borderSubtle,
                    }}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.nativeName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Distraction-Free Clean Body Canvas */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 pt-6 pb-36 sm:px-10"
      >
        <article className="mx-auto max-w-2xl">
          {/* Article Header Metadata */}
          <div className="mb-6 border-b pb-6" style={{ borderColor: theme.borderSubtle }}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: theme.surfaceElevated,
                  color: theme.brandAccent,
                }}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {article.domain}
              </span>
              <span
                className="inline-flex items-center gap-1 text-xs"
                style={{ color: theme.textSecondary }}
              >
                <Clock className="h-3.5 w-3.5" />
                {article.reading_time_minutes} {ui.minRead} • {article.word_count.toLocaleString()} words
              </span>
            </div>

            <h1
              className="mb-2 text-2xl leading-tight font-bold sm:text-3xl"
              style={{
                fontFamily: FONT_FAMILIES.serif.cssFamily,
                color: theme.textPrimary,
              }}
            >
              {translationMode === 'translated' && articleTranslation
                ? articleTranslation.translatedTitle
                : article.title}
            </h1>

            {/* Active Translation Banner with 1-Tap Reset to Original */}
            {(translationMode !== 'original' || Object.keys(singleBlockTranslations).length > 0) && (
              <div
                className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                style={{
                  backgroundColor: `${theme.brandAccent}15`,
                  borderColor: theme.brandAccent,
                  color: theme.textPrimary,
                }}
              >
                <span className="font-semibold">
                  {targetLangSpec.flag} Translation Active ({targetLangSpec.nativeName} — {targetLangSpec.name})
                </span>
                <button
                  onClick={handleResetToOriginalLanguage}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: theme.brandAccent,
                    color: theme.brandAccentText,
                  }}
                >
                  Show Original (Turn Off)
                </button>
              </div>
            )}

            {/* Bilingual Translated Title Sub-heading */}
            {translationMode === 'bilingual' && articleTranslation && (
              <div
                dir={targetLangSpec.dir}
                className="mb-3 rounded-xl border-l-4 px-3 py-2 text-lg font-bold"
                style={{
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.brandAccent,
                  color: theme.brandAccent,
                  fontFamily: FONT_FAMILIES.serif.cssFamily,
                }}
              >
                {targetLangSpec.flag} {articleTranslation.translatedTitle}
              </div>
            )}

            <div
              className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
              style={{ color: theme.textSecondary }}
            >
              {article.author && <span className="font-medium">By {article.author}</span>}
              <span>•</span>
              <span>Saved {new Date(article.created_at).toLocaleDateString()}</span>
              <span>•</span>
              <span className="font-medium" style={{ color: theme.brandAccent }}>
                ✨ {highlights.length} {ui.highlightsCount}
              </span>
            </div>

            {/* Tags row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {articleTags.map((t) => (
                <span
                  key={t}
                  onClick={() => handleRemoveTag(t)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-75"
                  style={{
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary,
                  }}
                  title="Tap to remove tag"
                >
                  #{t}
                </span>
              ))}

              {showAddTagInput ? (
                <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newTagText}
                    onChange={(e) => setNewTagText(e.target.value)}
                    placeholder="tag name..."
                    autoFocus
                    className="w-24 rounded-full border px-2.5 py-0.5 text-xs outline-none"
                    style={{
                      backgroundColor: theme.surfaceCard,
                      borderColor: theme.brandAccent,
                      color: theme.textPrimary,
                    }}
                  />
                  <button
                    type="submit"
                    className="rounded-full p-1"
                    style={{ backgroundColor: theme.brandAccent, color: theme.brandAccentText }}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddTagInput(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary,
                  }}
                >
                  <Tag className="h-3 w-3" /> + Add Tag
                </button>
              )}
            </div>

            {/* Offline Cached Hero Image */}
            {article.hero_image_uri && (
              <div
                className="mt-5 overflow-hidden rounded-2xl border"
                style={{ borderColor: theme.borderSubtle }}
              >
                <img
                  src={article.hero_image_uri}
                  alt={article.title}
                  className="h-44 w-full object-cover sm:h-56"
                />
              </div>
            )}
          </div>

          {/* Interactive Helper Tip */}
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs"
            style={{
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.borderSubtle,
              color: theme.textSecondary,
            }}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: theme.brandAccent }} />
              Tap any paragraph to highlight in 4 pastel colors, add a note, translate, or listen.
            </span>
          </div>

          {/* Structured Content Blocks */}
          <div
            className="space-y-5"
            style={{
              fontFamily: fontSpec.cssFamily,
              fontSize: `${settings.font_size}px`,
              lineHeight: settings.line_height,
            }}
          >
            {blocks.map((block) => {
              const highlight = highlights.find((h) => h.block_index === block.index);
              const isSelected = selectedBlockIndex === block.index;
              const isTtsActive = ttsBarVisible && ttsState.activeBlockIndex === block.index;
              const isEditingNote = editingNoteBlockIndex === block.index;

              const hlColorSpec = highlight ? HIGHLIGHT_PALETTE[highlight.color] : null;
              const highlightBg = hlColorSpec
                ? isDark
                  ? hlColorSpec.darkBg
                  : hlColorSpec.lightBg
                : 'transparent';

              const translatedBlockText =
                translationMode !== 'original'
                  ? articleTranslation?.translatedBlocks[block.index] ||
                    singleBlockTranslations[block.index] ||
                    null
                  : singleBlockTranslations[block.index] || null;

              const displayPrimaryText =
                translationMode === 'translated' && translatedBlockText
                  ? translatedBlockText
                  : block.text;

              const primaryDir =
                translationMode === 'translated' && translatedBlockText
                  ? targetLangSpec.dir
                  : 'ltr';

              return (
                <div
                  key={block.index}
                  ref={(el) => {
                    blockRefs.current[block.index] = el;
                  }}
                  className="relative transition-all duration-150"
                >
                  {/* Floating Highlight, Note, Translate & TTS Pill Bar (Algorithm C) */}
                  {isSelected && (
                    <div
                      className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-2 shadow-lg"
                      style={{
                        backgroundColor: theme.surfaceCard,
                        borderColor: theme.brandAccent,
                      }}
                    >
                      {/* 4 Pastel Marker Buttons */}
                      <div className="flex items-center gap-1.5">
                        {(['yellow', 'green', 'blue', 'purple'] as HighlightColor[]).map((c) => {
                          const spec = HIGHLIGHT_PALETTE[c];
                          const activeColor = highlight?.color === c;
                          return (
                            <button
                              key={c}
                              onClick={() => handleApplyHighlight(block, c)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
                              style={{
                                backgroundColor: spec.lightBg,
                                borderColor: activeColor ? '#1C1B18' : spec.borderHex,
                              }}
                              title={`${spec.label}: ${spec.purpose}`}
                            >
                              <span className="text-xs">{spec.emoji}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="h-5 w-px" style={{ backgroundColor: theme.borderSubtle }} />

                      {/* Action Pill Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 font-sans text-xs font-semibold">
                        <button
                          onClick={() => handleOpenNoteEditor(block)}
                          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 transition-colors"
                          style={{
                            backgroundColor: theme.surfaceElevated,
                            color: theme.textPrimary,
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{highlight?.note ? ui.editNote : ui.addNote}</span>
                        </button>

                        <button
                          onClick={() => handleTranslateSingleBlock(block)}
                          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 transition-colors"
                          style={{
                            backgroundColor: theme.surfaceElevated,
                            color: theme.brandAccent,
                          }}
                        >
                          <Languages className="h-3.5 w-3.5" />
                          <span>
                            {targetLangSpec.flag} {ui.translateBlock}
                          </span>
                        </button>

                        <button
                          onClick={() => handleCopyParagraph(displayPrimaryText)}
                          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 transition-colors"
                          style={{
                            backgroundColor: theme.surfaceElevated,
                            color: theme.textPrimary,
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>{ui.copyText}</span>
                        </button>

                        <button
                          onClick={() => handleReadFromHere(block.index)}
                          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 transition-colors"
                          style={{
                            backgroundColor: theme.brandAccent,
                            color: theme.brandAccentText,
                          }}
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>{ui.readHere}</span>
                        </button>

                        {highlight && (
                          <button
                            onClick={() => handleRemoveHighlight(block.index)}
                            className="rounded-xl p-1.5 text-red-500 transition-colors hover:bg-red-500/10"
                            title="Delete highlight"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Paragraph / Heading / Quote / Code Block */}
                  <div
                    dir={primaryDir}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedBlockIndex(isSelected ? null : block.index);
                    }}
                    className={`cursor-pointer rounded-xl px-3 py-2 transition-all ${
                      block.type === 'h1' || block.type === 'h2'
                        ? 'mt-4 font-bold tracking-tight'
                        : block.type === 'blockquote'
                        ? 'border-l-4 pl-4 italic'
                        : block.type === 'code'
                        ? 'overflow-x-auto rounded-xl border p-3.5 font-mono text-sm'
                        : block.type === 'li'
                        ? 'pl-5'
                        : ''
                    }`}
                    style={{
                      backgroundColor: highlight
                        ? highlightBg
                        : isSelected
                        ? theme.surfaceElevated
                        : 'transparent',
                      borderColor:
                        block.type === 'blockquote'
                          ? hlColorSpec?.borderHex || theme.brandAccent
                          : theme.borderSubtle,
                      outline: isTtsActive
                        ? `2px solid ${theme.brandAccent}`
                        : isSelected
                        ? `1px dashed ${theme.borderSubtle}`
                        : 'none',
                      fontSize:
                        block.type === 'h1'
                          ? `${settings.font_size + 6}px`
                          : block.type === 'h2'
                          ? `${settings.font_size + 4}px`
                          : block.type === 'code'
                          ? `${Math.max(13, settings.font_size - 3)}px`
                          : `${settings.font_size}px`,
                    }}
                  >
                    {block.type === 'li' ? `• ${displayPrimaryText}` : displayPrimaryText}
                  </div>

                  {/* Bilingual Translated Paragraph Card (when in Bilingual Mode or Single Block Translated) */}
                  {(translationMode === 'bilingual' || singleBlockTranslations[block.index]) &&
                    translatedBlockText &&
                    translationMode !== 'translated' && (
                      <div
                        dir={targetLangSpec.dir}
                        className="mt-1.5 ml-2 rounded-xl border-l-4 px-3.5 py-2.5 text-sm leading-relaxed"
                        style={{
                          backgroundColor: theme.surfaceElevated,
                          borderColor: theme.brandAccent,
                          color: theme.textPrimary,
                        }}
                      >
                        <span
                          className="mr-1.5 inline-block font-sans text-[10px] font-bold uppercase opacity-75"
                          style={{ color: theme.brandAccent }}
                        >
                          {targetLangSpec.flag} {targetLangSpec.nativeName}:
                        </span>
                        <span>{translatedBlockText}</span>
                      </div>
                    )}

                  {/* Inline Margin Note Editor */}
                  {isEditingNote && (
                    <div
                      className="mt-2 rounded-2xl border p-3 font-sans shadow-md"
                      style={{
                        backgroundColor: theme.surfaceCard,
                        borderColor: theme.brandAccent,
                      }}
                    >
                      <label
                        className="mb-1.5 block text-xs font-bold uppercase"
                        style={{ color: theme.brandAccent }}
                      >
                        💬 Attach Margin Note
                      </label>
                      <textarea
                        rows={2}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Write your synthesis, question, or takeaway..."
                        className="w-full rounded-xl border p-2.5 text-sm outline-none"
                        style={{
                          backgroundColor: theme.backgroundPrimary,
                          borderColor: theme.borderSubtle,
                          color: theme.textPrimary,
                        }}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          onClick={() => setEditingNoteBlockIndex(null)}
                          className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                          style={{
                            backgroundColor: theme.surfaceElevated,
                            color: theme.textSecondary,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveMarginNote(block)}
                          className="rounded-xl px-3.5 py-1.5 text-xs font-semibold"
                          style={{
                            backgroundColor: theme.brandAccent,
                            color: theme.brandAccentText,
                          }}
                        >
                          Save Margin Note
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sleek Callout Card for Saved Margin Note */}
                  {highlight && highlight.note && !isEditingNote && (
                    <div
                      onClick={() => handleOpenNoteEditor(block)}
                      className="mt-2 ml-3 flex cursor-pointer items-start justify-between gap-2 rounded-xl border-l-4 px-3.5 py-2.5 font-sans text-xs shadow-xs transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: theme.surfaceCard,
                        borderColor: hlColorSpec?.borderHex || theme.brandAccent,
                        color: theme.textPrimary,
                      }}
                    >
                      <div>
                        <span
                          className="mr-1.5 font-bold uppercase"
                          style={{ color: hlColorSpec?.borderHex || theme.brandAccent }}
                        >
                          {hlColorSpec?.emoji} Margin Note:
                        </span>
                        <span className="leading-relaxed">{highlight.note}</span>
                      </div>
                      <span
                        className="shrink-0 text-[10px] underline opacity-60"
                        style={{ color: theme.textSecondary }}
                      >
                        Edit
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      </div>

      {/* Persistent Floating Audio Mini-Player (Algorithm D) */}
      {ttsBarVisible && (
        <div
          className="fixed right-4 bottom-5 left-4 z-40 mx-auto flex max-w-lg items-center justify-between rounded-2xl border px-4 py-3 shadow-2xl"
          style={{
            backgroundColor: theme.surfaceCard,
            borderColor: theme.brandAccent,
            color: theme.textPrimary,
          }}
        >
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 animate-pulse rounded-full"
                style={{ backgroundColor: theme.brandAccent }}
              />
              <span className="truncate text-xs font-bold">
                Offline TTS ({translationMode !== 'original' ? targetLangSpec.nativeName : 'Original'}) •{' '}
                {ttsState.activeBlockIndex + 1}/{blocks.length}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px]" style={{ color: theme.textSecondary }}>
              {activeTtsBlocks[ttsState.activeBlockIndex]?.text || article.title}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => ttsController.prevParagraph()}
              className="rounded-xl p-2 transition-colors"
              style={{ backgroundColor: theme.surfaceElevated }}
              title="Previous Paragraph"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={() => ttsController.togglePlayPause()}
              className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-transform active:scale-95"
              style={{
                backgroundColor: theme.brandAccent,
                color: theme.brandAccentText,
              }}
              title={ttsState.isPlaying ? 'Pause' : 'Play'}
            >
              {ttsState.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            <button
              onClick={() => ttsController.nextParagraph()}
              className="rounded-xl p-2 transition-colors"
              style={{ backgroundColor: theme.surfaceElevated }}
              title="Next Paragraph"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <button
              onClick={handleCycleSpeed}
              className="ml-1 rounded-xl border px-2.5 py-1.5 font-mono text-xs font-bold"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.brandAccent,
              }}
              title="Cycle TTS Playback Speed"
            >
              {ttsState.rate}x
            </button>

            <button
              onClick={() => {
                ttsController.stop();
                setTtsBarVisible(false);
              }}
              className="ml-0.5 rounded-xl p-2 transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                color: theme.textSecondary,
              }}
              title="Stop & Close Player"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Typography & Theme Customizer Bottom Sheet */}
      <TypographySheet
        isOpen={isTypographyOpen}
        onClose={() => setIsTypographyOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        theme={theme}
      />
    </div>
  );
};
