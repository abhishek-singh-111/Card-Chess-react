// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import OnlineGame from "./pages/OnlineGame";
import FriendGame from "./pages/FriendGame";
import AIGame from "./pages/AIGame";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function App() {
  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/online" element={<OnlineGame />} />
        <Route path="/friend" element={<FriendGame />} />
        <Route path="/ai" element={<AIGame />} />
      </Routes>
    </BrowserRouter>
    <ToastContainer position="bottom-right" autoClose={3000} />
    </>
  );
}
