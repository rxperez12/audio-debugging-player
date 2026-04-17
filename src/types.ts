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
