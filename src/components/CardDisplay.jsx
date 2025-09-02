import React from "react";
import { motion } from "framer-motion";

function CardSVG({
  cardId,
  large = false,
  isMobile = false,
  compact = false,
  dynamicHeight = null,
  isSelected = false,
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

  // Premium gradient colors matching homepage
  const bgGradient = isPawn
    ? "from-amber-500/90 to-yellow-600/90"
    : "from-emerald-500/90 to-emerald-700/90";

  const shadowColor = isPawn
    ? "shadow-amber-500/25"
    : "shadow-emerald-500/25";

  // Dynamic height scaling
  const getCardHeight = () => {
    if (dynamicHeight) return `${dynamicHeight}px`;
    if (compact) return "80px";
    if (isMobile) return "120px";
    if (large) return "100%";
    return "700rem";
  };

  return (
    <motion.div
      className="relative w-full h-full cursor-pointer"
      style={{ height: getCardHeight(), minHeight: getCardHeight() }}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* Selection glow ring */}
      {isSelected && (
        <div className="absolute -inset-1 bg-gradient-to-r from-white/60 via-emerald-400/60 to-white/60 rounded-2xl blur-sm animate-pulse" />
      )}

      {/* Hover glow background */}
      <div
        className={`
          absolute -inset-0.5 bg-gradient-to-r ${bgGradient} rounded-2xl blur opacity-0
          group-hover:opacity-30 transition-all duration-500 ${shadowColor}
        `}
      />

      {/* Main card body */}
      <div
        className={`
          relative w-full h-full bg-gradient-to-br from-slate-800/95 via-slate-800/90 to-slate-900/95
          rounded-2xl border-2 backdrop-blur-sm overflow-hidden
          ${isSelected 
            ? 'border-white/60 shadow-xl shadow-white/20' 
            : 'border-emerald-400/30 hover:border-emerald-400/60'
          }
          transition-all duration-300
        `}
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(45deg, rgba(16, 185, 129, 0.1) 25%, transparent 25%), 
                               linear-gradient(-45deg, rgba(16, 185, 129, 0.1) 25%, transparent 25%),
                               linear-gradient(45deg, transparent 75%, rgba(16, 185, 129, 0.1) 75%),
                               linear-gradient(-45deg, transparent 75%, rgba(16, 185, 129, 0.1) 75%)`,
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
            }}
          />
        </div>

        {/* Premium shine overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-emerald-400/10" />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between items-center p-3 z-10">
          {/* Header with elegant typography */}
          <div className="text-emerald-400/80 font-bold text-xs tracking-widest">
            CHESS
          </div>

          {/* Animated Symbol with premium effects */}
          <motion.div
            className={`
              text-white drop-shadow-2xl relative
              ${isMobile ? "text-4xl" : large ? "text-7xl" : "text-5xl"}
            `}
            whileHover={{
              rotate: [0, -8, 8, -4, 4, 0],
              scale: [1, 1.15, 0.95, 1.05, 1],
              transition: { duration: 0.6, ease: "easeInOut" },
            }}
          >
            {/* Symbol glow effect */}
            <div className={`absolute inset-0 text-emerald-400/40 blur-sm ${isMobile ? "text-4xl" : large ? "text-7xl" : "text-5xl"}`}>
              {symbol}
            </div>
            {symbol}
          </motion.div>

          {/* Footer with refined styling */}
          <div className="text-white/90 font-bold text-xs text-center tracking-wide leading-tight">
            {label.split(' ').map((word, i) => (
              <div key={i} className={i === 0 ? 'text-emerald-300' : 'text-white/70'}>
                {word}
              </div>
            ))}
          </div>
        </div>

        {/* Interactive hover overlay with gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-400/0 via-transparent to-emerald-400/0 hover:from-emerald-400/10 hover:to-emerald-400/5 transition-all duration-500 rounded-2xl" />

        {/* Selection indicator */}
        {isSelected && (
          <motion.div
            className="absolute inset-0 border-2 border-white/80 rounded-2xl"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />
        )}
      </div>
    </motion.div>
  );
}

const CardDisplay = ({
  options,
  isMyTurn,
  isMobile = false,
  compact = false,
  availableHeight = null,
  gameType = 'ai',
  onCardClick = null,
  selectedCard = null,
}) => {
  const getDynamicCardHeight = () => {
    if (!compact || !availableHeight) return null;
    const padding = 16;
    const availableCardHeight = availableHeight - padding;
    const minHeight = 80;
    const maxHeight = 160;
    return Math.max(minHeight, Math.min(maxHeight, availableCardHeight));
  };

  const dynamicHeight = getDynamicCardHeight();

  // Premium choice grid with enhanced animations
  const choiceGrid = (
    <motion.div 
      className="flex flex-col h-full gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Cards header with premium styling */}
      <div className="flex items-center justify-between">
        <motion.h3
          className={`font-bold text-white flex items-center gap-3 ${
            isMobile ? "text-sm" : "text-lg"
          }`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <span className="text-2xl filter drop-shadow-lg">🃏</span>
          <span className="bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
            Your Cards
          </span>
        </motion.h3>
        <motion.div
          className={`px-3 py-1.5 bg-gradient-to-r from-emerald-500/20 to-emerald-600/30 
                     text-emerald-300 font-bold rounded-full border border-emerald-400/40
                     backdrop-blur-sm shadow-lg ${
            isMobile ? "text-xs" : "text-sm"
          }`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {options.length}/3
        </motion.div>
      </div>

      {/* Cards Grid with staggered animations */}
      <div
        className={`${
          isMobile
            ? "flex gap-3 flex-1"
            : "grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1"
        }`}
      >
        {options.map((cardId, index) => (
          <motion.div
            key={cardId}
            className={`group relative ${
              isMobile ? "flex-1 min-w-0 h-48" : "h-48"
            } cursor-pointer`}
            onClick={() => onCardClick && onCardClick(cardId)}
            initial={{ opacity: 0, y: 30, rotateX: -15 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ 
              delay: 0.4 + (index * 0.1), 
              duration: 0.6,
              ease: "easeOut"
            }}
            whileHover={{ 
              y: -8,
              rotateY: 5,
              transition: { duration: 0.3 }
            }}
          >
            <CardSVG
              cardId={cardId}
              large={true}
              isMobile={isMobile}
              compact={compact}
              dynamicHeight={dynamicHeight}
              isSelected={selectedCard === cardId}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const waitingState = (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between">
        <motion.h3 
          className="font-bold text-white flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className="text-2xl filter drop-shadow-lg">
            {gameType === 'online' ? '👤' : '🤖'}
          </span>
          <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            {gameType === 'online' ? 'Opponent Turn' : 'AI Turn'}
          </span>
        </motion.h3>
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-blue-400 rounded-full"
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          <span className="text-blue-300 font-medium text-sm tracking-wide">
            {gameType === 'online' ? 'Waiting...' : 'Thinking...'}
          </span>
        </motion.div>
      </div>

      {/* Premium placeholder shimmer cards */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="relative bg-gradient-to-br from-slate-700/40 to-slate-800/60 
                       rounded-2xl border-2 border-dashed border-slate-500/40 
                       flex items-center justify-center h-48 backdrop-blur-sm
                       hover:border-slate-400/60 transition-all duration-300"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + (i * 0.1), duration: 0.5 }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </div>
            
            <motion.span 
              className="text-slate-400 text-3xl relative z-10"
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut"
              }}
            >
              ?
            </motion.span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const noCardsState = (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <motion.h3 
        className="font-bold text-white flex items-center gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <span className="text-2xl filter drop-shadow-lg">⏳</span>
        <span className="bg-gradient-to-r from-white to-amber-200 bg-clip-text text-transparent">
          Waiting for Cards
        </span>
      </motion.h3>
      
      <div className="text-center py-12">
        <motion.div 
          className="mb-6 text-6xl filter drop-shadow-lg"
          animate={{ 
            rotateY: [0, 360],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          🎲
        </motion.div>
        
        <motion.h4 
          className="font-bold text-white mb-3 text-xl bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Drawing cards...
        </motion.h4>
        
        <div className="flex justify-center gap-2 mt-4">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full w-3 h-3 shadow-lg shadow-emerald-500/50"
              animate={{ 
                y: [0, -12, 0],
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div
      className={`${
        isMobile || compact
          ? "relative"
          : "p-6 bg-gradient-to-br from-white/5 via-white/3 to-emerald-500/5 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl shadow-black/20"
      } flex-1 flex flex-col relative overflow-hidden`}
    >
      {/* Background enhancement for non-mobile */}
      {!isMobile && !compact && (
        <>
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-5">
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(rgba(16, 185, 129, 0.3) 1px, transparent 1px), 
                                 linear-gradient(90deg, rgba(16, 185, 129, 0.3) 1px, transparent 1px)`,
                backgroundSize: '20px 20px'
              }}
            />
          </div>
          
          {/* Corner accent elements */}
          <div className="absolute top-4 right-4 w-2 h-2 bg-emerald-400/60 rounded-full animate-pulse" />
          <div className="absolute bottom-4 left-4 w-1 h-1 bg-emerald-400/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        </>
      )}

      {/* Content with proper z-index */}
      <div className="relative z-10 flex-1 flex flex-col">
        {isMyTurn
          ? options.length > 0
            ? choiceGrid
            : noCardsState
          : waitingState}
      </div>
    </div>
  );
};

export default CardDisplay;