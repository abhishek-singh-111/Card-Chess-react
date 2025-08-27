// src/components/GameOverModal.jsx
import React from "react";

export default function GameOverModal({
  show,
  message,
  isFriendMode,
  onRematch,
  onEndFriendMatch,
  onFindNewOpponent,
  onLeaveMatch,
}) {
  if (!show) return null;
  console.log("isFriendMode in GameOverModal:", isFriendMode);
  

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Game Over</h3>
        <p className="text-gray-600 mb-4">{message}</p>

        <div className="flex flex-col gap-3">
          {isFriendMode ? (
            <>
              <button
                onClick={onRematch}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                Rematch
              </button>
              <button
                onClick={onEndFriendMatch}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold"
              >
                Back to Menu
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onFindNewOpponent}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                Find New Opponent
              </button>
              <button
                onClick={onLeaveMatch}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold"
              >
                Back to Menu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
