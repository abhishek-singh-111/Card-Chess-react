// src/FriendGameModal.jsx
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";

export default function FriendGameModal({ onClose, mode, socket }) {
  const [step, setStep] = useState("menu"); // menu | creating | joining | waiting | playing
  const [roomId, setRoomId] = useState(null);
  const [inputId, setInputId] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    socket.on("room_created", ({ roomId, mode }) => {
      setRoomId(roomId);
      generateShareLink(roomId, mode);
      setStep("waiting");
    });

    socket.on("match_found", ({ roomId, color, fen, mode }) => {
      // Redirect instead of rendering OnlineGame
      const gameUrl = `/friend?mode=${mode}&roomId=${roomId}&color=${color}&fen=${encodeURIComponent(
        fen
      )}`;
      onClose();
      navigate(gameUrl);
    });

    socket.on("room-ok", ({ roomId, mode }) => {
      socket.emit("join_room", { roomId, mode });
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

    return () => {
      // socket.disconnect();
      socket.off("room_created");
      socket.off("match_found");
      socket.off("room-ok");
      socket.off("error");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, mode]);

  const generateShareLink = (roomId, mode) => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/friend?roomId=${roomId}&mode=${mode}&join=true`;
    setGeneratedLink(shareUrl);
    return shareUrl;
  };

  const copyRoomId = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Room ID copied!");
    } catch (err) {
      toast.error("Failed to copy Room ID");
    }
  };

  const copyShareLink = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setLinkCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  // ------------- UI -------------
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 relative">
        {/* Close button */}
        {step !== "playing" && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-slate-400 hover:text-white"
          >
            X
          </button>
        )}

        {step === "menu" && (
          <div className="text-center space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">
              Play with Friend
            </h2>
            <button
              onClick={() => setStep("choose_mode")}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              Create Room
            </button>
            <button
              onClick={() => setStep("joining")}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              Join Room
            </button>
            <button
              onClick={onClose}
              className="w-full mt-2 py-2 text-slate-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {step === "choose_mode" && (
          <div className="text-center space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">
              Choose Game Mode
            </h2>
            <button
              onClick={() => {
                socket.emit("create_room", { mode: "standard" });
                setStep("creating");
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              Standard Game
            </button>
            <button
              onClick={() => {
                socket.emit("create_room", { mode: "timed" });
                setStep("creating");
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              Timed Game (10 min)
            </button>
            <button
              onClick={() => setStep("menu")}
              className="w-full mt-2 py-2 text-slate-400 hover:text-white text-sm"
            >
              Back
            </button>
          </div>
        )}

        {step === "waiting" && (
          <div className="text-center space-y-3">
            <h2 className="text-lg text-white">Room Created</h2>

            {/* Room ID Section */}
            <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50">
              <p className="text-slate-300 text-sm mb-2">Room ID:</p>
              <div className="flex items-center gap-2">
                <strong className="text-emerald-400 text-xl font-mono bg-slate-800/50 px-3 py-1 rounded-lg flex-1">
                  {roomId || "..."}
                </strong>
                <button
                  onClick={() => copyRoomId(roomId)}
                  className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-white transition-colors"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Share Link Section */}
            <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-600/30">
              <p className="text-emerald-200 text-sm mb-2">
                Or share this direct link:
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={generatedLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white text-xs font-mono"
                />
                <button
                  onClick={() => copyShareLink(generatedLink)}
                  className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                    linkCopied
                      ? "bg-green-600 text-white"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {linkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-emerald-300 text-xs mt-2">
                Your friend can click this link to join instantly!
              </p>
            </div>

            <p className="text-slate-400">Waiting for friend to join...</p>
            <button
              onClick={() => {
                socket.emit("leave_match", { roomId });
                setRoomId(null);
                onClose();
              }}
              className="w-full py-2 mt-2 bg-red-600 hover:bg-red-500 text-white rounded-xl"
            >
              Cancel
            </button>
          </div>
        )}

        {step === "joining" && (
          <div className="text-center space-y-3">
            <h2 className="text-lg text-white">Join Game Room</h2>
            <input
              placeholder="Enter Room ID"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white"
            />
            <button
              onClick={() => {
                if (inputId.trim()) {
                  socket.emit("check_room", { roomId: inputId.trim(), mode });
                } else {
                  toast.warning("Please enter a room ID");
                }
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
            >
              Join
            </button>
            <button
              onClick={() => setStep("menu")}
              className="w-full mt-2 py-2 text-slate-400 hover:text-white text-sm"
            >
              Back
            </button>
          </div>
        )}

        {step === "joining_wait" && (
          <div className="text-center space-y-3">
            <h2 className="text-lg text-white">Joining Room...</h2>
            <p className="text-slate-400">
              Trying to connect with Room ID: {inputId}
            </p>
            <button
              onClick={() => setStep("menu")}
              className="w-full mt-2 py-2 text-slate-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
