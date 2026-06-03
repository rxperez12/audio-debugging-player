import { useRef, useState } from 'react';
import type {
  AudioRecordingEntry,
  AiAudioRecordingEntry,
  CombinedSession,
} from '../types';
import { decodeAudioFile } from '../audio/decodeFiles';
import { buildTimeline } from '../audio/buildTimeline';

interface Props {
  onLoad: (session: CombinedSession) => void;
}

function parseJson(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target?.result as string));
      } catch {
        reject(new Error(`Failed to parse JSON: ${file.name}`));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export default function UploadPanel({ onLoad }: Props) {
  const userAudioInputRef = useRef<HTMLInputElement>(null);
  const userJsonInputRef = useRef<HTMLInputElement>(null);
  const aiAudioInputRef = useRef<HTMLInputElement>(null);
  const aiJsonInputRef = useRef<HTMLInputElement>(null);

  const [userAudio, setUserAudio] = useState<File | null>(null);
  const [userJson, setUserJson] = useState<File | null>(null);
  const [aiAudio, setAiAudio] = useState<File | null>(null);
  const [aiJson, setAiJson] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // AI pair must be provided together (both or neither).
  const aiPairComplete = (aiAudio !== null) === (aiJson !== null);
  const canLoad = userAudio !== null && userJson !== null && aiPairComplete && !loading;

  const handleLoad = async () => {
    if (!userAudio || !userJson) return;
    if (!aiPairComplete) {
      setError('AI audio and AI metadata must be provided together.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const userRaw = await parseJson(userJson);
      const userEntries: AudioRecordingEntry[] = Array.isArray(userRaw)
        ? (userRaw as AudioRecordingEntry[])
        : [userRaw as AudioRecordingEntry];

      if (!userEntries.length || !Array.isArray(userEntries[0].utterances)) {
        throw new Error('Invalid user metadata — expected an object/array with an "utterances" field.');
      }

      const userBuffer = await decodeAudioFile(userAudio);

      let ai: CombinedSession['ai'];
      let aiEntries: AiAudioRecordingEntry[] | undefined;
      if (aiAudio && aiJson) {
        const aiRaw = await parseJson(aiJson);
        aiEntries = Array.isArray(aiRaw)
          ? (aiRaw as AiAudioRecordingEntry[])
          : [aiRaw as AiAudioRecordingEntry];
        const aiBuffer = await decodeAudioFile(aiAudio);
        ai = { buffer: aiBuffer, entries: aiEntries };
      }

      const { rows, t0Ms, aiOffsetMs, userOffsetMs } = buildTimeline(userEntries, aiEntries);

      onLoad({
        user: { buffer: userBuffer, entries: userEntries },
        ai,
        rows,
        t0Ms,
        aiOffsetMs,
        userOffsetMs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recording.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-panel">
      <div className="upload-grid">
        {/* User audio */}
        <div
          className={`drop-zone ${userAudio ? 'drop-zone--loaded' : ''}`}
          onClick={() => userAudioInputRef.current?.click()}
        >
          <div className="drop-zone-icon">🎙️</div>
          <div className="drop-zone-label">
            {userAudio ? userAudio.name : 'User audio (required)'}
          </div>
          <div className="drop-zone-hint">.m4a · .mp4 · .aac</div>
          <input
            ref={userAudioInputRef}
            type="file"
            accept=".m4a,.mp4,.aac,.m4v,audio/*"
            style={{ display: 'none' }}
            onChange={(e) => { setUserAudio(e.target.files?.[0] ?? null); setError(null); }}
          />
        </div>

        {/* User JSON */}
        <div
          className={`drop-zone ${userJson ? 'drop-zone--loaded' : ''}`}
          onClick={() => userJsonInputRef.current?.click()}
        >
          <div className="drop-zone-icon">📋</div>
          <div className="drop-zone-label">
            {userJson ? userJson.name : 'User metadata (required)'}
          </div>
          <div className="drop-zone-hint">AudioRecordingEntry · .json</div>
          <input
            ref={userJsonInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => { setUserJson(e.target.files?.[0] ?? null); setError(null); }}
          />
        </div>

        {/* AI audio */}
        <div
          className={`drop-zone ${aiAudio ? 'drop-zone--loaded' : ''}`}
          onClick={() => aiAudioInputRef.current?.click()}
        >
          <div className="drop-zone-icon">🤖</div>
          <div className="drop-zone-label">
            {aiAudio ? aiAudio.name : 'AI audio (optional)'}
          </div>
          <div className="drop-zone-hint">.ai.wav</div>
          <input
            ref={aiAudioInputRef}
            type="file"
            accept=".wav,audio/wav,audio/*"
            style={{ display: 'none' }}
            onChange={(e) => { setAiAudio(e.target.files?.[0] ?? null); setError(null); }}
          />
        </div>

        {/* AI JSON */}
        <div
          className={`drop-zone ${aiJson ? 'drop-zone--loaded' : ''}`}
          onClick={() => aiJsonInputRef.current?.click()}
        >
          <div className="drop-zone-icon">🗂️</div>
          <div className="drop-zone-label">
            {aiJson ? aiJson.name : 'AI metadata (optional)'}
          </div>
          <div className="drop-zone-hint">AiAudioMetadata · .ai.json</div>
          <input
            ref={aiJsonInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => { setAiJson(e.target.files?.[0] ?? null); setError(null); }}
          />
        </div>
      </div>

      {!aiPairComplete && (
        <p className="upload-error">AI audio and AI metadata must be provided together.</p>
      )}
      {error && <p className="upload-error">{error}</p>}

      <button className="load-btn" disabled={!canLoad} onClick={handleLoad}>
        {loading ? 'Decoding…' : 'Load Recording'}
      </button>

      <p className="upload-note">
        ⚠️ Firefox has limited .m4a support. Use Chrome, Safari, or Edge for best results.
      </p>
    </div>
  );
}
