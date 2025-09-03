// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import analytics from "./analytics";
import HomePage from "./pages/HomePage";
import io from "socket.io-client";
import OnlineGame from "./pages/OnlineGame";
import AIGame from "./pages/AIGame";
import FriendGamePage from "./pages/FriendGamePage";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FriendGameModal from "./components/FriendGameModal";

//const SERVER_URL = "http://localhost:4000";
//const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://card-chess.onrender.com";
const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://cardchess-backend.fly.dev";

export default function App() {
  // init analytics once
   useEffect(() => {
     analytics.init();
   }, []);
 
   // track SPA page views
   function PageTracker() {
     const location = useLocation();
     useEffect(() => {
       analytics.trackPageView(location.pathname);
     }, [location.pathname]);
     return null;
   }
   //const [socket] = useState(() => io(SERVER_URL));
   const [socket] = useState(() => io(SERVER_URL, {
    transports: ["websocket", "polling"]
  }));

  return (
    <>
    <BrowserRouter>
    <PageTracker />
      <Routes>
        <Route path="/" element={<HomePage socket={socket} />} />
        <Route path="/online" element={<OnlineGame />} />
        <Route path="/ai" element={<AIGame />} />
        <Route path="/" element={<FriendGameModal socket={socket} />} />
        <Route path="/friend" element={<FriendGamePage socket={socket} />} />
      </Routes>
    </BrowserRouter>
    <ToastContainer position="bottom-right" autoClose={3000} />
    </>
  );
}
