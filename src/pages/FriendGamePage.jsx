// src/pages/FriendGamePage.jsx
import React from "react";
import { useSearchParams } from "react-router-dom";
import OnlineGame from "./OnlineGame";

export default function FriendGamePage({ onExit, socket }) {
  const [searchParams] = useSearchParams();

  const roomId = searchParams.get("roomId");
  const color = searchParams.get("color");
  const fen = searchParams.get("fen");
  const mode = searchParams.get("mode");

  return (
    <OnlineGame
      socket={socket}
      roomId={roomId}
      color={color}
      fen={fen}
      mode={mode}
      isFriendMode={true}
      onExit={onExit}
    />
  );
}
