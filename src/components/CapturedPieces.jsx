// src/components/CapturedPieces.jsx
import React from "react";

const pieceImages = {
  w: {
    p: "https://chessboardjs.com/img/chesspieces/wikipedia/wP.png",
    n: "https://chessboardjs.com/img/chesspieces/wikipedia/wN.png",
    b: "https://chessboardjs.com/img/chesspieces/wikipedia/wB.png",
    r: "https://chessboardjs.com/img/chesspieces/wikipedia/wR.png",
    q: "https://chessboardjs.com/img/chesspieces/wikipedia/wQ.png",
    k: "https://chessboardjs.com/img/chesspieces/wikipedia/wK.png",
  },
  b: {
    p: "https://chessboardjs.com/img/chesspieces/wikipedia/bP.png",
    n: "https://chessboardjs.com/img/chesspieces/wikipedia/bN.png",
    b: "https://chessboardjs.com/img/chesspieces/wikipedia/bB.png",
    r: "https://chessboardjs.com/img/chesspieces/wikipedia/bR.png",
    q: "https://chessboardjs.com/img/chesspieces/wikipedia/bQ.png",
    k: "https://chessboardjs.com/img/chesspieces/wikipedia/bK.png",
  },
};

const pieceNames = {
  p: "Pawn",
  n: "Knight", 
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King"
};

const pieceValues = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

export default function CapturedPieces({ pieces, color, label, chessComStyle = false }) {
  // Safety check for pieces array
  if (!pieces || pieces.length === 0) {
    // In chess.com style, show empty state more subtly
    if (chessComStyle) {
      return (
        <div className="flex items-center justify-between py-1.5 px-3 bg-slate-800/20 rounded-lg border border-slate-600/20">
          {/* Left side - Label and count (empty state) */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs sm:text-sm font-medium truncate">{label}</span>
            <div className="px-1.5 py-0.5 bg-slate-600/30 text-slate-400 text-xs rounded-full flex-shrink-0">
              0
            </div>
          </div>
          
          {/* Center - Empty message (hidden on very small screens) */}
          <div className="hidden sm:block text-slate-500 text-xs">No pieces captured</div>
          
          {/* Right side - empty for consistency */}
          <div></div>
        </div>
      );
    }
    
    return (
      <div className="p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
        <div className="text-center py-4 text-slate-400 text-sm">
          No pieces captured yet
        </div>
      </div>
    );
  }

  // Filter out any undefined/null values and calculate total material value
  const validPieces = pieces.filter(p => p != null);
  const totalValue = validPieces.reduce((sum, p) => {
    const pieceType = typeof p === "object" ? p.type : p;
    return sum + (pieceValues[pieceType] || 0);
  }, 0);

  // Group pieces by type for better display
  const groupedPieces = validPieces.reduce((acc, p) => {
    const pieceType = typeof p === "object" ? p.type : p;
    // FIX: Determine the piece color correctly
    // Since captured pieces are stored as strings (piece types only),
    // we need to infer the color from the context
    let pieceColor;
    if (typeof p === "object" && p.color) {
      pieceColor = p.color;
    } else {
      // For captured pieces, we need to determine the color based on which array this is
      // If this is whiteCaptured array, these are white pieces that were captured
      // If this is blackCaptured array, these are black pieces that were captured
      // The color prop should indicate which pieces these are
      pieceColor = color || (label && label.includes("Your") ? "w" : "b");
    }
    
    const key = `${pieceColor}-${pieceType}`;
    
    if (!acc[key]) {
      acc[key] = { type: pieceType, color: pieceColor, count: 0 };
    }
    acc[key].count += 1;
    return acc;
  }, {});

  // Chess.com style - horizontal strip with label and pieces
  if (chessComStyle) {
    return (
      <div className="flex items-center justify-between py-1.5 px-3 bg-slate-800/20 backdrop-blur-sm rounded-lg border border-slate-600/40">
        {/* Left side - Label and count */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white text-xs sm:text-sm font-medium truncate">{label}</span>
          <div className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30 flex-shrink-0">
            {validPieces.length}
          </div>
        </div>
        
        {/* Center - Pieces display (scrollable on very small screens) */}
        <div className="flex-1 mx-3 min-w-0">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {Object.values(groupedPieces).map((group, index) => {
              // Safety check for group properties
              if (!group.color || !group.type || !pieceImages[group.color] || !pieceImages[group.color][group.type]) {
                console.warn('Invalid piece data:', group);
                return null;
              }
              
              return (
                <div
                  key={index}
                  className="group relative flex items-center flex-shrink-0"
                >
                  <div className="relative p-0.5 sm:p-1 bg-slate-700/40 rounded border border-slate-600/30 hover:bg-slate-600/50 hover:border-slate-500/50 transition-all duration-200 shadow-sm">
                    <img
                      src={pieceImages[group.color][group.type]}
                      alt={`${group.color}${group.type}`}
                      className="w-4 h-4 sm:w-5 sm:h-5 opacity-95 hover:opacity-100 transition-opacity duration-200 drop-shadow-sm"
                    />
                    
                    {/* Count badge */}
                    {group.count > 1 && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center border border-white/20 shadow-sm">
                        <span className="text-xs leading-none">{group.count}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Tooltip - Hidden on mobile */}
                  <div className="hidden sm:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
                    {group.count > 1 ? `${group.count} ` : ''}{pieceNames[group.type]}{group.count > 1 ? 's' : ''}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-2 border-transparent border-t-slate-900"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side - Value indicator */}
        <div className="flex items-center flex-shrink-0">
          {totalValue > 0 && (
            <div className="flex items-center gap-1 text-yellow-400">
              <span className="text-xs sm:text-sm font-semibold">+{totalValue}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Original full-size version for other contexts
  return (
    <div className="p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        {label && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{label}</span>
            <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
              {validPieces.length} {validPieces.length === 1 ? 'piece' : 'pieces'}
            </div>
          </div>
        )}
        
        {totalValue > 0 && (
          <div className="flex items-center gap-1 text-yellow-400">
            <span className="text-sm font-semibold">+{totalValue}</span>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Pieces display */}
      <div className="flex flex-wrap gap-2">
        {Object.values(groupedPieces).map((group, index) => {
          // Safety check for group properties
          if (!group.color || !group.type || !pieceImages[group.color] || !pieceImages[group.color][group.type]) {
            console.warn('Invalid piece data:', group);
            return null;
          }
          
          return (
            <div
              key={index}
              className="group relative flex items-center gap-1 p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-emerald-400/30 transition-all duration-200"
            >
              {/* Piece image */}
              <div className="relative">
                <img
                  src={pieceImages[group.color][group.type]}
                  alt={`${group.color}${group.type}`}
                  className="w-8 h-8 transition-transform duration-200 group-hover:scale-110"
                />
                
                {/* Count badge */}
                {group.count > 1 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {group.count}
                  </div>
                )}
              </div>
              
              {/* Tooltip on hover */}
              <div className="hidden sm:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                {group.count > 1 ? `${group.count} ` : ''}{pieceNames[group.type]}{group.count > 1 ? 's' : ''}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-2 border-transparent border-t-slate-800"></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}