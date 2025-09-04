import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import OnlineGame from "./OnlineGame";
import FriendGameModal from "../components/FriendGameModal";
import { toast } from "react-toastify";

export default function FriendGamePage({ socket }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameData, setGameData] = useState(null);

  const roomId = searchParams.get("roomId");
  const color = searchParams.get("color");
  const fen = searchParams.get("fen");
  const mode = searchParams.get("mode") || "standard";
  const shouldAutoJoin = searchParams.get("join") === "true";

  // Check if we have game data from URL params
  useEffect(() => {
    if (roomId && color && fen) {
      setGameData({ roomId, color, fen, mode });
      setGameStarted(true);
    }
  }, [roomId, color, fen, mode]);

  useEffect(() => {
    // If we have roomId and shouldAutoJoin, automatically join the room
    if (roomId && shouldAutoJoin && socket && !gameStarted) {
      console.log("Auto-joining room:", roomId);
      
      const handleMatchFound = ({ roomId: matchRoomId, color, fen, mode: gameMode }) => {
        console.log("Match found via auto-join:", { matchRoomId, color, gameMode });
        // Update URL to include game data and start game
        const newUrl = `/friend?mode=${gameMode}&roomId=${matchRoomId}&color=${color}&fen=${encodeURIComponent(fen)}`;
        window.history.replaceState({}, '', newUrl);
        
        setGameData({ roomId: matchRoomId, color, fen, mode: gameMode });
        setGameStarted(true);
      };

      const handleError = (errorType) => {
        console.error("Auto-join error:", errorType);
        if (errorType === "room-not-found") {
          toast.error("Room not found. The game may have ended or the link is invalid.");
        } else if (errorType === "room-full") {
          toast.error("This room is already full.");
        } else if (errorType === "room-abandoned") {
          toast.error("The room creator has left.");
        }
        setTimeout(() => navigate("/"), 3000);
      };

      const handleRoomOk = ({ roomId: validRoomId, mode: validMode }) => {
        console.log("Room validated, joining:", validRoomId);
        socket.emit("join_room", { roomId: validRoomId, mode: validMode });
      };

      socket.on("match_found", handleMatchFound);
      socket.on("error", handleError);
      socket.on("room-ok", handleRoomOk);

      socket.emit("check_room", { roomId, mode });

      return () => {
        socket.off("match_found", handleMatchFound);
        socket.off("error", handleError);
        socket.off("room-ok", handleRoomOk);
      };
    }
  }, [roomId, shouldAutoJoin, mode, socket, navigate, gameStarted]);

  // If game has started, render the game
  if (gameStarted && gameData) {
    return (
      <OnlineGame
        socket={socket}
        roomId={gameData.roomId}
        color={gameData.color}
        fen={gameData.fen}
        mode={gameData.mode}
      />
    );
  }

  // If we're auto-joining, show loading state
  if (roomId && shouldAutoJoin && !gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎮</div>
          <h2 className="text-2xl font-bold text-white mb-4">Joining Game...</h2>
          <p className="text-slate-300 mb-8">Connecting to room {roomId}</p>
          <div className="flex justify-center gap-1 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-emerald-400 rounded-full animate-bounce w-3 h-3"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <button
            onClick={() => navigate("/")}
            className="py-3 px-6 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Otherwise, show the friend game modal (manual room creation/joining)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <FriendGameModal 
        socket={socket} 
        onClose={() => navigate("/")}
        mode={mode}
      />
    </div>
  );
}