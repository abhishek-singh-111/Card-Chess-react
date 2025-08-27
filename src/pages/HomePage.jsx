import React, { useState, useEffect } from "react";
import emailjs from "emailjs-com";
import FriendGameModal from "../components/FriendGameModal";

function GameModeButton({
  to,
  onClick,
  children,
  icon,
  description,
  variant = "primary",
}) {
  const variants = {
    primary:
      "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border-emerald-500/50",
    secondary:
      "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-blue-500/50",
    accent:
      "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border-purple-500/50",
  };

  const Wrapper = to ? "a" : "button";

  return (
    <Wrapper
      href={to}
      onClick={onClick}
      className="group block w-full text-left"
    >
      <a href={to} className="group block">
        <div
          className={`
        relative p-6 rounded-2xl border-2 backdrop-blur-sm
        transition-all duration-300 ease-out
        transform group-hover:-translate-y-2 group-hover:shadow-2xl
        ${variants[variant]}
      `}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl filter drop-shadow-lg">{icon}</div>
            <div className="flex-1">
              <h3 className="font-bold text-xl text-white mb-1">{children}</h3>
              <p className="text-white/80 text-sm">{description}</p>
            </div>
            <div className="text-white/60 group-hover:text-white transition-colors">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>

          {/* Subtle shine effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </a>
    </Wrapper>
  );
}

function FeatureCard({ title, description, icon, delay = 0 }) {
  return (
    <div
      className="group relative animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="relative p-8 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 
                      hover:bg-white/10 hover:border-white/20 transition-all duration-500
                      hover:shadow-xl hover:-translate-y-2"
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 
                          flex items-center justify-center text-white text-3xl mb-4
                          shadow-lg shadow-emerald-500/25"
          >
            {icon}
          </div>
          <h3 className="font-bold text-xl text-white mb-3">{title}</h3>
          <p className="text-slate-300 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

function CardChessAnimation() {
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCard((prev) => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    { piece: "♔", name: "KING", color: "from-yellow-400 to-yellow-600" },
    { piece: "♛", name: "QUEEN", color: "from-purple-400 to-purple-600" },
    { piece: "♞", name: "KNIGHT", color: "from-emerald-400 to-emerald-600" },
  ];

  const floatingPieces = [
    { piece: "♜", delay: 0, x: 20, y: 30 },
    { piece: "♝", delay: 1000, x: 80, y: 20 },
    { piece: "♟", delay: 2000, x: 60, y: 70 },
    { piece: "♕", delay: 1500, x: 30, y: 60 },
  ];

  return (
    <div className="relative w-80 h-80 sm:w-96 sm:h-96 lg:w-[450px] lg:h-[450px] xl:w-[500px] xl:h-[500px] mx-auto">
      {/* Central card display */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Card stack background */}
          <div className="absolute inset-0 transform rotate-6 translate-x-2 translate-y-2">
            <div className="w-40 h-56 sm:w-44 sm:h-60 lg:w-52 lg:h-72 xl:w-56 xl:h-80 bg-slate-800/80 rounded-2xl border border-slate-600/50 shadow-xl"></div>
          </div>
          <div className="absolute inset-0 transform rotate-3 translate-x-1 translate-y-1">
            <div className="w-40 h-56 sm:w-44 sm:h-60 lg:w-52 lg:h-72 xl:w-56 xl:h-80 bg-slate-700/80 rounded-2xl border border-slate-500/50 shadow-xl"></div>
          </div>

          {/* Active card */}
          <div className="relative w-40 h-56 sm:w-44 sm:h-60 lg:w-52 lg:h-72 xl:w-56 xl:h-80 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border-2 border-emerald-400/50 shadow-2xl shadow-emerald-500/25 overflow-hidden">
            {/* Card glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-transparent"></div>

            {/* Card content */}
            <div className="relative p-6 lg:p-8 xl:p-10 h-full flex flex-col justify-between z-10">
              <div className="text-emerald-400 text-xs lg:text-sm font-bold tracking-wider">
                CARD CHESS
              </div>

              <div className="text-center">
                <div
                  className={`text-6xl lg:text-7xl xl:text-8xl mb-4 transition-all duration-500 ${
                    activeCard === 0
                      ? "scale-110 text-yellow-400"
                      : activeCard === 1
                      ? "scale-110 text-purple-400"
                      : "scale-110 text-emerald-400"
                  }`}
                >
                  {cards[activeCard].piece}
                </div>
                <div className="text-white font-bold text-lg lg:text-xl xl:text-2xl tracking-wider">
                  {cards[activeCard].name}
                </div>
              </div>

              <div className="text-slate-400 text-xs lg:text-sm text-center">
                MOVE AVAILABLE
              </div>
            </div>

            {/* Card shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Floating chess pieces */}
      {floatingPieces.map((item, index) => (
        <div
          key={index}
          className="absolute text-4xl lg:text-5xl xl:text-6xl text-slate-400/60 animate-float pointer-events-none"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            animationDelay: `${item.delay}ms`,
            animationDuration: "4s",
          }}
        >
          {item.piece}
        </div>
      ))}

      {/* Glowing orbs */}
      <div className="absolute top-10 right-10 w-6 h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 bg-emerald-400/30 rounded-full blur-sm animate-pulse"></div>
      <div
        className="absolute bottom-20 left-10 w-4 h-4 lg:w-6 lg:h-6 xl:w-8 xl:h-8 bg-purple-400/30 rounded-full blur-sm animate-pulse"
        style={{ animationDelay: "1s" }}
      ></div>
      <div
        className="absolute top-1/2 right-5 w-3 h-3 lg:w-5 lg:h-5 xl:w-6 xl:h-6 bg-yellow-400/30 rounded-full blur-sm animate-pulse"
        style={{ animationDelay: "2s" }}
      ></div>

      {/* Connection lines */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full">
          <defs>
            <linearGradient
              id="lineGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M50 50 Q200 100 350 50"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            fill="none"
            className="animate-pulse"
          />
          <path
            d="M100 200 Q200 250 300 200"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            fill="none"
            className="animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </svg>
      </div>
    </div>
  );
}

function FeedbackForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "general",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await emailjs.send(
        "service_j51erqb", // e.g. service_xxxxx
        "template_ipjr23m", // e.g. template_xxxxx
        formData,
        "MoomX7LCvS3jyLhXO" // e.g. Vx5xx0x3xxxxx
      );
      console.log("Feedback submitted:", formData);

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsSubmitted(true);

      // Reset form after 3 seconds
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({ name: "", email: "", category: "general", message: "" });
      }, 3000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center p-12 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-3xl border border-emerald-400/20">
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Thank You!</h3>
        <p className="text-slate-300">
          Your feedback has been received. We'll use it to make Card Chess even
          better!
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 space-y-6"
    >
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className="block text-white font-semibold mb-2">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
            placeholder="Your name"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-white font-semibold mb-2"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
            placeholder="your@email.com"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="category"
          className="block text-white font-semibold mb-2"
        >
          Feedback Category
        </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
        >
          <option value="general" className="bg-slate-800">
            General Feedback
          </option>
          <option value="gameplay" className="bg-slate-800">
            Gameplay Experience
          </option>
          <option value="ui" className="bg-slate-800">
            User Interface
          </option>
          <option value="bugs" className="bg-slate-800">
            Bug Reports
          </option>
          <option value="features" className="bg-slate-800">
            Feature Requests
          </option>
        </select>
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-white font-semibold mb-2"
        >
          Your Feedback
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows={5}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 resize-none"
          placeholder="Tell us how we can improve Card Chess..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Sending Feedback...
          </span>
        ) : (
          "Send Feedback"
        )}
      </button>

      <p className="text-slate-400 text-sm text-center">
        Your feedback will be sent directly to our development team and help
        shape the future of Card Chess.
      </p>
    </form>
  );
}
function FloatingCard({ delay, x, y, piece }) {
  return (
    <div
      className="absolute animate-float opacity-40"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        animationDelay: `${delay}ms`,
        animationDuration: "4s",
      }}
    >
      <div className="w-20 h-28 bg-gradient-to-br from-slate-700/80 to-slate-900/80 rounded-xl border border-emerald-400/30 shadow-2xl shadow-emerald-500/20 backdrop-blur-sm">
        <div className="p-3 h-full flex flex-col justify-between">
          <div className="text-emerald-400 text-xs font-bold tracking-wider">
            CHESS
          </div>
          <div className="text-emerald-300 text-3xl text-center">{piece}</div>
          <div className="text-slate-400 text-xs text-center font-semibold">
            CARD
          </div>
        </div>
        {/* Card glow */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/10 via-transparent to-emerald-400/10 animate-pulse"></div>
      </div>
    </div>
  );
}

function ModeSelectModal({ onClose, onSelect }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4 text-center">
          Choose Game Mode
        </h2>
        <div className="space-y-3">
          <button
            onClick={() => onSelect("standard")}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            Standard Game
          </button>
          <button
            onClick={() => onSelect("timed")}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          >
            Timed Game (10 min)
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-slate-400 hover:text-white text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function HomePage({ socket }) {
  const [isVisible, setIsVisible] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectedPath, setSelectedPath] = useState(null);
  const [showFriendModal, setShowFriendModal] = useState(false);

  const handleGameModeClick = (path) => {
    if (path === "/friend") {
      setShowFriendModal(true); // Directly show FriendGameModal
    } else {
      setSelectedPath(path);
      setShowModeModal(true);
    }
  };

  const handleSelectMode = (mode) => {
    setShowModeModal(false);
    if (selectedPath === "/friend") {
      setShowFriendModal(true);
    } else if (selectedPath) {
      window.location.href = `${selectedPath}?mode=${mode}`;
    }
  };

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Enhanced animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10">
          <FloatingCard delay={0} x={0} y={0} piece="♔" />
        </div>
        <div className="absolute top-40 right-20">
          <FloatingCard delay={1000} x={0} y={0} piece="♛" />
        </div>
        <div className="absolute bottom-40 left-1/4">
          <FloatingCard delay={2000} x={0} y={0} piece="♞" />
        </div>
        <div className="absolute top-1/3 right-1/4">
          <FloatingCard delay={1500} x={0} y={0} piece="♜" />
        </div>
        <div className="absolute bottom-1/3 right-10">
          <FloatingCard delay={500} x={0} y={0} piece="♝" />
        </div>
      </div>

      {/* Enhanced grid pattern */}
      <div className="absolute inset-0 opacity-15">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16, 185, 129, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">♔</span>
                </div>
                <div>
                  <span className="font-bold text-2xl text-white">
                    Card Chess
                  </span>
                  <span className="text-emerald-400 text-sm ml-2">v1.0</span>
                </div>
              </div>

              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-6">
                <a
                  href="#how-it-works"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  How It Works
                </a>
                <a
                  href="#feedback"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Feedback
                </a>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Hero Section */}
        <section className="px-6 py-8 lg:py-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left side - Text content and game modes */}
              <div
                className={`transition-all duration-1000 ${
                  isVisible
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-10"
                }`}
              >
                <div className="text-center lg:text-left mb-12">
                  <h1 className="font-bold text-5xl md:text-6xl lg:text-7xl text-white mb-6 leading-tight">
                    Chess Reimagined
                    <span className="block lg:inline text-emerald-400 lg:ml-2">
                      with Strategy Cards
                    </span>
                  </h1>

                  <p className="text-xl text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
                    Experience the timeless game of chess with an innovative
                    twist. Master strategic card-based moves in this
                    revolutionary chess variant.
                  </p>
                </div>

                {/* Game Mode Buttons */}
                <div className="space-y-4 max-w-lg mx-auto lg:mx-0">
                  <GameModeButton
                    //to="#"
                    icon="🌐"
                    variant="primary"
                    description="Challenge players worldwide"
                    onClick={() => handleGameModeClick("/online")}
                  >
                    Play Online
                  </GameModeButton>

                  <GameModeButton
                    //to="#"
                    icon="👥"
                    variant="secondary"
                    description="Invite friends to play together"
                    onClick={() => handleGameModeClick("/friend")}
                  >
                    Play With A Friend
                  </GameModeButton>

                  <GameModeButton
                    to="/ai"
                    icon="🤖"
                    variant="accent"
                    description="Practice against smart AI"
                  >
                    Play With A Bot
                  </GameModeButton>
                </div>
              </div>

              {/* Right side - Card Chess animation */}
              <div
                className={`flex justify-center lg:justify-end transition-all duration-1000 delay-300 ${
                  isVisible
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-10"
                }`}
              >
                <CardChessAnimation />
              </div>
            </div>
          </div>
        </section>

        {/* How Card Chess Works */}
        <section
          id="how-it-works"
          className="px-6 py-20 bg-black/20 border-y border-white/10"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                How Card Chess Works
              </h2>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Combine traditional chess strategy with the excitement of
                card-based gameplay
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon="🃏"
                title="Draw Your Hand"
                description="Each turn, draw three cards representing different chess pieces you can move"
                delay={100}
              />
              <FeatureCard
                icon="🎯"
                title="Strategic Choice"
                description="Choose wisely from your cards based on board position and long-term strategy"
                delay={200}
              />
              <FeatureCard
                icon="⚡"
                title="Execute Move"
                description="Move the selected piece following traditional chess rules and mechanics"
                delay={300}
              />
              <FeatureCard
                icon="🏆"
                title="Claim Victory"
                description="Achieve checkmate through clever card management and tactical superiority"
                delay={400}
              />
            </div>
          </div>
        </section>

        {/* Feedback Section */}
        <section id="feedback" className="px-6 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Help Us Improve
              </h2>
              <p className="text-xl text-slate-300 leading-relaxed">
                Your feedback is invaluable to us. Share your thoughts on how we
                can make Card Chess even better!
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <FeedbackForm />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-black/20">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">♔</span>
                </div>
                <span className="text-slate-400">
                  © {new Date().getFullYear()} Card Chess Platform
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {showFriendModal && (
        <FriendGameModal
          socket={socket}
          onClose={() => setShowFriendModal(false)}
        />
      )}
      {showModeModal && (
        <ModeSelectModal
          onClose={() => setShowModeModal(false)}
          onSelect={handleSelectMode}
        />
      )}

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-15px) rotate(3deg);
          }
          50% {
            transform: translateY(-10px) rotate(-2deg);
          }
          75% {
            transform: translateY(-20px) rotate(1deg);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
