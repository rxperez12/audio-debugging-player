import { useEffect, useMemo, useRef, useState } from 'react';
import type { CombinedSession, TimelineRow } from '../types';
import { SessionPlayer } from '../audio/SessionPlayer';

interface Props {
  session: CombinedSession;
  onReset: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatOffset(ms: number): string {
  const sign = ms < 0 ? '-' : '';
  return `${sign}${formatDuration(Math.abs(ms))}`;
}

function formatWallTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function RecordingPlayer({ session, onReset }: Props) {
  const player = useMemo(() => new SessionPlayer(session), [session]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    player.setOnEnded(() => {
      setIsPlaying(false);
      setActiveRowKey(null);
    });
    return () => {
      player.setOnEnded(null);
      player.stop();
    };
  }, [player]);

  const rowKey = (row: TimelineRow) => `${row.speaker}-${row.entryIdx}-${row.utteranceIndex}`;

  const handlePlayAll = () => {
    setActiveRowKey(null);
    setIsPlaying(true);
    void player.schedulePlayAll();
  };

  const handleStop = () => {
    player.stop();
    setIsPlaying(false);
    setActiveRowKey(null);
  };

  const handlePlayRow = (row: TimelineRow) => {
    if (row.noAudio) return;
    const key = rowKey(row);
    if (activeRowKey === key && isPlaying) {
      handleStop();
      return;
    }
    setActiveRowKey(key);
    setIsPlaying(true);
    void player.playRow(row);
  };

  const userEntry = session.user.entries[0];
  const aiEntry = session.ai?.entries[0];
  const startDate = new Date(session.t0Ms);
  const dateStr = startDate.toLocaleDateString();
  const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const aiHasUtterances = (session.ai?.entries ?? []).some(
    (e) => (e.utterances?.length ?? 0) > 0,
  );

  return (
    <div className="player-wrapper">
      <div className="player-toolbar">
        <button className="reset-btn" onClick={onReset}>← Load Another</button>
        <span className="entry-count">
          {session.rows.length} utterance{session.rows.length !== 1 ? 's' : ''}
          {session.ai ? ' · user + AI' : ' · user only'}
        </span>
      </div>

      <div className="recording-card">
        <div className="card-header">
          <div className="card-meta">
            <div className="card-title">{dateStr} · {timeStr}</div>
            <div className="card-subtitle">
              <span className="badge">{userEntry?.platform ?? 'unknown'}</span>
              <span className="badge badge--muted">user {formatDuration(userEntry?.durationMs ?? 0)}</span>
              {userEntry && !userEntry.hasAudio && <span className="badge badge--warn">user may be silent</span>}
              {session.ai && (
                <span className="badge badge--muted">AI {formatDuration(aiEntry?.durationMs ?? 0)}</span>
              )}
              {session.ai && aiEntry && !aiEntry.hasAudio && (
                <span className="badge badge--warn">AI may be silent</span>
              )}
            </div>
            {userEntry && <div className="card-booking">Booking: {userEntry.bookingId}</div>}
          </div>
          <div className="card-actions">
            <button className="action-btn" onClick={isPlaying && !activeRowKey ? handleStop : handlePlayAll}>
              {isPlaying && !activeRowKey ? '⏹ Stop' : '▶ Play All'}
            </button>
          </div>
        </div>

        {session.ai && !aiHasUtterances && (
          <div className="player-notice">AI metadata has no utterances — AI audio will still play on “Play All”.</div>
        )}

        <div className="utterance-list">
          {session.rows.map((row) => {
            const key = rowKey(row);
            const isActive = activeRowKey === key;
            const wall = formatWallTime(row.wallStartAt);
            return (
              <div key={key} className={`utterance-row ${isActive ? 'utterance-row--active' : ''} ${row.noAudio ? 'utterance-row--no-audio' : ''}`}>
                <div className={`speaker-badge speaker-badge--${row.speaker}`}>
                  {row.speaker === 'ai' ? 'AI' : 'You'}
                </div>
                <div className="utterance-body">
                  <div className="utterance-time-group">
                    <div className="utterance-time utterance-time--wall">
                      <span className="utterance-time-label">T+</span>
                      <span className="utterance-time-value">{formatOffset(row.offsetMs)}</span>
                      {wall && <span className="utterance-duration">{wall}</span>}
                      {row.approximate && <span className="badge badge--warn">approx</span>}
                      {row.noAudio && <span className="badge badge--muted">text-only · no audio</span>}
                    </div>
                    <div className="utterance-time utterance-time--file">
                      <span className="utterance-time-label">Dur</span>
                      <span className="utterance-time-value">{formatDuration(row.fileDurationMs)}</span>
                    </div>
                  </div>
                  <div className="utterance-transcript">
                    {row.transcript ?? <span className="utterance-no-transcript">no transcript</span>}
                  </div>
                </div>
                <button
                  className="seek-btn"
                  onClick={() => handlePlayRow(row)}
                  disabled={row.noAudio}
                  title={row.noAudio ? 'No audio for this utterance' : 'Play this utterance'}
                >
                  {isActive && isPlaying ? '⏸' : '▶'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
