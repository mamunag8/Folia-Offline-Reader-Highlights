import React, { useMemo, useState } from 'react';
import { ArticleRecord, HighlightRecord } from '../db/schema';
import {
  FONT_FAMILIES,
  HIGHLIGHT_PALETTE,
  HighlightColor,
  ThemeMode,
  ThemeTokens,
} from '../constants/theme';
import { db } from '../db/database';
import { formatAllHighlightsMarkdown, shareOrDownloadFile } from '../utils/exporters';
import { triggerHaptic } from '../utils/haptics';
import {
  Sparkles,
  Search,
  Share2,
  BookOpen,
  Trash2,
  MessageSquare,
  RefreshCw,
  ArrowUpRight,
  X,
} from 'lucide-react';

interface HighlightsHubScreenProps {
  articles: ArticleRecord[];
  highlights: HighlightRecord[];
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onJumpToHighlight: (article: ArticleRecord, blockIndex: number) => void;
  onDataChanged: () => void;
  onToast: (msg: string) => void;
}

export const HighlightsHubScreen: React.FC<HighlightsHubScreenProps> = ({
  articles,
  highlights,
  theme,
  themeMode,
  onJumpToHighlight,
  onDataChanged,
  onToast,
}) => {
  const [colorFilter, setColorFilter] = useState<HighlightColor | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rediscoverySeed, setRediscoverySeed] = useState(0);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const articleMap = useMemo(() => {
    const map = new Map<string, ArticleRecord>();
    articles.forEach((a) => map.set(a.id, a));
    return map;
  }, [articles]);

  // Daily Rediscovery Carousel: 3 highlights from past reading
  const rediscoveryHighlights = useMemo(() => {
    if (highlights.length === 0) return [];
    const copy = [...highlights];
    if (rediscoverySeed > 0) {
      copy.sort((a, b) =>
        ((a.id.charCodeAt(3) + rediscoverySeed) % 7) -
        ((b.id.charCodeAt(3) + rediscoverySeed) % 7)
      );
    }
    return copy.slice(0, 3);
  }, [highlights, rediscoverySeed]);

  const filteredHighlights = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return highlights.filter((h) => {
      if (colorFilter !== 'all' && h.color !== colorFilter) return false;
      if (!q) return true;
      const art = articleMap.get(h.article_id);
      return (
        h.highlighted_text.toLowerCase().includes(q) ||
        (h.note && h.note.toLowerCase().includes(q)) ||
        (art && art.title.toLowerCase().includes(q))
      );
    });
  }, [highlights, colorFilter, searchQuery, articleMap]);

  const handleBulkExportMarkdown = async () => {
    triggerHaptic('success');
    const md = formatAllHighlightsMarkdown(articles, highlights);
    await shareOrDownloadFile('folia-second-brain-highlights.md', md);
    onToast('📤 Exported all highlights to Markdown (.md) for Obsidian / Notion');
  };

  const handleSaveNote = (id: string) => {
    triggerHaptic('success');
    db.updateHighlightNote(id, noteDraft);
    setEditingNoteId(null);
    onDataChanged();
    onToast('💬 Updated margin note');
  };

  const handleDeleteHighlight = (id: string) => {
    triggerHaptic('light');
    db.deleteHighlight(id);
    onDataChanged();
    onToast('Removed highlight');
  };

  const isDark = themeMode === 'dark';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header
        className="border-b px-4 pt-4 pb-3 sm:px-6"
        style={{
          backgroundColor: theme.backgroundPrimary,
          borderColor: theme.borderSubtle,
        }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: FONT_FAMILIES.serif.cssFamily }}
            >
              My Highlights &amp; Notes
            </h1>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              Your Personal Second Brain • {highlights.length} saved insights across{' '}
              {articles.length} articles
            </p>
          </div>

          <button
            onClick={handleBulkExportMarkdown}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs transition-transform active:scale-95"
            style={{
              backgroundColor: theme.brandAccent,
              color: theme.brandAccentText,
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>📤 Export All to Markdown</span>
          </button>
        </div>

        {/* Search within highlights */}
        <div
          className="mb-3 flex items-center gap-2 rounded-2xl border px-3.5 py-2"
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
            placeholder="Search highlights, margin notes, or source titles..."
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: theme.textPrimary }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ color: theme.textSecondary }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Controls by Marker Color */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => {
              triggerHaptic('light');
              setColorFilter('all');
            }}
            className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-all"
            style={{
              backgroundColor: colorFilter === 'all' ? theme.brandAccent : theme.surfaceCard,
              color: colorFilter === 'all' ? theme.brandAccentText : theme.textPrimary,
              borderColor: colorFilter === 'all' ? theme.brandAccent : theme.borderSubtle,
            }}
          >
            All ({highlights.length})
          </button>

          {(['yellow', 'green', 'blue', 'purple'] as HighlightColor[]).map((color) => {
            const spec = HIGHLIGHT_PALETTE[color];
            const active = colorFilter === color;
            const count = highlights.filter((h) => h.color === color).length;
            return (
              <button
                key={color}
                onClick={() => {
                  triggerHaptic('light');
                  setColorFilter(active ? 'all' : color);
                }}
                className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: active
                    ? isDark
                      ? spec.darkBg
                      : spec.lightBg
                    : theme.surfaceCard,
                  color: active ? (isDark ? '#FFFFFF' : '#1C1B18') : theme.textPrimary,
                  borderColor: active ? spec.borderHex : theme.borderSubtle,
                }}
              >
                {spec.emoji} {spec.label} ({count})
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* ✨ Daily Rediscovery Flashcard Carousel */}
          {rediscoveryHighlights.length > 0 && (
            <section
              className="rounded-3xl border p-4 shadow-xs"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" style={{ color: theme.brandAccent }} />
                  <h2 className="text-xs font-bold tracking-wider uppercase">
                    ✨ Daily Rediscovery — Spaced Review
                  </h2>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setRediscoverySeed((s) => s + 1);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: theme.surfaceCard,
                    color: theme.brandAccent,
                  }}
                >
                  <RefreshCw className="h-3 w-3" /> Shuffle
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {rediscoveryHighlights.map((hl) => {
                  const art = articleMap.get(hl.article_id);
                  const spec = HIGHLIGHT_PALETTE[hl.color];
                  return (
                    <div
                      key={`rediscover-${hl.id}`}
                      onClick={() => art && onJumpToHighlight(art, hl.block_index)}
                      className="flex cursor-pointer flex-col justify-between rounded-2xl border p-3.5 transition-transform hover:-translate-y-0.5"
                      style={{
                        backgroundColor: theme.surfaceCard,
                        borderColor: spec.borderHex,
                      }}
                    >
                      <div>
                        <span className="mb-1.5 inline-block text-[10px] font-bold uppercase opacity-75">
                          {spec.emoji} {spec.purpose}
                        </span>
                        <p
                          className="mb-2 line-clamp-3 text-xs leading-relaxed italic"
                          style={{ fontFamily: FONT_FAMILIES.serif.cssFamily }}
                        >
                          “{hl.highlighted_text}”
                        </p>
                      </div>
                      <div
                        className="mt-1 flex items-center justify-between border-t pt-2 text-[11px] font-semibold"
                        style={{
                          borderColor: theme.borderSubtle,
                          color: theme.brandAccent,
                        }}
                      >
                        <span className="truncate">{art?.title || 'Saved Article'}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* All Highlights & Margin Notes Feed */}
          <div className="space-y-3.5">
            {filteredHighlights.map((hl) => {
              const art = articleMap.get(hl.article_id);
              const spec = HIGHLIGHT_PALETTE[hl.color];
              const isEditing = editingNoteId === hl.id;

              return (
                <div
                  key={hl.id}
                  className="rounded-2xl border p-4 transition-all"
                  style={{
                    backgroundColor: theme.surfaceCard,
                    borderColor: theme.borderSubtle,
                  }}
                >
                  {/* Source Article Header */}
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => art && onJumpToHighlight(art, hl.block_index)}
                      className="flex items-center gap-1.5 text-left text-xs font-bold hover:underline"
                      style={{ color: theme.brandAccent }}
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{art?.title || 'Saved Offline Article'}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    </button>

                    <div className="flex items-center gap-1">
                      {(['yellow', 'green', 'blue', 'purple'] as HighlightColor[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            triggerHaptic('light');
                            db.updateHighlightColor(hl.id, c);
                            onDataChanged();
                          }}
                          className="h-4 w-4 rounded-full border transition-transform hover:scale-110"
                          style={{
                            backgroundColor: HIGHLIGHT_PALETTE[c].dotHex,
                            borderColor: hl.color === c ? '#1C1B18' : 'transparent',
                          }}
                          title={`Change marker to ${HIGHLIGHT_PALETTE[c].label}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Highlighted Quote Block */}
                  <blockquote
                    onClick={() => art && onJumpToHighlight(art, hl.block_index)}
                    className="cursor-pointer rounded-xl border-l-4 p-3.5 text-sm leading-relaxed"
                    style={{
                      fontFamily: FONT_FAMILIES.serif.cssFamily,
                      backgroundColor: isDark ? spec.darkBg : spec.lightBg,
                      borderColor: spec.borderHex,
                      color: isDark ? '#F9FAFB' : '#1C1B18',
                    }}
                  >
                    “{hl.highlighted_text}”
                  </blockquote>

                  {/* Margin Note or Editor */}
                  {isEditing ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        rows={2}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add your personal margin note..."
                        className="w-full rounded-xl border p-2.5 text-xs outline-none"
                        style={{
                          backgroundColor: theme.backgroundPrimary,
                          borderColor: theme.brandAccent,
                          color: theme.textPrimary,
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="rounded-lg px-3 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: theme.surfaceElevated,
                            color: theme.textSecondary,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveNote(hl.id)}
                          className="rounded-lg px-3 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: theme.brandAccent,
                            color: theme.brandAccentText,
                          }}
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      {hl.note ? (
                        <div
                          onClick={() => {
                            setEditingNoteId(hl.id);
                            setNoteDraft(hl.note || '');
                          }}
                          className="flex-1 cursor-pointer rounded-xl border px-3 py-2 text-xs"
                          style={{
                            backgroundColor: theme.surfaceElevated,
                            borderColor: theme.borderSubtle,
                            color: theme.textPrimary,
                          }}
                        >
                          <span className="mr-1.5 font-bold" style={{ color: theme.brandAccent }}>
                            💬 Margin Note:
                          </span>
                          {hl.note}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingNoteId(hl.id);
                            setNoteDraft('');
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium opacity-75 hover:opacity-100"
                          style={{ color: theme.textSecondary }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> + Add Margin Note
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-[11px]" style={{ color: theme.textSecondary }}>
                          {new Date(hl.created_at).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => handleDeleteHighlight(hl.id)}
                          className="rounded-lg p-1 text-red-500/80 hover:bg-red-500/10"
                          title="Delete highlight"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
