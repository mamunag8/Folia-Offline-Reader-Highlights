import { ContentBlock } from '../db/schema';
import { TTS_SPEED_RATES } from '../constants/theme';

export interface TTSState {
  isPlaying: boolean;
  activeBlockIndex: number;
  rate: number;
  totalBlocks: number;
}

type TTSListener = (state: TTSState) => void;

/**
 * Algorithm D: Native Offline Text-to-Speech (TTS) Audio Controller
 * Sequentially reads content_blocks_json with live paragraph synchronization and speed cycling.
 */
class OfflineTTSController {
  private blocks: ContentBlock[] = [];
  private activeBlockIndex = 0;
  private isPlaying = false;
  private rate = 1.0;
  private langBcp47 = 'en-US';
  private listeners: Set<TTSListener> = new Set();
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  public subscribe(listener: TTSListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): TTSState {
    return {
      isPlaying: this.isPlaying,
      activeBlockIndex: this.activeBlockIndex,
      rate: this.rate,
      totalBlocks: this.blocks.length,
    };
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  public loadBlocks(blocks: ContentBlock[], initialRate = 1.0, bcp47 = 'en-US'): void {
    this.stop();
    this.blocks = blocks;
    this.rate = initialRate;
    this.langBcp47 = bcp47;
    this.activeBlockIndex = 0;
    this.emit();
  }

  public setLanguageBcp47(bcp47: string): void {
    this.langBcp47 = bcp47;
  }

  public startFromBlock(index: number): void {
    if (this.blocks.length === 0) return;
    const clamped = Math.max(0, Math.min(this.blocks.length - 1, index));
    this.activeBlockIndex = clamped;
    this.isPlaying = true;
    this.emit();
    this.speakCurrentBlock();
  }

  public togglePlayPause(): void {
    if (this.blocks.length === 0) return;
    if (this.isPlaying) {
      this.pause();
    } else {
      this.isPlaying = true;
      this.emit();
      this.speakCurrentBlock();
    }
  }

  public pause(): void {
    this.isPlaying = false;
    this.clearFallbackTimer();
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    this.emit();
  }

  public stop(): void {
    this.isPlaying = false;
    this.activeBlockIndex = 0;
    this.clearFallbackTimer();
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    this.emit();
  }

  public nextParagraph(): void {
    if (this.blocks.length === 0) return;
    if (this.activeBlockIndex < this.blocks.length - 1) {
      this.activeBlockIndex += 1;
      this.emit();
      if (this.isPlaying) {
        this.speakCurrentBlock();
      }
    } else {
      this.stop();
    }
  }

  public prevParagraph(): void {
    if (this.blocks.length === 0) return;
    this.activeBlockIndex = Math.max(0, this.activeBlockIndex - 1);
    this.emit();
    if (this.isPlaying) {
      this.speakCurrentBlock();
    }
  }

  public cycleRate(): number {
    const idx = TTS_SPEED_RATES.indexOf(this.rate as (typeof TTS_SPEED_RATES)[number]);
    const nextRate = TTS_SPEED_RATES[(idx + 1) % TTS_SPEED_RATES.length];
    this.rate = nextRate;
    this.emit();
    if (this.isPlaying) {
      this.speakCurrentBlock();
    }
    return nextRate;
  }

  private clearFallbackTimer(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private speakCurrentBlock(): void {
    this.clearFallbackTimer();
    if (!this.isPlaying || this.blocks.length === 0) return;
    const block = this.blocks[this.activeBlockIndex];
    if (!block) {
      this.stop();
      return;
    }

    let handledByNativeSpeech = false;
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(block.text);
        utterance.lang = this.langBcp47;
        utterance.rate = this.rate;
        utterance.pitch = 1.0;
        utterance.onend = () => {
          if (!this.isPlaying) return;
          if (this.activeBlockIndex < this.blocks.length - 1) {
            this.activeBlockIndex += 1;
            this.emit();
            this.speakCurrentBlock();
          } else {
            this.stop();
          }
        };
        utterance.onerror = () => {
          // If speech synthesis fails on a headless webview, advance via reading cadence timer
        };
        window.speechSynthesis.speak(utterance);
        handledByNativeSpeech = true;
      }
    } catch {
      handledByNativeSpeech = false;
    }

    // Cadence timer ensures smooth progression even on devices without a TTS voice pack installed
    const words = block.text.split(/\s+/).length;
    const durationMs = Math.max(2200, Math.round(((words / 3.2) * 1000) / this.rate));
    this.fallbackTimer = setTimeout(() => {
      if (!this.isPlaying) return;
      if (
        !handledByNativeSpeech ||
        (typeof window !== 'undefined' &&
          'speechSynthesis' in window &&
          !window.speechSynthesis.speaking)
      ) {
        if (this.activeBlockIndex < this.blocks.length - 1) {
          this.activeBlockIndex += 1;
          this.emit();
          this.speakCurrentBlock();
        } else {
          this.stop();
        }
      }
    }, durationMs);
  }
}

export const ttsController = new OfflineTTSController();
