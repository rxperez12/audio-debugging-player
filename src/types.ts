export interface UtteranceSegment {
  index: number;
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
  durationMs: number;
  platform: string;
  /** false on Android — concurrent mic access may yield silent recording */
  hasAudio: boolean;
  /** Per-utterance timeline for correlating audio with VAD events */
  utterances: UtteranceSegment[];
}
