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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full border border-white/10 shadow-2xl backdrop-blur-xl">
        <h3 className="text-2xl font-bold text-white mb-3 text-center">
          Game Over
        </h3>
        <p className="text-slate-300 mb-6 text-center">{message}</p>

        <div className="flex flex-col gap-3">
          {isFriendMode ? (
            <>
              <button
                onClick={onRematch}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all duration-200"
              >
                Rematch
              </button>
              <button
                onClick={onEndFriendMatch}
                className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-all duration-200"
              >
                Back to Menu
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onFindNewOpponent}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all duration-200"
              >
                Find New Opponent
              </button>
              <button
                onClick={onLeaveMatch}
                className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-all duration-200"
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
