import React from "react";
import { motion } from "framer-motion";

function CardSVG({
  cardId,
  large = false,
  isMobile = false,
  compact = false,
  dynamicHeight = null,
}) {
  if (!cardId) return null;

  const isPawn = cardId.startsWith("pawn-");
  const label = isPawn
    ? `Pawn ${cardId.split("-")[1].toUpperCase()}`
    : cardId[0].toUpperCase() + cardId.slice(1);
  const symbol =
    isPawn
      ? "♟"
      : cardId === "knight"
      ? "♞"
      : cardId === "bishop"
      ? "♝"
      : cardId === "rook"
      ? "♜"
      : cardId === "queen"
      ? "♛"
      : "♚";

  // Gradient colors
  const bgGradient = isPawn
    ? "from-amber-400 to-yellow-500"
    : "from-blue-400 to-indigo-500";

  // Dynamic height scaling
  const getCardHeight = () => {
    if (dynamicHeight) return `${dynamicHeight}px`;
    if (compact) return "80px";
    if (isMobile) return "120px";
    if (large) return "100%";
    return "700rem"; // bigger default cards for desktop
  };

  return (
    <div
      className={`
        relative w-full 
        transform transition-all duration-300 ease-out
        hover:scale-105 hover:-translate-y-1
      `}
      style={{ height: getCardHeight(), minHeight: getCardHeight() }}
    >
      {/* Glow background */}
      <div
        className={`
          absolute -inset-0.5 bg-gradient-to-r ${bgGradient} rounded-2xl blur opacity-20
          group-hover:opacity-40 transition-opacity duration-300
        `}
      />

      {/* Main card body */}
      <div
        className={`
          relative w-full h-full bg-gradient-to-br ${bgGradient} rounded-2xl
          border border-white/20 shadow-xl backdrop-blur-sm overflow-hidden
        `}
      >
        {/* Shine overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between items-center p-2 z-10">
          {/* Header */}
          <div className="text-white/80 font-bold text-xs">CARD</div>

          {/* Animated Symbol */}
          <motion.div
            className={`
              text-white drop-shadow-lg
              ${isMobile ? "text-3xl" : large ? "text-6xl" : "text-4xl"}
            `}
            whileHover={{
              rotate: [0, -10, 10, -5, 5, 0],
              scale: [1, 1.1, 0.95, 1.05, 1],
              transition: { duration: 0.8 },
            }}
          >
            {symbol}
          </motion.div>

          {/* Footer */}
          <div className="text-white font-bold text-xs truncate">{label}</div>
        </div>

        {/* Hover overlay */}
        <div
          className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-colors duration-300 rounded-2xl"
        />
      </div>
    </div>
  );
}

const CardDisplay = ({
  options,
  isMyTurn,
  isMobile = false,
  compact = false,
  availableHeight = null,
}) => {
  // Calculate dynamic card height (esp. mobile/compact)
  const getDynamicCardHeight = () => {
    if (!compact || !availableHeight) return null;

    const padding = 16;
    const availableCardHeight = availableHeight - padding;

    const minHeight = 80;
    const maxHeight = 160;

    return Math.max(minHeight, Math.min(maxHeight, availableCardHeight));
  };

  const dynamicHeight = getDynamicCardHeight();

  // Regular choice grid
  const choiceGrid = (
    <div className="flex flex-col h-full gap-4">
      {/* Cards header */}
      <div className="flex items-center justify-between">
        <h3
          className={`font-bold text-white flex items-center gap-2 ${
            isMobile ? "text-sm" : "text-lg"
          }`}
        >
          <span className="text-emerald-400">🃏</span>
          Your Cards
        </h3>
        <div
          className={`px-2 py-1 bg-emerald-500/20 text-emerald-400 font-bold rounded-full border border-emerald-500/30 ${
            isMobile ? "text-xs" : "text-sm"
          }`}
        >
          {options.length}/3
        </div>
      </div>

      {/* Cards Grid */}
      <div
        className={`${
          isMobile
            ? "flex gap-2 flex-1"
            : "grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1"
        }`}
      >
        {options.map((cardId) => (
          <div
            key={cardId}
            // className={`group relative ${
            //   isMobile ? "flex-1 min-w-0" : "h-full"
            // }`}
            className={`group relative ${
    isMobile ? "flex-1 min-w-0 h-48" : "h-48"
  }`}
          >
            <CardSVG
              cardId={cardId}
              large={true}
              isMobile={isMobile}
              compact={compact}
              dynamicHeight={dynamicHeight}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const waitingState = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <span className="text-blue-400">🤖</span>
          AI Turn
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <span className="text-blue-400 font-medium text-sm">Thinking...</span>
        </div>
      </div>

      {/* Placeholder shimmer */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-slate-700/30 rounded-xl border-2 border-dashed border-slate-600/50 flex items-center justify-center h-48 animate-pulse"
          >
            <span className="text-slate-500 text-2xl">?</span>
          </div>
        ))}
      </div>
    </div>
  );

  const noCardsState = (
    <div className="space-y-4">
      <h3 className="font-bold text-white flex items-center gap-2">
        <span className="text-amber-400">⏳</span>
        Waiting for Cards
      </h3>
      <div className="text-center py-8">
        <div className="mb-2 text-5xl">🎲</div>
        <h4 className="font-bold text-white mb-1 text-lg">Drawing cards...</h4>
        <div className="flex justify-center gap-1 mt-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-emerald-400 rounded-full animate-bounce w-2 h-2"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`${
        isMobile || compact
          ? ""
          : "p-6 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10"
      } flex-1 flex flex-col`}
    >
      {isMyTurn
        ? options.length > 0
          ? choiceGrid
          : noCardsState
        : waitingState}
    </div>
  );
};

export default CardDisplay;
