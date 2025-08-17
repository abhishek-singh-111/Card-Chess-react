// src/pages/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1>Card Chess</h1>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 24 }}>
        <Link to="/local">
          <button style={{ padding: '12px 20px' }}>Play Two Player (Local)</button>
        </Link>
        <Link to="/online">
          <button style={{ padding: '12px 20px' }}>Play Online (Matchmaking)</button>
        </Link>
        <Link to="/friend">
          <button style={{ padding: '12px 20px' }}>Play with Friend (Online)</button>
        </Link>
      </div>
      <p style={{ marginTop: 24 }}>
        Open another browser/tab and select Play Online or Play with Friend to get matched.
      </p>
    </div>
  );
}
