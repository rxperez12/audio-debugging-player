import type {
  AudioRecordingEntry,
  AiAudioRecordingEntry,
  TimelineRow,
} from '../types';

export interface BuiltTimeline {
  rows: TimelineRow[];
  /** Shared session start (ms epoch) = min(userStartedAt, aiStartedAt) */
  t0Ms: number;
  /** AI track start offset (ms) from t0 */
  aiOffsetMs: number;
}

/**
 * Merge the user (VAD-compacted) and AI (continuous) utterance timelines into a
 * single wall-clock-ordered list.
 *
 * CRITICAL: user `fileStartMs` is a position in the gap-removed file, NOT a
 * wall-clock offset. The only cross-track axis is `wallStartAt` (both recorders
 * stamp from the same device clock). Each row's `offsetMs` is computed from
 * wallStartAt relative to t0; when wallStartAt is missing we fall back to the
 * track start + fileStartMs and flag the row as approximate.
 */
export function buildTimeline(
  userEntries: AudioRecordingEntry[],
  aiEntries?: AiAudioRecordingEntry[],
): BuiltTimeline {
  const userStartMs = parseStart(userEntries[0]?.startedAt);
  const aiStartMs = aiEntries && aiEntries.length > 0
    ? parseStart(aiEntries[0]?.startedAt) ?? userStartMs
    : userStartMs;

  const t0Ms = Math.min(
    userStartMs ?? Number.POSITIVE_INFINITY,
    aiStartMs ?? Number.POSITIVE_INFINITY,
  );
  const safeT0 = Number.isFinite(t0Ms) ? t0Ms : (userStartMs ?? 0);
  const aiOffsetMs = (aiStartMs ?? safeT0) - safeT0;

  const rows: TimelineRow[] = [];

  userEntries.forEach((entry, entryIdx) => {
    const trackStart = parseStart(entry.startedAt) ?? safeT0;
    entry.utterances.forEach((u) => {
      rows.push(toRow('user', entryIdx, u.index, u.wallStartAt ?? null,
        u.fileStartMs, u.fileDurationMs, u.transcript, trackStart, safeT0));
    });
  });

  aiEntries?.forEach((entry, entryIdx) => {
    const trackStart = parseStart(entry.startedAt) ?? aiStartMs ?? safeT0;
    (entry.utterances ?? []).forEach((u) => {
      rows.push(toRow('ai', entryIdx, u.index, u.wallStartAt ?? null,
        u.fileStartMs, u.fileDurationMs, u.transcript, trackStart, safeT0));
    });
  });

  rows.sort((a, b) => a.offsetMs - b.offsetMs);

  return { rows, t0Ms: safeT0, aiOffsetMs };
}

function parseStart(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function toRow(
  speaker: 'user' | 'ai',
  entryIdx: number,
  utteranceIndex: number,
  wallStartAt: string | null,
  fileStartMs: number,
  fileDurationMs: number,
  transcript: string | null,
  trackStartMs: number,
  t0Ms: number,
): TimelineRow {
  const wallMs = wallStartAt ? Date.parse(wallStartAt) : NaN;
  const hasWall = !Number.isNaN(wallMs);
  const offsetMs = hasWall ? wallMs - t0Ms : (trackStartMs + fileStartMs) - t0Ms;
  return {
    speaker,
    entryIdx,
    utteranceIndex,
    offsetMs,
    fileStartMs,
    fileDurationMs,
    wallStartAt,
    approximate: !hasWall,
    noAudio: fileDurationMs <= 0,
    transcript,
  };
}
