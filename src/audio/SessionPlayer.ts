import type { CombinedSession, TimelineRow } from '../types';
import { getAudioContext } from './decodeFiles';

/**
 * Web Audio playback engine for a combined user + AI session.
 *
 * Accuracy model:
 * - The AI buffer is CONTINUOUS → scheduled once at its wall-clock offset.
 * - User buffer — two modes depending on captureMode in the recording metadata:
 *   • 'vad-compacted' (legacy / absent): silence removed; each utterance is sliced
 *     at [fileStartMs, +fileDurationMs] and re-anchored to its wallStartAt offset.
 *     This re-inserts removed silence so barge-in/overlap is represented correctly.
 *   • 'continuous' (new): gapless file; scheduled once at its track offset (like AI)
 *     so the recovered speech prefix before each VAD marker is audible.
 *
 * AudioBufferSourceNode is single-use, so a fresh node is created for every play.
 */
export class SessionPlayer {
  private ctx: AudioContext;
  private session: CombinedSession;
  private live: AudioBufferSourceNode[] = [];
  private onEnded: (() => void) | null = null;

  constructor(session: CombinedSession) {
    this.ctx = getAudioContext();
    this.session = session;
  }

  /** Register a callback fired when all scheduled sources have finished/stopped. */
  setOnEnded(cb: (() => void) | null): void {
    this.onEnded = cb;
  }

  /** Schedule both tracks on the shared clock, reconstructing real session time. */
  async schedulePlayAll(): Promise<void> {
    this.stop();
    await this.ctx.resume();

    const base = this.ctx.currentTime + 0.1;
    let lastEndTime = base;

    // AI track: one continuous buffer at its wall-clock offset.
    if (this.session.ai) {
      const aiWhen = base + Math.max(0, this.session.aiOffsetMs) / 1000;
      const src = this.makeSource(this.session.ai.buffer);
      src.start(aiWhen);
      lastEndTime = Math.max(lastEndTime, aiWhen + this.session.ai.buffer.duration);
    }

    const userCaptureMode = this.session.user.entries[0]?.captureMode;

    if (userCaptureMode === 'continuous') {
      // Continuous user track: play the whole buffer once at its track start offset
      // (same model as AI), so the recovered speech prefix before each VAD marker
      // is audible. userOffsetMs is 0 when user and session start together.
      const userOffsetMs = this.session.userOffsetMs ?? 0;
      const userWhen = base + Math.max(0, userOffsetMs) / 1000;
      const src = this.makeSource(this.session.user.buffer);
      src.start(userWhen);
      lastEndTime = Math.max(lastEndTime, userWhen + this.session.user.buffer.duration);
    } else {
      // Legacy VAD-compacted: re-anchor each utterance to its own wall-clock moment.
      for (const row of this.session.rows) {
        if (row.speaker !== 'user') continue;
        const when = base + row.offsetMs / 1000;
        const src = this.makeSource(this.session.user.buffer);
        src.start(when, row.fileStartMs / 1000, row.fileDurationMs / 1000);
        lastEndTime = Math.max(lastEndTime, when + row.fileDurationMs / 1000);
      }
    }

    this.armEndCallback(lastEndTime);
  }

  /** Play a single utterance segment from its own track; silence everything else. */
  async playRow(row: TimelineRow): Promise<void> {
    this.stop();
    await this.ctx.resume();

    const buffer = row.speaker === 'ai'
      ? this.session.ai?.buffer
      : this.session.user.buffer;
    if (!buffer) return;

    const src = this.makeSource(buffer);
    const when = this.ctx.currentTime;

    if (row.speaker === 'user') {
      const userCaptureMode = this.session.user.entries[0]?.captureMode;
      if (userCaptureMode === 'continuous') {
        // Pad a lead-in so the recovered speech prefix is audible when auditioning
        // a single utterance. Clamp so we never seek before the start of the file.
        const LEADIN_MS = 1000;
        const leadIn = Math.min(LEADIN_MS, row.fileStartMs);
        const startSec = (row.fileStartMs - leadIn) / 1000;
        const durSec = (row.fileDurationMs + leadIn) / 1000;
        src.start(when, startSec, durSec);
        this.armEndCallback(when + durSec);
        return;
      }
    }

    src.start(when, row.fileStartMs / 1000, row.fileDurationMs / 1000);
    this.armEndCallback(when + row.fileDurationMs / 1000);
  }

  /** Stop and disconnect all live sources immediately. */
  stop(): void {
    for (const src of this.live) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        // already stopped
      }
      src.disconnect();
    }
    this.live = [];
  }

  private makeSource(buffer: AudioBuffer): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    this.live.push(src);
    return src;
  }

  private armEndCallback(endTime: number): void {
    const delayMs = Math.max(0, (endTime - this.ctx.currentTime) * 1000);
    window.setTimeout(() => {
      // Only fire if these sources are still the active batch.
      if (this.live.length > 0) {
        this.onEnded?.();
      }
    }, delayMs + 50);
  }
}
