// src/FriendGame.jsx
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import OnlineGame from "./OnlineGame";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

//const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:4000";
const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://card-chess.onrender.com";

export default function FriendGame({ onExit }) {
  const [socket] = useState(() => io(SERVER_URL));
  const navigate = useNavigate();
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

    socket.on("room-ok", ({ roomId }) => {
      // Now safe to actually join
      socket.emit("join_room", { roomId });
      setStep("joining_wait");
    });

    socket.on("error", (errorType) => {
      if (errorType === "room-not-found") {
        toast.error("Room not found. Please check the ID and try again.");
        setStep("joining");
      } else if (errorType === "room-full") {
        toast.error("This room is already full.");
        setStep("joining");
      } else if (errorType === "room-abandoned") {
        toast.error("Room creator has left. Please join another room.");
        setStep("joining");
      }
    });

    socket.on("opponent_left", () => {
      // Do nothing here, OnlineGame will handle toast + redirect
    });

    return () => {
      socket.off("room-ok");
      socket.off("error");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Handle browser back button in FriendGame
  useEffect(() => {
    const handleBack = () => {
      if (roomId) {
        socket.emit("leave_match", { roomId });
      }
      navigate("/");
    };

    window.addEventListener("popstate", handleBack);

    return () => {
      window.removeEventListener("popstate", handleBack);
    };
  }, [step, roomId, socket, navigate]);

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
        <button onClick={() => navigate("/")}>Back</button>
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
        <button
          onClick={() => {
            socket.emit("leave_match", { roomId });
            setRoomId(null);
            navigate("/");
          }}
        >
          Cancel
        </button>
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
          style={{
            padding: "8px",
            marginRight: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={() => {
            if (inputId.trim()) {
              socket.emit("check_room", { roomId: inputId.trim() });
            } else {
              toast.warning("Please enter a room ID");
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
