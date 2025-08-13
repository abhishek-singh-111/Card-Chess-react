// src/App.js
import React, { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';
import FriendGame from './FriendGame';

export default function App() {
  // null | 'local' | 'online' | 'friend'
  const [mode, setMode] = useState(null);

  if (!mode) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h1>Card Chess</h1>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 24 }}>
          <button style={{ padding: '12px 20px' }} onClick={() => setMode('local')}>
            Play Two Player (Local)
          </button>
          <button style={{ padding: '12px 20px' }} onClick={() => setMode('online')}>
            Play Online (Matchmaking)
          </button>
          <button style={{ padding: '12px 20px' }} onClick={() => setMode('friend')}>
            Play with Friend (Online)
          </button>
        </div>
        <p style={{ marginTop: 24 }}>
          Open another browser/tab and select Play Online or Play with Friend to get matched.
        </p>
      </div>
    );
  }

  if (mode === 'local') return <LocalGame onExit={() => setMode(null)} />;
  if (mode === 'online') return <OnlineGame onExit={() => setMode(null)} mode="matchmaking" />;
  if (mode === 'friend') return <FriendGame onExit={() => setMode(null)} />;

  return null;
}

