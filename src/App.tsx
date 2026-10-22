import React, { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db/database';
import {
  ArticleRecord,
  HighlightRecord,
  ReaderSettingsRecord,
  TagRecord,
} from '../db/schema';
import { THEMES, ThemeMode } from '../constants/theme';
import { LANGUAGE_MAP, UI_TRANSLATIONS } from '../constants/i18n';
import { checkClipboardForNewUrl } from '../utils/clipboardDetector';
import { triggerHaptic } from '../utils/haptics';
import { LibraryScreen } from '../components/LibraryScreen';
import { ReaderView } from '../components/ReaderView';
import { HighlightsHubScreen } from '../components/HighlightsHubScreen';
import { SettingsScreen } from '../components/SettingsScreen';
import { BookOpen, Sparkles, SlidersHorizontal, Sun, Moon, ScrollText } from 'lucide-react';

type ActiveTab = 'library' | 'highlights' | 'settings';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<ReaderSettingsRecord>(() => db.getSettings());
  const [articles, setArticles] = useState<ArticleRecord[]>(() => db.getAllArticles());
  const [highlights, setHighlights] = useState<HighlightRecord[]>(() => db.getAllHighlights());
  const [tags, setTags] = useState<TagRecord[]>(() => db.getAllTags());

  const [activeTab, setActiveTab] = useState<ActiveTab>('library');
  const [activeReaderArticleId, setActiveReaderArticleId] = useState<string | null>(null);
  const [readerJumpBlock, setReaderJumpBlock] = useState<number | null>(null);

  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const dismissedClipboardUrlsRef = useRef<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const refreshAllData = useCallback(() => {
    setSettings(db.getSettings());
    setArticles(db.getAllArticles());
    setHighlights(db.getAllHighlights());
    setTags(db.getAllTags());
  }, []);

  // Support deep-link / query params for instant showcase & OS Share Sheet intents
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const screenParam = params.get('screen');
    const themeParam = params.get('theme') as ThemeMode | null;
    const sharedUrl = params.get('url') || params.get('text');

    if (themeParam && (themeParam === 'paper' || themeParam === 'sepia' || themeParam === 'dark')) {
      const updated = db.updateSettings({ theme_mode: themeParam });
      setSettings(updated);
    }

    if (screenParam === 'reader') {
      const first = db.getAllArticles()[0];
      if (first) setActiveReaderArticleId(first.id);
    } else if (screenParam === 'highlights') {
      setActiveTab('highlights');
    } else if (screenParam === 'settings') {
      setActiveTab('settings');
    } else if (screenParam === 'library') {
      setActiveTab('library');
    }

    if (sharedUrl && sharedUrl.startsWith('http')) {
      setClipboardUrl(sharedUrl);
    }
  }, []);

  // Algorithm B: Smart Clipboard URL Detector on app foreground / focus
  useEffect(() => {
    const runClipboardCheck = async () => {
      const detected = await checkClipboardForNewUrl(dismissedClipboardUrlsRef.current);
      if (detected) {
        setClipboardUrl(detected);
      }
    };
    runClipboardCheck();
    window.addEventListener('focus', runClipboardCheck);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') runClipboardCheck();
    });
    return () => {
      window.removeEventListener('focus', runClipboardCheck);
    };
  }, []);

  const handleUpdateSettings = (patch: Partial<ReaderSettingsRecord>) => {
    const next = db.updateSettings(patch);
    setSettings(next);
  };

  const handleCycleQuickTheme = () => {
    triggerHaptic('light');
    const order: ThemeMode[] = ['paper', 'sepia', 'dark'];
    const nextMode = order[(order.indexOf(settings.theme_mode) + 1) % order.length];
    handleUpdateSettings({ theme_mode: nextMode });
    showToast(`${THEMES[nextMode].icon} Switched to ${THEMES[nextMode].subtitle}`);
  };

  const theme = THEMES[settings.theme_mode] || THEMES.paper;
  const langSpec = LANGUAGE_MAP[settings.app_language || 'en'] || LANGUAGE_MAP.en;
  const ui = UI_TRANSLATIONS[settings.app_language || 'en'] || UI_TRANSLATIONS.en;

  const activeArticle = activeReaderArticleId
    ? articles.find((a) => a.id === activeReaderArticleId) || null
    : null;

  return (
    <div
      dir={langSpec.dir}
      className="relative flex h-full w-full flex-col select-none overflow-hidden transition-colors duration-200"
      style={{
        backgroundColor: theme.backgroundPrimary,
        color: theme.textPrimary,
      }}
    >
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className="fixed top-4 right-4 left-4 z-50 mx-auto max-w-md rounded-2xl border px-4 py-2.5 text-center text-xs font-semibold shadow-xl transition-all"
          style={{
            backgroundColor: theme.surfaceCard,
            borderColor: theme.brandAccent,
            color: theme.textPrimary,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Full-Screen Distraction-Free Reader Route OR 3-Tab Main Navigation */}
      {activeArticle ? (
        <ReaderView
          article={activeArticle}
          settings={settings}
          theme={theme}
          initialBlockIndex={readerJumpBlock}
          onBack={() => {
            setActiveReaderArticleId(null);
            setReaderJumpBlock(null);
            refreshAllData();
          }}
          onUpdateSettings={handleUpdateSettings}
          onDataChanged={refreshAllData}
          onToast={showToast}
        />
      ) : (
        <>
          <main className="flex-1 overflow-hidden">
            {activeTab === 'library' && (
              <LibraryScreen
                articles={articles}
                highlights={highlights}
                tags={tags}
                settings={settings}
                theme={theme}
                clipboardDetectedUrl={clipboardUrl}
                onDismissClipboardUrl={(u) => {
                  dismissedClipboardUrlsRef.current.add(u);
                  setClipboardUrl(null);
                }}
                onSelectArticle={(art, blockIdx) => {
                  triggerHaptic('light');
                  setReaderJumpBlock(blockIdx ?? null);
                  setActiveReaderArticleId(art.id);
                }}
                onUpdateSettings={handleUpdateSettings}
                onDataChanged={refreshAllData}
                onToast={showToast}
              />
            )}

            {activeTab === 'highlights' && (
              <HighlightsHubScreen
                articles={articles}
                highlights={highlights}
                theme={theme}
                themeMode={settings.theme_mode}
                onJumpToHighlight={(art, blockIdx) => {
                  triggerHaptic('light');
                  setReaderJumpBlock(blockIdx);
                  setActiveReaderArticleId(art.id);
                }}
                onDataChanged={refreshAllData}
                onToast={showToast}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsScreen
                articles={articles}
                highlights={highlights}
                settings={settings}
                theme={theme}
                onUpdateSettings={handleUpdateSettings}
                onDataChanged={refreshAllData}
                onToast={showToast}
              />
            )}
          </main>

          {/* 3-Tab Bottom Navigation Bar + Quick Theme Switcher */}
          <nav
            className="fixed right-0 bottom-0 left-0 z-30 border-t px-4 py-2 backdrop-blur-md"
            style={{
              backgroundColor: `${theme.surfaceCard}F2`,
              borderColor: theme.borderSubtle,
            }}
          >
            <div className="mx-auto flex max-w-xl items-center justify-around">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('library');
                }}
                className="flex flex-col items-center gap-1 rounded-2xl px-4 py-1.5 transition-colors"
                style={{
                  color: activeTab === 'library' ? theme.brandAccent : theme.textSecondary,
                }}
              >
                <BookOpen className="h-5 w-5" />
                <span className="text-[11px] font-bold">{ui.tabLibrary}</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('highlights');
                }}
                className="relative flex flex-col items-center gap-1 rounded-2xl px-4 py-1.5 transition-colors"
                style={{
                  color: activeTab === 'highlights' ? theme.brandAccent : theme.textSecondary,
                }}
              >
                <Sparkles className="h-5 w-5" />
                <span className="text-[11px] font-bold">
                  {ui.tabHighlights} ({highlights.length})
                </span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('settings');
                }}
                className="flex flex-col items-center gap-1 rounded-2xl px-4 py-1.5 transition-colors"
                style={{
                  color: activeTab === 'settings' ? theme.brandAccent : theme.textSecondary,
                }}
              >
                <SlidersHorizontal className="h-5 w-5" />
                <span className="text-[11px] font-bold">{ui.tabSettings}</span>
              </button>

              <button
                onClick={handleCycleQuickTheme}
                className="flex flex-col items-center gap-1 rounded-2xl border px-3 py-1.5 transition-colors"
                style={{
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.borderSubtle,
                  color: theme.textPrimary,
                }}
                title="Cycle Paper / Sepia / Ink Theme"
              >
                {settings.theme_mode === 'paper' ? (
                  <Sun className="h-4 w-4" />
                ) : settings.theme_mode === 'sepia' ? (
                  <ScrollText className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                <span className="text-[10px] font-semibold capitalize">
                  {settings.theme_mode}
                </span>
              </button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
};

export default App;
