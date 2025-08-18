// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import OnlineGame from "./OnlineGame";
import FriendGame from "./FriendGame";
import LocalGame from "./LocalGame";
import AIGame from "./AIGame";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/online" element={<OnlineGame />} />
        <Route path="/friend" element={<FriendGame />} />
        <Route path="/local" element={<LocalGame />} />
        <Route path="/ai" element={<AIGame />} />
      </Routes>
    </BrowserRouter>
  );
}
