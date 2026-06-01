export interface UtteranceSegment {
  index: number;
  /** Realtime conversation item id for this user audio turn */
  itemId?: string | null;
  /** ISO timestamp for when this utterance started in wall-clock time */
  wallStartAt?: string | null;
  /** ISO timestamp for when this utterance ended in wall-clock time */
  wallEndAt?: string | null;
  /** Offset (ms) into the .m4a file where this utterance begins */
  fileStartMs: number;
  /** Duration (ms) of this utterance in the file */
  fileDurationMs: number;
  /** Transcript text, filled in once the API returns the transcript */
  transcript: string | null;
}

export interface AudioRecordingEntry {
  uri: string;
  bookingId: string;
  startedAt: string; // ISO timestamp
  /** Total playable audio captured in the saved file */
  durationMs: number;
  /** Full wall-clock session lifetime, including silence between utterances */
  sessionElapsedMs?: number;
  platform: string;
  /** false on Android — concurrent mic access may yield silent recording */
  hasAudio: boolean;
  /** Per-utterance timeline for correlating audio with VAD events */
  utterances: UtteranceSegment[];
}

/** AI-side utterance segment — mirrors AiUtteranceSegment in the native app's aiAudioRecorder.ts */
export interface AiUtteranceSegment {
  index: number;
  /** Realtime response id for this AI audio turn */
  responseId?: string | null;
  /** ISO timestamp for when AI audio started in wall-clock time */
  wallStartAt?: string | null;
  /** ISO timestamp for when AI audio ended in wall-clock time */
  wallEndAt?: string | null;
  /** Offset (ms) into the .ai.wav file where this AI utterance begins */
  fileStartMs: number;
  /** Duration (ms) of this AI utterance in the file */
  fileDurationMs: number;
  /** AI transcript text */
  transcript: string | null;
}

/** AI recording metadata sidecar (.ai.json) — mirrors AiAudioMetadata in the native app */
export interface AiAudioRecordingEntry {
  bookingId?: string;
  /** Wall-clock start of AI recording (ISO) */
  startedAt?: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  format: 'wav';
  hasAudio: boolean;
  platform?: string;
  /** Per-utterance AI audio timeline */
  utterances?: AiUtteranceSegment[];
}

export type Speaker = 'user' | 'ai';

/**
 * A single row on the merged wall-clock timeline. `offsetMs` is relative to the
 * shared session start (t0); `fileStartMs`/`fileDurationMs` are positions inside
 * this row's OWN audio buffer (user buffer is VAD-compacted, AI buffer continuous).
 */
export interface TimelineRow {
  speaker: Speaker;
  entryIdx: number;
  utteranceIndex: number;
  /** Wall-clock offset (ms) from session start t0 */
  offsetMs: number;
  /** Offset (ms) into this speaker's audio buffer */
  fileStartMs: number;
  /** Duration (ms) of this segment in the buffer */
  fileDurationMs: number;
  /** ISO wall start, if present */
  wallStartAt: string | null;
  /** true when offset was derived without wallStartAt (approximate placement) */
  approximate: boolean;
  /** true when this row has no audio in the buffer (fileDurationMs === 0), e.g. a
   * text-only / superseded Realtime response. Such rows cannot be played. */
  noAudio: boolean;
  transcript: string | null;
}

/**
 * Fully decoded + merged session ready for playback. Audio is held as decoded
 * AudioBuffers (not object URLs) so the Web Audio engine can schedule segments
 * sample-accurately on a single clock.
 */
export interface CombinedSession {
  user: {
    buffer: AudioBuffer;
    entries: AudioRecordingEntry[];
  };
  ai?: {
    buffer: AudioBuffer;
    entries: AiAudioRecordingEntry[];
  };
  /** Merged, wall-clock-ordered rows for both speakers */
  rows: TimelineRow[];
  /** Shared session start (ms epoch) = min(userStartedAt, aiStartedAt) */
  t0Ms: number;
  /** AI track start offset (ms) from t0 — when to schedule the continuous AI buffer */
  aiOffsetMs: number;
}
