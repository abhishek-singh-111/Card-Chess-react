// src/App.js
import React, { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';

export default function App(){
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  if (!mode) return (
    <div style={{padding:40, textAlign:'center'}}>
      <h1>Card Chess</h1>
      <div style={{display:'flex', gap:20, justifyContent:'center', marginTop:24}}>
        <button style={{padding:'12px 20px'}} onClick={()=>setMode('local')}>Play Two Player (Local)</button>
        <button style={{padding:'12px 20px'}} onClick={()=>setMode('online')}>Play Online (Matchmaking)</button>
      </div>
      <p style={{marginTop:24}}>Open another browser/tab and select Play Online to get matched.</p>
    </div>
  );

  return mode === 'local' ? <LocalGame onExit={()=>setMode(null)} /> : <OnlineGame onExit={()=>setMode(null)} />;
}
