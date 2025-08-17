// // src/FriendGame.jsx
// import React, { useEffect, useState } from 'react';
// import { io } from 'socket.io-client';
// import OnlineGame from './OnlineGame';

// //const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:4000';
// const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://card-chess.onrender.com";

// const socket = io(SERVER_URL);

// export default function FriendGame({ onExit }) {
//   const [step, setStep] = useState('menu'); // menu | creating | joining | waiting | playing
//   const [roomId, setRoomId] = useState(null);
//   const [gameProps, setGameProps] = useState(null);

//   useEffect(() => {
//     socket.on('room_created', ({ roomId }) => {
//       setRoomId(roomId);
//       setStep('waiting');
//     });

//     socket.on('match_found', ({ roomId, color, fen }) => {
//       setGameProps({ socket, roomId, color, fen });
//       setStep('playing');
//     });

//     return () => {
//       socket.off('room_created');
//       socket.off('match_found');
//     };
//   }, []);

//   if (step === 'menu') {
//     return (
//       <div style={{ textAlign: 'center', padding: 40 }}>
//         <h1>Play with Friend</h1>
//         <button style={{ marginRight: '10px' }} onClick={() => { socket.emit('create_room'); setStep('creating'); }}>
//             Create Game Room
//         </button>

//         <button onClick={() => setStep('joining')}>
//             Join Game Room
//         </button>
//         <br/><br/>
//         <button onClick={onExit}>Back</button>
//       </div>
//     );
//   }

//   if (step === 'waiting') {
//     return (
//       <div style={{ textAlign: 'center', padding: 40 }}>
//         <h2>Room Created</h2>
//         <p>Share this Room ID with your friend:</p>
//         <strong>{roomId || '...'}</strong>
//         <p>Waiting for friend to join...</p>
//         <button onClick={onExit}>Cancel</button>
//       </div>
//     );
//   }

//   if (step === 'joining') {
//     let inputId = '';
//     return (
//       <div style={{ textAlign: 'center', padding: 40 }}>
//         <h2>Join Game Room</h2>
//         <input placeholder="Enter Room ID" onChange={e => inputId = e.target.value} />
//         <button onClick={() => socket.emit('join_room', { roomId: inputId })}>Join</button>
//         <br/><br/>
//         <button onClick={() => setStep('menu')}>Back</button>
//       </div>
//     );
//   }

//   if (step === 'playing' && gameProps) {
//     return <OnlineGame {...gameProps} onExit={onExit} />;
//   }

//   return null;
// }


// src/FriendGame.jsx
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import OnlineGame from "./OnlineGame";

// Use deployed server or fallback to localhost
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:4000';
//const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://card-chess.onrender.com";

const socket = io(SERVER_URL);

export default function FriendGame({ onExit }) {
  const [step, setStep] = useState("menu"); // menu | creating | joining | waiting | playing
  const [roomId, setRoomId] = useState(null);
  const [gameProps, setGameProps] = useState(null);
  const [inputId, setInputId] = useState(""); // <-- FIXED: state instead of let

  useEffect(() => {
    socket.on("room_created", ({ roomId }) => {
      setRoomId(roomId);
      setStep("waiting");
    });

    socket.on("match_found", ({ roomId, color, fen }) => {
      setGameProps({ socket, roomId, color, fen });
      setStep("playing");
    });

    socket.on("room_not_found", () => {
      alert("Room not found. Please check the ID and try again.");
      setStep("menu");
    });

    return () => {
      socket.off("room_created");
      socket.off("match_found");
      socket.off("room_not_found");
    };
  }, []);

  // -------- UI States --------
  if (step === "menu") {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h1>Play with Friend</h1>
        <button
          style={{ marginRight: "10px" }}
          onClick={() => {
            socket.emit("create_room");
            setStep("creating");
          }}
        >
          Create Game Room
        </button>

        <button onClick={() => setStep("joining")}>Join Game Room</button>
        <br />
        <br />
        <button onClick={onExit}>Back</button>
      </div>
    );
  }

  if (step === "waiting") {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2>Room Created</h2>
        <p>Share this Room ID with your friend:</p>
        <strong>{roomId || "..."}</strong>
        <p>Waiting for friend to join...</p>
        <button onClick={onExit}>Cancel</button>
      </div>
    );
  }

  if (step === "joining") {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2>Join Game Room</h2>
        <input
          placeholder="Enter Room ID"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
        />
        <button
          onClick={() => {
            if (inputId.trim()) {
              socket.emit("join_room", { roomId: inputId.trim() });
              setStep("joining_wait");
            }
          }}
        >
          Join
        </button>
        <br />
        <br />
        <button onClick={() => setStep("menu")}>Back</button>
      </div>
    );
  }

  if (step === "joining_wait") {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2>Joining Room...</h2>
        <p>Trying to connect with Room ID: {inputId}</p>
        <button onClick={() => setStep("menu")}>Cancel</button>
      </div>
    );
  }

  if (step === "playing" && gameProps) {
    return <OnlineGame {...gameProps} onExit={onExit} />;
  }

  return null;
}
