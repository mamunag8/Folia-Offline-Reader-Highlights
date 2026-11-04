import React, { useRef, useState } from 'react';
import {
  ArticleRecord,
  HighlightRecord,
  ReaderSettingsRecord,
} from '../db/schema';
import { FONT_FAMILIES, ThemeTokens } from '../constants/theme';
import {
  LANGUAGE_MAP,
  LanguageCode,
  SUPPORTED_LANGUAGES,
  UI_TRANSLATIONS,
} from '../constants/i18n';
import { db } from '../db/database';
import {
  exportFullLibraryJson,
  importBackupOrCompetitorFile,
  shareOrDownloadFile,
} from '../utils/exporters';
import { triggerHaptic } from '../utils/haptics';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  BookOpen,
  Sparkles,
  FileText,
  RotateCcw,
  Check,
  Code2,
  Globe,
} from 'lucide-react';

interface SettingsScreenProps {
  articles: ArticleRecord[];
  highlights: HighlightRecord[];
  settings: ReaderSettingsRecord;
  theme: ThemeTokens;
  onUpdateSettings: (patch: Partial<ReaderSettingsRecord>) => void;
  onDataChanged: () => void;
  onToast: (msg: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  articles,
  highlights,
  settings,
  theme,
  onUpdateSettings,
  onDataChanged,
  onToast,
}) => {
  const ui = UI_TRANSLATIONS[settings.app_language || 'en'] || UI_TRANSLATIONS.en;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  const totalWordsRead = articles.reduce(
    (acc, a) => acc + Math.round(a.word_count * Math.max(0.25, a.scroll_progress || 0.25)),
    0
  );

  const handleExportJsonBackup = async () => {
    triggerHaptic('success');
    const json = exportFullLibraryJson();
    const dateStr = new Date().toISOString().split('T')[0];
    await shareOrDownloadFile(
      `folia-library-backup-${dateStr}.json`,
      json,
      'application/json;charset=utf-8'
    );
    onToast('📤 Exported full Folia JSON backup');
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = importBackupOrCompetitorFile(file.name, text);
      onDataChanged();
      triggerHaptic('success');
      onToast(
        `📥 Imported ${res.importedArticles} articles & ${res.importedHighlights} highlights (${res.sourceFormat})`
      );
    } catch {
      onToast('Could not parse backup file. Ensure valid JSON, Pocket HTML, or Instapaper CSV.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSimulatePocketImport = () => {
    triggerHaptic('success');
    const samplePocketHtml = `
      <!DOCTYPE html>
      <html><body>
        <h1>Pocket Export</h1>
        <ul>
          <li><a href="https://fs.blog/reading/" tags="reading,mental-models">The Art of Reading Deeply — Farnam Street</a></li>
          <li><a href="https://ciechanow.ski/mechanical-watch/" tags="engineering,design">Mechanical Watch Interactive Breakdown</a></li>
        </ul>
      </body></html>
    `;
    const res = importBackupOrCompetitorFile('ril_export.html', samplePocketHtml);
    onDataChanged();
    onToast(
      `📥 Imported ${res.importedArticles} new articles from ${res.sourceFormat}`
    );
  };

  const handleResetDemoData = () => {
    triggerHaptic('medium');
    db.resetToSampleData();
    onDataChanged();
    onToast('Restored default sample articles & highlights');
  };

  const handleLanguagePick = (code: LanguageCode) => {
    triggerHaptic('light');
    onUpdateSettings({
      app_language: code,
      translate_target_lang: code === 'en' ? 'es' : code,
    });
    const spec = LANGUAGE_MAP[code];
    onToast(`${spec.flag} UI language set to ${spec.nativeName} (Auto-translation stays OFF by default)`);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pt-4 pb-28 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        {/* Header */}
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: FONT_FAMILIES.serif.cssFamily }}
          >
            {ui.tabSettings}
          </h1>
          <p className="text-xs" style={{ color: theme.textSecondary }}>
            100% Serverless &amp; Local-First • 16-Language Built-In Translator (Bangla বাংলা + 15 Global) • Zero Ads
          </p>
        </div>

        {/* Reading Stats Banner */}
        <section
          className="grid grid-cols-3 gap-3 rounded-3xl border p-4 shadow-xs"
          style={{
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
          }}
        >
          <div
            className="rounded-2xl p-3 text-center"
            style={{ backgroundColor: theme.surfaceElevated }}
          >
            <BookOpen
              className="mx-auto mb-1 h-5 w-5"
              style={{ color: theme.brandAccent }}
            />
            <div className="font-serif text-2xl font-bold">{articles.length}</div>
            <div className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>
              {ui.articlesSaved}
            </div>
          </div>

          <div
            className="rounded-2xl p-3 text-center"
            style={{ backgroundColor: theme.surfaceElevated }}
          >
            <FileText
              className="mx-auto mb-1 h-5 w-5"
              style={{ color: theme.brandAccent }}
            />
            <div className="font-serif text-2xl font-bold">
              {totalWordsRead.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>
              {ui.wordsRead}
            </div>
          </div>

          <div
            className="rounded-2xl p-3 text-center"
            style={{ backgroundColor: theme.surfaceElevated }}
          >
            <Sparkles
              className="mx-auto mb-1 h-5 w-5"
              style={{ color: theme.brandAccent }}
            />
            <div className="font-serif text-2xl font-bold">{highlights.length}</div>
            <div className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>
              {ui.highlightsCreated}
            </div>
          </div>
        </section>

        {/* Built-in 15 Main Global Languages & Full Article Translation Option */}
        <section
          className="rounded-3xl border p-5 space-y-3.5"
          style={{
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
          }}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" style={{ color: theme.brandAccent }} />
            <div>
              <h2 className="text-sm font-bold">{ui.appLanguageLabel}</h2>
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                Articles always open in their <strong>original language</strong> by default (Auto-Translation is OFF). You can optionally translate any article on-demand inside the reader or switch UI language below:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = (settings.app_language || 'en') === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLanguagePick(lang.code)}
                  className="flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all"
                  style={{
                    backgroundColor: active ? theme.brandAccent : theme.surfaceElevated,
                    color: active ? theme.brandAccentText : theme.textPrimary,
                    borderColor: active ? theme.brandAccent : theme.borderSubtle,
                  }}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span className="mt-0.5 truncate text-xs font-bold">{lang.nativeName}</span>
                  <span className="text-[10px] opacity-75">{lang.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Zero-Cost Data Ownership & Sync */}
        <section
          className="rounded-3xl border p-5 space-y-4"
          style={{
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
          }}
        >
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" style={{ color: theme.brandAccent }} />
            <div>
              <h2 className="text-sm font-bold">Zero-Cost Data Ownership &amp; Cloud Backup</h2>
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                Export your entire SQLite library to Google Drive, iCloud Drive, or Obsidian, or
                import from Pocket &amp; Instapaper.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={handleExportJsonBackup}
              className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold shadow-xs transition-transform active:scale-95"
              style={{
                backgroundColor: theme.brandAccent,
                color: theme.brandAccentText,
              }}
            >
              <Download className="h-4 w-4" />
              <span>📤 Export Full Library Backup (JSON)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary,
              }}
            >
              <Upload className="h-4 w-4" style={{ color: theme.brandAccent }} />
              <span>📥 Restore / Import (JSON / CSV / HTML)</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.html,.htm,.csv,.txt"
              onChange={handleImportFileChange}
              className="hidden"
            />
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs"
            style={{
              backgroundColor: theme.backgroundPrimary,
              borderColor: theme.borderSubtle,
            }}
          >
            <span style={{ color: theme.textSecondary }}>
              Migrating from Pocket or Instapaper? Test batch importer with sample links:
            </span>
            <button
              onClick={handleSimulatePocketImport}
              className="rounded-xl px-3 py-1 font-semibold"
              style={{
                backgroundColor: theme.surfaceElevated,
                color: theme.brandAccent,
              }}
            >
              + Test Pocket HTML Import
            </button>
          </div>
        </section>

        {/* Clipboard & Offline Preferences */}
        <section
          className="rounded-3xl border p-5 space-y-4"
          style={{
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
          }}
        >
          <h2 className="text-sm font-bold">Clipboard &amp; Offline Engine Preferences</h2>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold">
                Smart Clipboard URL Detection on Foreground
              </div>
              <div className="text-[11px]" style={{ color: theme.textSecondary }}>
                Automatically prompt to save copied http/https links when opening Folia
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                onUpdateSettings({
                  auto_clipboard_prompt: settings.auto_clipboard_prompt ? 0 : 1,
                });
              }}
              className="flex h-7 w-12 items-center rounded-full p-1 transition-colors"
              style={{
                backgroundColor: settings.auto_clipboard_prompt
                  ? theme.brandAccent
                  : theme.surfaceElevated,
              }}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                  settings.auto_clipboard_prompt ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="h-px w-full" style={{ backgroundColor: theme.borderSubtle }} />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold">
                Offline Hero Image &amp; SVG Cover Caching
              </div>
              <div className="text-[11px]" style={{ color: theme.textSecondary }}>
                Cache article cover graphics locally so cards render in Airplane Mode
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                onUpdateSettings({
                  cache_images_offline: settings.cache_images_offline ? 0 : 1,
                });
              }}
              className="flex h-7 w-12 items-center rounded-full p-1 transition-colors"
              style={{
                backgroundColor: settings.cache_images_offline
                  ? theme.brandAccent
                  : theme.surfaceElevated,
              }}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                  settings.cache_images_offline ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* Privacy & SQLite Schema Inspector */}
        <section
          className="rounded-3xl border p-5 space-y-3"
          style={{
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" style={{ color: theme.brandAccent }} />
              <h2 className="text-sm font-bold">100% Local-First Privacy Guarantee</h2>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: `${theme.brandAccent}22`,
                color: theme.brandAccent,
              }}
            >
              <Check className="h-3 w-3" /> Android Auto-Backup Ready
            </span>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: theme.textSecondary }}>
            Folia has zero backend servers, zero analytics trackers, zero login walls, and zero
            advertisements. Every article, cached cover image, highlight, translation, and margin
            note lives strictly on your device.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => setShowSchemaModal(!showSchemaModal)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary,
              }}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>{showSchemaModal ? 'Hide SQLite Schema' : 'Inspect SQLite DDL Schema'}</span>
            </button>

            <button
              onClick={handleResetDemoData}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textSecondary,
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Sample Library</span>
            </button>
          </div>

          {showSchemaModal && (
            <pre
              className="mt-3 overflow-x-auto rounded-2xl border p-3.5 font-mono text-[11px]"
              style={{
                backgroundColor: theme.backgroundPrimary,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary,
              }}
            >
              {db.getMigrationDDL().trim()}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
};
