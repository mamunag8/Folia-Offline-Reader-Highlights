export type ThemeMode = 'paper' | 'sepia' | 'dark';
export type FontFamilyMode = 'serif' | 'sans' | 'mono';
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'purple';

export interface ThemeTokens {
  id: ThemeMode;
  label: string;
  subtitle: string;
  icon: string;
  backgroundPrimary: string;
  surfaceCard: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  brandAccent: string;
  brandAccentText: string;
  borderSubtle: string;
}

export const THEMES: Record<ThemeMode, ThemeTokens> = {
  paper: {
    id: 'paper',
    label: 'Paper',
    subtitle: 'Warm Kindle Paper',
    icon: '☀️',
    backgroundPrimary: '#FAF7F2',
    surfaceCard: '#FFFFFF',
    surfaceElevated: '#F3EFE6',
    textPrimary: '#1C1B18',
    textSecondary: '#6E6A63',
    brandAccent: '#2D6A4F',
    brandAccentText: '#FFFFFF',
    borderSubtle: '#E8E2D9',
  },
  sepia: {
    id: 'sepia',
    label: 'Sepia',
    subtitle: 'Vintage Parchment',
    icon: '📜',
    backgroundPrimary: '#F3E9D2',
    surfaceCard: '#FAF3E3',
    surfaceElevated: '#EADBC0',
    textPrimary: '#2C221E',
    textSecondary: '#705E52',
    brandAccent: '#9C4A1A',
    brandAccentText: '#FFFFFF',
    borderSubtle: '#E2D4B7',
  },
  dark: {
    id: 'dark',
    label: 'Ink',
    subtitle: 'Midnight OLED Ink',
    icon: '🌙',
    backgroundPrimary: '#111315',
    surfaceCard: '#1A1D21',
    surfaceElevated: '#22262C',
    textPrimary: '#E5E7EB',
    textSecondary: '#9CA3AF',
    brandAccent: '#6EE7B7',
    brandAccentText: '#064E3B',
    borderSubtle: '#262A30',
  },
};

export interface HighlightMarkerSpec {
  id: HighlightColor;
  label: string;
  purpose: string;
  emoji: string;
  lightBg: string;
  darkBg: string;
  borderHex: string;
  dotHex: string;
}

export const HIGHLIGHT_PALETTE: Record<HighlightColor, HighlightMarkerSpec> = {
  yellow: {
    id: 'yellow',
    label: 'Yellow',
    purpose: 'Key Insight',
    emoji: '🟡',
    lightBg: '#FEF08A',
    darkBg: '#713F12',
    borderHex: '#EAB308',
    dotHex: '#FACC15',
  },
  green: {
    id: 'green',
    label: 'Green',
    purpose: 'Actionable / Quote',
    emoji: '🟢',
    lightBg: '#BBF7D0',
    darkBg: '#14532D',
    borderHex: '#22C55E',
    dotHex: '#4ADE80',
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    purpose: 'Definition / Fact',
    emoji: '🔵',
    lightBg: '#BAE6FD',
    darkBg: '#0C4A6E',
    borderHex: '#0EA5E9',
    dotHex: '#38BDF8',
  },
  purple: {
    id: 'purple',
    label: 'Purple',
    purpose: 'Question / Idea',
    emoji: '🟣',
    lightBg: '#E9D5FF',
    darkBg: '#4C1D95',
    borderHex: '#A855F7',
    dotHex: '#C084FC',
  },
};

export const FONT_FAMILIES: Record<FontFamilyMode, { label: string; description: string; cssFamily: string }> = {
  serif: {
    label: 'Serif',
    description: 'Literary Book (Lora / Georgia)',
    cssFamily: "'Lora', Georgia, 'Times New Roman', serif",
  },
  sans: {
    label: 'Sans',
    description: 'Clean Modern (Inter / System)',
    cssFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  mono: {
    label: 'Mono',
    description: 'Technical & Code (JetBrains Mono)',
    cssFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
};

export const LINE_SPACING_PRESETS = [
  { id: 'compact', label: 'Compact', value: 1.45 },
  { id: 'comfortable', label: 'Comfortable', value: 1.65 },
  { id: 'spacious', label: 'Spacious', value: 1.85 },
] as const;

export const TTS_SPEED_RATES = [1.0, 1.25, 1.5, 2.0, 0.75] as const;
