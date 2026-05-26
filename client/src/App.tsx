import React, { useEffect, useState, useCallback } from "react";
import "./App.css";
import useSocket from "./hooks/useSocket";
import LoginPage from "./pages/LoginPage";
import LobbyPage from "./pages/LobbyPage";
import GamePage from "./pages/GamePage";
import WinnerPage from "./pages/WinnerPage";
import Notification from "./components/Notification";
import RotatePrompt from "./components/RotatePrompt";
import SettingsModal from "./components/SettingsModal";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

const DEFAULT_STATE = {
  username: "",
  roomId: "",
  playerId: "",
  players: [],
  hostId: "",
  isHost: false,
  gameActive: false,
  currentPage: "login",
  currentRole: null,
  selectedThief: null,
  currentScore: 0,
  round: 1,
  maxRounds: 10,
  messages: [],      // BUG FIX #8: capped at 50
  winnerName: "",
  winnerScore: 0,
  winnerData: null,
  policeRevealed: false,
  policeId: null,
  policeName: "",
  roundResults: null,
  showResults: false,
};

function useViewportHeight() {
  useEffect(() => {
    const set = () => {
      document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
    };
    set();
    window.addEventListener("resize", set);
    window.addEventListener("orientationchange", () => setTimeout(set, 300));
    return () => {
      window.removeEventListener("resize", set);
      window.removeEventListener("orientationchange", set);
    };
  }, []);
}

// URL room routing (Skribbl.io style)
function getRoomFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("room") || "";
}

function setRoomInURL(roomId) {
  if (roomId) {
    const url = new URL(window.location);
    url.searchParams.set("room", roomId);
    window.history.replaceState({}, "", url);
  } else {
    const url = new URL(window.location);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url);
  }
}

export default function App() {
  useViewportHeight();

  const [gameState, setGameState] = useState(() => ({
    ...DEFAULT_STATE,
    roomId: getRoomFromURL(), // Pre-fill from URL
  }));

  const [notifications, setNotifications] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const socket = useSocket(SOCKET_URL);

  const addNotification = useCallback((type, message) => {
    setNotifications((prev) => [
      ...prev.slice(-3),
      { id: Date.now() + Math.random(), type, message },
    ]);
  }, []);

  // BUG FIX #8: capped message push helper
  const pushMessage = useCallback((msg) => {
    setGameState((prev) => ({
      ...prev,
      messages: [...prev.messages, msg].slice(-50),
    }));
  }, []);

  useEffect(() => {
    if (!socket) return;

    // BUG FIX #1: Surgical cleanup — named handlers, not blanket socket.off()
    const handlers = {
      chat_message: (msg) => pushMessage(msg),

      player_joined: (data) => {
        setGameState((prev) => ({ ...prev, players: data.players, hostId: data.hostId }));
        addNotification("info", data.message);
      },

      player_left: (data) => {
        setGameState((prev) => ({ ...prev, players: data.players, hostId: data.hostId }));
        addNotification("warning", data.message);
      },

      you_are_host: (data) => {
        setGameState((prev) => ({ ...prev, isHost: true, hostId: data.hostId }));
        addNotification("success", "You are now the host!");
      },

      game_started: (data) => {
        setGameState((prev) => ({
          ...prev,
          gameActive: true,
          round: data.round,
          maxRounds: data.maxRounds,
          policeRevealed: false,
          showResults: false,
          roundResults: null,
          currentPage: "game",
        }));
      },

      role_assigned: (data) => {
        setGameState((prev) => ({ ...prev, currentRole: data.role }));
      },

      police_revealed: (data) => {
        setGameState((prev) => ({
          ...prev,
          policeRevealed: true,
          policeId: data.policeId,
          policeName: data.policeName,
        }));
      },

      police_submitted: (data) => {
        addNotification("info", data.message);
      },

      round_ended: (data) => {
        setGameState((prev) => ({
          ...prev,
          showResults: true,
          roundResults: data,
          currentScore: data.roundResults.find((p) => p.id === prev.playerId)?.score || 0,
          players: data.roundResults.map((p) => ({ id: p.id, name: p.name, score: p.score })),
          selectedThief: null,
          policeRevealed: false,
        }));
      },

      next_round_starting: (data) => {
        setGameState((prev) => ({
          ...prev,
          round: data.round,
          showResults: false,
          roundResults: null,
          selectedThief: null,
          policeRevealed: false,
          currentRole: null,
        }));
      },

      round_terminated: (data) => {
        addNotification("error", data.message);
        setGameState((prev) => ({
          ...prev,
          showResults: false,
          roundResults: null,
          roundActive: false,
        }));
      },

      game_ended: (data) => {
        addNotification("error", data.message);
        setGameState((prev) => ({
          ...prev,
          gameActive: false,
          currentPage: "lobby",
          showResults: false,
          roundResults: null,
        }));
      },

      game_over: (data) => {
        setGameState((prev) => ({
          ...prev,
          gameActive: false,
          winnerName: data.winnerName,
          winnerScore: data.winnerScore,
          winnerData: data,
          currentPage: "winner",
        }));
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // BUG FIX #1: surgical cleanup — only remove our specific handlers
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, addNotification, pushMessage]);

  // Sync URL when roomId changes
  useEffect(() => {
    if (gameState.roomId && gameState.playerId) {
      setRoomInURL(gameState.roomId);
    }
  }, [gameState.roomId, gameState.playerId]);

  const resetToLogin = useCallback(() => {
    setRoomInURL("");
    setGameState({ ...DEFAULT_STATE, roomId: "" });
  }, []);

  const renderPage = () => {
    if (!socket) {
      return (
        <div className="connecting-screen">
          <div className="connecting-text">CONNECTING TO SERVER...</div>
        </div>
      );
    }

    switch (gameState.currentPage) {
      case "login":
        return <LoginPage socket={socket} gameState={gameState} setGameState={setGameState} />;
      case "lobby":
        return <LobbyPage socket={socket} gameState={gameState} setGameState={setGameState} resetToLogin={resetToLogin} />;
      case "game":
        return <GamePage socket={socket} gameState={gameState} setGameState={setGameState} resetToLogin={resetToLogin} />;
      case "winner":
        return <WinnerPage gameState={gameState} setGameState={setGameState} socket={socket} resetToLogin={resetToLogin} />;
      default:
        return <LoginPage socket={socket} gameState={gameState} setGameState={setGameState} />;
    }
  };

  return (
    <div className="app">
      <RotatePrompt />
      <button className="settings-gear" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {renderPage()}
      <div className="notification-container">
        {notifications.map((n) => (
          <Notification key={n.id} type={n.type} message={n.message} />
        ))}
      </div>
    </div>
  );
}
