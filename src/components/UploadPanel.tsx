import { useRef, useState } from 'react';
import type { AudioRecordingEntry } from '../types';

interface Props {
  onLoad: (audioUrl: string, entries: AudioRecordingEntry[]) => void;
}

export default function UploadPanel({ onLoad }: Props) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = () => {
    if (!audioFile || !jsonFile) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const entries: AudioRecordingEntry[] = Array.isArray(raw) ? raw : [raw];

        if (!entries.length || !Array.isArray(entries[0].utterances)) {
          setError('Invalid metadata JSON — expected an object or array with an "utterances" field.');
          return;
        }

        const audioUrl = URL.createObjectURL(audioFile);
        onLoad(audioUrl, entries);
      } catch {
        setError('Failed to parse JSON. Make sure the file is valid JSON.');
      }
    };
    reader.readAsText(jsonFile);
  };

  const canLoad = audioFile !== null && jsonFile !== null;

  return (
    <div className="upload-panel">
      <div className="upload-grid">
        {/* Audio file */}
        <div
          className={`drop-zone ${audioFile ? 'drop-zone--loaded' : ''}`}
          onClick={() => audioInputRef.current?.click()}
        >
          <div className="drop-zone-icon">🎙️</div>
          <div className="drop-zone-label">
            {audioFile ? audioFile.name : 'Click to select audio file'}
          </div>
          <div className="drop-zone-hint">.m4a · .mp4 · .aac</div>
          <input
            ref={audioInputRef}
            type="file"
            accept=".m4a,.mp4,.aac,.m4v,audio/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              setAudioFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </div>

        {/* JSON metadata file */}
        <div
          className={`drop-zone ${jsonFile ? 'drop-zone--loaded' : ''}`}
          onClick={() => jsonInputRef.current?.click()}
        >
          <div className="drop-zone-icon">📋</div>
          <div className="drop-zone-label">
            {jsonFile ? jsonFile.name : 'Click to select metadata JSON'}
          </div>
          <div className="drop-zone-hint">AudioRecordingEntry · single object or array</div>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              setJsonFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </div>
      </div>

      {error && <p className="upload-error">{error}</p>}

      <button className="load-btn" disabled={!canLoad} onClick={handleLoad}>
        Load Recording
      </button>

      <p className="upload-note">
        ⚠️ Firefox has limited .m4a support. Use Chrome, Safari, or Edge for best results.
      </p>
    </div>
  );
}
