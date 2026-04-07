import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioRecordingEntry, UtteranceSegment } from '../types';

interface Props {
  audioUrl: string;
  entries: AudioRecordingEntry[];
  onReset: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatWallTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function RecordingPlayer({ audioUrl, entries, onReset }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const segmentEndRef = useRef<number | null>(null);
  const segmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(entries.length === 1 ? 0 : null);
  // activeUtterance tracks { entryIdx, utteranceIndex } to uniquely identify which row is active
  const [activeUtterance, setActiveUtterance] = useState<{ entryIdx: number; utteranceIndex: number } | null>(null);

  const clearSegment = () => {
    segmentEndRef.current = null;
    if (segmentTimeoutRef.current !== null) {
      clearTimeout(segmentTimeoutRef.current);
      segmentTimeoutRef.current = null;
    }
  };

  // Sync play state with audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => { setIsPlaying(false); setActiveUtterance(null); }
    const onEnded = () => { setIsPlaying(false); setActiveUtterance(null); clearSegment(); }
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  // timeupdate listener as secondary safety net for segment end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (segmentEndRef.current !== null && audio.currentTime >= segmentEndRef.current) {
        audio.pause();
        clearSegment();
        setActiveUtterance(null);
      }
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      clearSegment();
    };
  }, []);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    clearSegment();
    setActiveUtterance(null);
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  const handleSeekPlay = useCallback((entryIdx: number, utterance: UtteranceSegment) => {
    const audio = audioRef.current;
    if (!audio) return;

    clearSegment();
    audio.currentTime = utterance.fileStartMs / 1000;
    setActiveUtterance({ entryIdx, utteranceIndex: utterance.index });
    audio.play();

    // Hard-stop at exactly fileDurationMs from now — more reliable than timeupdate polling
    segmentTimeoutRef.current = setTimeout(() => {
      audio.pause();
      clearSegment();
      setActiveUtterance(null);
    }, utterance.fileDurationMs);

    // Keep segmentEndRef for the timeupdate secondary safety net
    segmentEndRef.current = (utterance.fileStartMs + utterance.fileDurationMs) / 1000;
  }, []);

  return (
    <div className="player-wrapper">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      <div className="player-toolbar">
        <button className="reset-btn" onClick={onReset}>← Load Another</button>
        <span className="entry-count">{entries.length} recording{entries.length !== 1 ? 's' : ''}</span>
      </div>

      {entries.map((entry, entryIdx) => {
        const isExpanded = expandedIndex === entryIdx;
        const date = new Date(entry.startedAt);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
          <div key={entry.uri + entryIdx} className="recording-card">
            {/* Card header */}
            <div className="card-header">
              <div className="card-meta">
                <div className="card-title">{dateStr} · {timeStr}</div>
                <div className="card-subtitle">
                  {formatDuration(entry.durationMs)}
                  <span className="badge">{entry.platform}</span>
                  {!entry.hasAudio && <span className="badge badge--warn">may be silent</span>}
                  <span className="badge badge--muted">{entry.utterances.length} utterance{entry.utterances.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="card-booking">Booking: {entry.bookingId}</div>
              </div>
              <div className="card-actions">
                <button className="action-btn" onClick={handlePlayPause}>
                  {isPlaying ? '⏸ Pause' : '▶ Play All'}
                </button>
                {entry.utterances.length > 0 && (
                  <button
                    className="action-btn action-btn--secondary"
                    onClick={() => setExpandedIndex(isExpanded ? null : entryIdx)}
                  >
                    {isExpanded ? 'Hide Utterances' : `Show Utterances (${entry.utterances.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Utterance list */}
            {isExpanded && (
              <div className="utterance-list">
                {entry.utterances.map((u) => {
                  const isActive = activeUtterance?.entryIdx === entryIdx && activeUtterance?.utteranceIndex === u.index;
                  const wallStart = formatWallTime(u.wallStartAt);
                  const wallEnd = formatWallTime(u.wallEndAt);
                  const hasWallTime = !!(wallStart || wallEnd);
                  return (
                    <div
                      key={u.index}
                      className={`utterance-row ${isActive ? 'utterance-row--active' : ''}`}
                    >
                      <div className="utterance-index">{u.index + 1}</div>
                      <div className="utterance-body">
                        <div className="utterance-time-group">
                          {hasWallTime && (
                            <div className="utterance-time utterance-time--wall">
                              <span className="utterance-time-label">Wall</span>
                              <span className="utterance-time-value">
                                {wallStart ?? 'unknown'}{wallEnd ? ` → ${wallEnd}` : ''}
                              </span>
                            </div>
                          )}
                          <div className="utterance-time utterance-time--file">
                            <span className="utterance-time-label">File</span>
                            <span className="utterance-time-value">
                              {formatTime(u.fileStartMs)} → {formatTime(u.fileStartMs + u.fileDurationMs)}
                            </span>
                            <span className="utterance-duration">{formatDuration(u.fileDurationMs)}</span>
                          </div>
                        </div>
                        <div className="utterance-transcript">
                          {u.transcript ?? <span className="utterance-no-transcript">no transcript</span>}
                        </div>
                      </div>
                      <button
                        className="seek-btn"
                        onClick={() => handleSeekPlay(entryIdx, u)}
                        title="Play this utterance"
                      >
                        {isActive && isPlaying ? '⏸' : '▶'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
