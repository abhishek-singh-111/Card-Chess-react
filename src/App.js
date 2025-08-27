// src/App.js
import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import io from "socket.io-client";
import OnlineGame from "./pages/OnlineGame";
import AIGame from "./pages/AIGame";
import FriendGamePage from "./pages/FriendGamePage";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FriendGameModal from "./components/FriendGameModal";

//const SERVER_URL = "http://localhost:4000";
const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://card-chess.onrender.com";

export default function App() {
   const [socket] = useState(() => io(SERVER_URL));

  return (
    <>
    <BrowserRouter>
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
