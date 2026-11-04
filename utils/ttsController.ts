import { ContentBlock } from '../db/schema';
import { LANGUAGE_MAP, LanguageCode } from '../constants/i18n';

export interface FoliaNativeBridgeInterface {
  isTtsAvailable?: () => boolean;
  speak?: (text: string, bcp47Lang: string, rate: number, utteranceId: string) => boolean;
  stopSpeaking?: () => void;
  isSpeaking?: () => boolean;
  consumePendingSharedText?: () => string;
  getClipboardText?: () => string;
  fetchUrlHtml?: (url: string) => string;
}

declare global {
  interface Window {
    FoliaNative?: FoliaNativeBridgeInterface;
    __foliaOnNativeTtsEvent?: (eventType: string, utteranceId: string) => void;
    __foliaOnSharedUrl?: (sharedText: string) => void;
  }
}

export type TTSPlaybackState = 'idle' | 'playing' | 'paused';

export interface TTSStatus {
  state: TTSPlaybackState;
  isPlaying: boolean;
  activeBlockIndex: number;
  rate: number;
  totalBlocks: number;
  languageCode: LanguageCode;
}

export type TTSState = TTSStatus;

type TTSListener = (status: TTSStatus) => void;

function normalizeLanguageCode(input?: string): LanguageCode {
  if (!input) return 'en';
  const trimmed = input.trim().toLowerCase();
  if (trimmed in LANGUAGE_MAP) {
    return trimmed as LanguageCode;
  }
  const prefix = trimmed.split('-')[0];
  if (prefix in LANGUAGE_MAP) {
    return prefix as LanguageCode;
  }
  return 'en';
}

/**
 * Splits a paragraph into sentence chunks <= 180 chars for HTML5 Audio TTS streaming
 */
function splitIntoTtsChunks(text: string, maxLen = 180): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const rawSentences = cleaned.split(/(?<=[.!?।。！？؛;])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of rawSentences) {
    if (!sentence) continue;
    if ((current + ' ' + sentence).trim().length <= maxLen) {
      current = (current + ' ' + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLen) {
        current = sentence;
      } else {
        // Hard-split very long clause by words
        const words = sentence.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxLen) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Algorithm C: Multi-Language Offline & Hybrid Text-to-Speech (TTS) Controller
 * 3-Tier Real Audio Architecture:
 *  Tier 1: Native Android TextToSpeech Bridge (window.FoliaNative.speak) — 100% offline on Android
 *  Tier 2: Verified Web Speech API (window.speechSynthesis) with 650ms watchdog
 *  Tier 3: HTML5 <audio> TTS Stream fallback + offline cadence fallback
 */
class OfflineTTSController {
  private blocks: ContentBlock[] = [];
  private state: TTSPlaybackState = 'idle';
  private activeIndex = 0;
  private rate = 1.0;
  private languageCode: LanguageCode = 'en';
  private listeners: Set<TTSListener> = new Set();

  private fallbackTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private activeUtteranceId = '';
  private currentAudio: HTMLAudioElement | null = null;
  private audioChunkQueue: string[] = [];
  private activeAudioChunkIndex = 0;
  private activeEngine: 'none' | 'native' | 'webspeech' | 'html5audio' | 'cadence' = 'none';

  constructor() {
    if (typeof window !== 'undefined') {
      window.__foliaOnNativeTtsEvent = (eventType: string, utteranceId: string) => {
        if (this.state !== 'playing' || utteranceId !== this.activeUtteranceId) return;
        if (eventType === 'done') {
          this.clearTimers();
          this.advanceToNextBlock();
        } else if (eventType === 'error') {
          this.clearTimers();
          // Fallback to HTML5 audio stream if native TTS encounters a language pack error
          const block = this.blocks[this.activeIndex];
          if (block) {
            this.speakWithHtml5Audio(block.text, this.activeIndex, this.activeUtteranceId);
          }
        }
      };

      // Pre-warm browser voices if available
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.getVoices();
        } catch {
          // ignore
        }
      }
    }
  }

  public loadBlocks(
    blocks: ContentBlock[],
    initialRate = 1.0,
    languageCode: string = 'en'
  ): void {
    this.stop();
    this.blocks = blocks;
    this.rate = initialRate;
    this.languageCode = normalizeLanguageCode(languageCode);
    this.activeIndex = 0;
    this.emit();
  }

  /**
   * Updates blocks or language code without interrupting active playback
   */
  public updateBlocks(blocks: ContentBlock[], languageCode: string = 'en'): void {
    this.blocks = blocks;
    const normalized = normalizeLanguageCode(languageCode);
    const langChanged = this.languageCode !== normalized;
    this.languageCode = normalized;
    if (this.activeIndex >= blocks.length) {
      this.activeIndex = Math.max(0, blocks.length - 1);
    }
    if (langChanged && this.state === 'playing') {
      this.speakBlockAt(this.activeIndex);
    } else {
      this.emit();
    }
  }

  public setLanguage(languageCode: string): void {
    const wasPlaying = this.state === 'playing';
    const currentIdx = this.activeIndex;
    this.languageCode = normalizeLanguageCode(languageCode);
    if (wasPlaying) {
      this.speakBlockAt(currentIdx);
    } else {
      this.emit();
    }
  }

  public subscribe(listener: TTSListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): TTSStatus {
    return {
      state: this.state,
      isPlaying: this.state === 'playing',
      activeBlockIndex: this.activeIndex,
      rate: this.rate,
      totalBlocks: this.blocks.length,
      languageCode: this.languageCode,
    };
  }

  public getState(): TTSStatus {
    return this.getStatus();
  }

  public playFromBlock(index: number): void {
    if (this.blocks.length === 0) return;
    const clamped = Math.max(0, Math.min(this.blocks.length - 1, index));
    this.activeIndex = clamped;
    this.state = 'playing';
    this.emit();
    this.speakBlockAt(this.activeIndex);
  }

  public startFromBlock(index: number): void {
    this.playFromBlock(index);
  }

  public togglePlayPause(): void {
    if (this.state === 'idle') {
      this.playFromBlock(this.activeIndex || 0);
    } else if (this.state === 'playing') {
      this.pause();
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  public pause(): void {
    if (this.state !== 'playing') return;
    this.clearTimers();
    this.state = 'paused';

    try {
      if (this.activeEngine === 'native' && window.FoliaNative?.stopSpeaking) {
        window.FoliaNative.stopSpeaking();
      } else if (this.activeEngine === 'webspeech' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.pause();
      } else if (this.activeEngine === 'html5audio' && this.currentAudio) {
        this.currentAudio.pause();
      }
    } catch {
      // ignore
    }
    this.emit();
  }

  public resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.emit();

    try {
      if (
        this.activeEngine === 'html5audio' &&
        this.currentAudio &&
        this.currentAudio.paused &&
        this.currentAudio.currentTime > 0 &&
        !this.currentAudio.ended
      ) {
        this.currentAudio.playbackRate = this.rate;
        this.currentAudio.play().catch(() => {
          this.speakBlockAt(this.activeIndex);
        });
        return;
      }
    } catch {
      // fallback to re-speaking block
    }

    this.speakBlockAt(this.activeIndex);
  }

  public next(): void {
    if (this.activeIndex < this.blocks.length - 1) {
      this.playFromBlock(this.activeIndex + 1);
    } else {
      this.stop();
    }
  }

  public nextParagraph(): void {
    this.next();
  }

  public prev(): void {
    if (this.activeIndex > 0) {
      this.playFromBlock(this.activeIndex - 1);
    } else {
      this.playFromBlock(0);
    }
  }

  public prevParagraph(): void {
    this.prev();
  }

  public cycleRate(): number {
    const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
    const idx = rates.findIndex((r) => Math.abs(r - this.rate) < 0.05);
    const nextRate = rates[(idx + 1) % rates.length];
    this.setRate(nextRate);
    return nextRate;
  }

  public setRate(newRate: number): void {
    this.rate = newRate;
    if (this.state === 'playing') {
      if (this.activeEngine === 'html5audio' && this.currentAudio) {
        try {
          this.currentAudio.playbackRate = newRate;
          this.emit();
          return;
        } catch {
          // fallback to re-speaking
        }
      }
      this.speakBlockAt(this.activeIndex);
    } else {
      this.emit();
    }
  }

  public stop(): void {
    this.clearTimers();
    this.activeUtteranceId = '';
    this.stopAllAudioEngines();
    this.state = 'idle';
    this.activeIndex = 0;
    this.activeEngine = 'none';
    this.emit();
  }

  private stopAllAudioEngines(): void {
    try {
      if (typeof window !== 'undefined' && window.FoliaNative?.stopSpeaking) {
        window.FoliaNative.stopSpeaking();
      }
    } catch {
      // ignore
    }

    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }

    try {
      if (this.currentAudio) {
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio = null;
      }
    } catch {
      // ignore
    }
  }

  private advanceToNextBlock(): void {
    if (this.state !== 'playing') return;
    if (this.activeIndex < this.blocks.length - 1) {
      this.activeIndex += 1;
      this.emit();
      this.speakBlockAt(this.activeIndex);
    } else {
      this.stop();
    }
  }

  private speakBlockAt(index: number): void {
    this.clearTimers();
    this.stopAllAudioEngines();

    const block = this.blocks[index];
    if (!block) {
      this.stop();
      return;
    }

    const utteranceId = `utt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.activeUtteranceId = utteranceId;
    const spec = LANGUAGE_MAP[this.languageCode] || LANGUAGE_MAP.en;
    const bcp47Tag = spec.bcp47 || 'en-US';

    // TIER 1: Android Native TextToSpeech Bridge (window.FoliaNative)
    if (typeof window !== 'undefined' && window.FoliaNative?.speak) {
      try {
        const startedNative = window.FoliaNative.speak(
          block.text,
          bcp47Tag,
          this.rate,
          utteranceId
        );
        if (startedNative) {
          this.activeEngine = 'native';
          // Safety ceiling timer in case native engine never fires onDone
          const wordCount = Math.max(4, block.text.split(/\s+/).length);
          const maxDurationMs = Math.max(4000, Math.round((wordCount / (2.2 * this.rate)) * 1000) + 4500);
          this.fallbackTimer = window.setTimeout(() => {
            if (this.state === 'playing' && this.activeUtteranceId === utteranceId) {
              this.advanceToNextBlock();
            }
          }, maxDurationMs);
          return;
        }
      } catch {
        // Fall through to Tier 2 / Tier 3
      }
    }

    // TIER 2: Browser Web Speech API (if voices are installed & responsive)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          this.activeEngine = 'webspeech';
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(block.text);
          utterance.rate = this.rate;
          utterance.lang = bcp47Tag;

          const langPrefix = bcp47Tag.split('-')[0].toLowerCase();
          const matchingVoice =
            voices.find((v) => v.lang.toLowerCase() === bcp47Tag.toLowerCase()) ||
            voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
            voices[0];
          if (matchingVoice) {
            utterance.voice = matchingVoice;
          }

          let speechStarted = false;

          utterance.onstart = () => {
            speechStarted = true;
            if (this.watchdogTimer !== null) {
              clearTimeout(this.watchdogTimer);
              this.watchdogTimer = null;
            }
          };

          utterance.onend = () => {
            if (this.state !== 'playing' || this.activeUtteranceId !== utteranceId) return;
            this.clearTimers();
            this.advanceToNextBlock();
          };

          utterance.onerror = () => {
            if (this.state !== 'playing' || this.activeUtteranceId !== utteranceId) return;
            this.clearTimers();
            // Immediately hand off to Tier 3 HTML5 Audio TTS
            this.speakWithHtml5Audio(block.text, index, utteranceId);
          };

          window.speechSynthesis.speak(utterance);

          // 650ms Watchdog: if Web Speech API is silent/broken on this WebView, switch to HTML5 Audio TTS
          this.watchdogTimer = window.setTimeout(() => {
            if (this.state === 'playing' && this.activeUtteranceId === utteranceId && !speechStarted) {
              try {
                window.speechSynthesis.cancel();
              } catch {
                // ignore
              }
              this.speakWithHtml5Audio(block.text, index, utteranceId);
            }
          }, 650);

          return;
        }
      } catch {
        // Fall through to Tier 3
      }
    }

    // TIER 3: HTML5 <audio> TTS Stream Fallback (works on all Android WebViews & browsers)
    this.speakWithHtml5Audio(block.text, index, utteranceId);
  }

  private speakWithHtml5Audio(text: string, blockIndex: number, utteranceId: string): void {
    if (this.state !== 'playing' || this.activeUtteranceId !== utteranceId) return;

    this.activeEngine = 'html5audio';
    this.audioChunkQueue = splitIntoTtsChunks(text, 175);
    this.activeAudioChunkIndex = 0;

    if (this.audioChunkQueue.length === 0) {
      this.advanceToNextBlock();
      return;
    }

    this.playNextAudioChunk(blockIndex, utteranceId);
  }

  private playNextAudioChunk(blockIndex: number, utteranceId: string): void {
    if (this.state !== 'playing' || this.activeUtteranceId !== utteranceId) return;
    if (this.activeAudioChunkIndex >= this.audioChunkQueue.length) {
      this.advanceToNextBlock();
      return;
    }

    const chunk = this.audioChunkQueue[this.activeAudioChunkIndex];
    const tl = this.languageCode || 'en';
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
      tl
    )}&q=${encodeURIComponent(chunk)}`;

    try {
      const audio = new Audio(url);
      this.currentAudio = audio;
      audio.playbackRate = Math.max(0.5, Math.min(2.0, this.rate));

      audio.onended = () => {
        if (this.state !== 'playing' || this.activeUtteranceId !== utteranceId) return;
        this.activeAudioChunkIndex += 1;
        this.playNextAudioChunk(blockIndex, utteranceId);
      };

      audio.onerror = () => {
        if (this.state !== 'playing' || this.activeUtteranceId !== utteranceId) return;
        this.startOfflineCadenceFallback(chunk, utteranceId);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (this.state !== 'playing' || this.activeUtteranceId !== utteranceId) return;
          this.startOfflineCadenceFallback(chunk, utteranceId);
        });
      }
    } catch {
      this.startOfflineCadenceFallback(chunk, utteranceId);
    }
  }

  private startOfflineCadenceFallback(text: string, utteranceId: string): void {
    this.activeEngine = 'cadence';
    const wordCount = Math.max(3, text.split(/\s+/).length);
    const durationMs = Math.max(1200, Math.round((wordCount / (2.8 * this.rate)) * 1000));
    this.fallbackTimer = window.setTimeout(() => {
      if (this.state === 'playing' && this.activeUtteranceId === utteranceId) {
        this.advanceToNextBlock();
      }
    }, durationMs);
  }

  private clearTimers(): void {
    if (this.fallbackTimer !== null && typeof window !== 'undefined') {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.watchdogTimer !== null && typeof window !== 'undefined') {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private emit(): void {
    const status = this.getStatus();
    this.listeners.forEach((fn) => fn(status));
  }
}

export const ttsController = new OfflineTTSController();
