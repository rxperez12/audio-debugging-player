import { useState } from 'react';
import './App.css';
import type { CombinedSession } from './types';
import UploadPanel from './components/UploadPanel.tsx';
import RecordingPlayer from './components/RecordingPlayer.tsx';

function App() {
  const [session, setSession] = useState<CombinedSession | null>(null);

  const handleLoad = (loaded: CombinedSession) => {
    setSession(loaded);
  };

  const handleReset = () => {
    setSession(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Audio Debugging Player</h1>
        <p className="app-subtitle">Upload user + AI recordings to inspect a wall-clock-aligned timeline</p>
      </header>
      <main className="app-main">
        {session ? (
          <RecordingPlayer session={session} onReset={handleReset} />
        ) : (
          <UploadPanel onLoad={handleLoad} />
        )}
      </main>
    </div>
  );
}

export default App;
