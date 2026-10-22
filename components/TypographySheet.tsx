import React from 'react';
import {
  FONT_FAMILIES,
  FontFamilyMode,
  LINE_SPACING_PRESETS,
  THEMES,
  ThemeMode,
  ThemeTokens,
} from '../constants/theme';
import { ReaderSettingsRecord } from '../db/schema';
import { triggerHaptic } from '../utils/haptics';
import { X, Minus, Plus, Type, Sparkles } from 'lucide-react';

interface TypographySheetProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettingsRecord;
  onUpdateSettings: (patch: Partial<ReaderSettingsRecord>) => void;
  theme: ThemeTokens;
}

export const TypographySheet: React.FC<TypographySheetProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  theme,
}) => {
  if (!isOpen) return null;

  const handleThemeChange = (mode: ThemeMode) => {
    triggerHaptic('light');
    onUpdateSettings({ theme_mode: mode });
  };

  const handleFontChange = (font: FontFamilyMode) => {
    triggerHaptic('light');
    onUpdateSettings({ font_family: font });
  };

  const handleFontSizeStep = (delta: number) => {
    triggerHaptic('light');
    const next = Math.max(15, Math.min(26, settings.font_size + delta));
    onUpdateSettings({ font_size: next });
  };

  const handleLineHeightChange = (lh: number) => {
    triggerHaptic('light');
    onUpdateSettings({ line_height: lh });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-t-3xl border-t p-6 shadow-2xl transition-transform"
        style={{
          backgroundColor: theme.surfaceCard,
          borderColor: theme.borderSubtle,
          color: theme.textPrimary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full opacity-30" style={{ backgroundColor: theme.textSecondary }} />

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5" style={{ color: theme.brandAccent }} />
            <h3 className="text-lg font-bold tracking-tight">Typography &amp; Reading Theme</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:opacity-80"
            style={{ backgroundColor: theme.surfaceElevated, color: theme.textSecondary }}
            aria-label="Close typography settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 1. Theme Picker: 3 tactile cards */}
        <div className="mb-5">
          <label
            className="mb-2 block text-xs font-semibold tracking-wider uppercase"
            style={{ color: theme.textSecondary }}
          >
            Reading Surface Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['paper', 'sepia', 'dark'] as ThemeMode[]).map((mode) => {
              const t = THEMES[mode];
              const active = settings.theme_mode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => handleThemeChange(mode)}
                  className="flex flex-col items-start rounded-2xl border-2 p-3.5 text-left transition-all"
                  style={{
                    backgroundColor: t.backgroundPrimary,
                    color: t.textPrimary,
                    borderColor: active ? t.brandAccent : t.borderSubtle,
                    boxShadow: active ? `0 0 0 2px ${t.brandAccent}33` : 'none',
                  }}
                >
                  <div className="mb-1 flex w-full items-center justify-between">
                    <span className="text-base">{t.icon}</span>
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[10px] font-medium"
                      style={{
                        backgroundColor: t.surfaceElevated,
                        color: t.textSecondary,
                      }}
                    >
                      {t.backgroundPrimary}
                    </span>
                  </div>
                  <span className="text-sm font-bold">{t.label}</span>
                  <span className="text-[11px] opacity-75">{t.subtitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Font Family Selector */}
        <div className="mb-5">
          <label
            className="mb-2 block text-xs font-semibold tracking-wider uppercase"
            style={{ color: theme.textSecondary }}
          >
            Font Family
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {(['serif', 'sans', 'mono'] as FontFamilyMode[]).map((fam) => {
              const spec = FONT_FAMILIES[fam];
              const active = settings.font_family === fam;
              return (
                <button
                  key={fam}
                  onClick={() => handleFontChange(fam)}
                  className="rounded-xl border px-3 py-2.5 text-center transition-all"
                  style={{
                    fontFamily: spec.cssFamily,
                    backgroundColor: active ? theme.brandAccent : theme.surfaceElevated,
                    color: active ? theme.brandAccentText : theme.textPrimary,
                    borderColor: active ? theme.brandAccent : theme.borderSubtle,
                  }}
                >
                  <div className="text-sm font-semibold">{spec.label}</div>
                  <div className="mt-0.5 text-[10px] opacity-80">
                    {fam === 'serif' ? 'Literary' : fam === 'sans' ? 'Clean UI' : 'Technical'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Font Size Stepper (15px - 26px) */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label
              className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: theme.textSecondary }}
            >
              Font Size
            </label>
            <span className="font-mono text-xs font-bold" style={{ color: theme.brandAccent }}>
              {settings.font_size}px
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleFontSizeStep(-1)}
              disabled={settings.font_size <= 15}
              className="flex h-11 w-14 items-center justify-center rounded-xl border font-bold transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary,
              }}
            >
              <Minus className="mr-0.5 h-3.5 w-3.5" /> A
            </button>
            <input
              type="range"
              min={15}
              max={26}
              step={1}
              value={settings.font_size}
              onChange={(e) => onUpdateSettings({ font_size: Number(e.target.value) })}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg accent-emerald-700"
              style={{ backgroundColor: theme.surfaceElevated }}
            />
            <button
              onClick={() => handleFontSizeStep(1)}
              disabled={settings.font_size >= 26}
              className="flex h-11 w-14 items-center justify-center rounded-xl border text-lg font-bold transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary,
              }}
            >
              A <Plus className="ml-0.5 h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 4. Line Spacing Toggle */}
        <div>
          <label
            className="mb-2 block text-xs font-semibold tracking-wider uppercase"
            style={{ color: theme.textSecondary }}
          >
            Line Spacing &amp; Ergonomics
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {LINE_SPACING_PRESETS.map((preset) => {
              const active = Math.abs(settings.line_height - preset.value) < 0.05;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleLineHeightChange(preset.value)}
                  className="rounded-xl border py-2.5 text-center text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: active ? theme.brandAccent : theme.surfaceElevated,
                    color: active ? theme.brandAccentText : theme.textPrimary,
                    borderColor: active ? theme.brandAccent : theme.borderSubtle,
                  }}
                >
                  {preset.label} ({preset.value})
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="mt-5 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs"
          style={{ backgroundColor: theme.surfaceElevated, color: theme.textSecondary }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: theme.brandAccent }} />
          <span>Preferences saved automatically to local SQLite database</span>
        </div>
      </div>
    </div>
  );
};
