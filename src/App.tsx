import { useState } from 'react';
import './App.css';
import type { AudioRecordingEntry } from './types';
import UploadPanel from './components/UploadPanel.tsx';
import RecordingPlayer from './components/RecordingPlayer.tsx';

function App() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [entries, setEntries] = useState<AudioRecordingEntry[]>([]);

  const handleLoad = (url: string, loaded: AudioRecordingEntry[]) => {
    setAudioUrl(url);
    setEntries(loaded);
  };

  const handleReset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setEntries([]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Audio Debugging Player</h1>
        <p className="app-subtitle">Upload a recording + metadata to inspect utterance timelines</p>
      </header>
      <main className="app-main">
        {audioUrl && entries.length > 0 ? (
          <RecordingPlayer audioUrl={audioUrl} entries={entries} onReset={handleReset} />
        ) : (
          <UploadPanel onLoad={handleLoad} />
        )}
      </main>
    </div>
  );
}

export default App;
