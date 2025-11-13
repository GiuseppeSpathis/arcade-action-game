import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  updateDoc, // NEW: Import updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import your config from the file you created
import { firebaseConfig } from "./firebaseConfig.js";

let db;

/**
 * Initializes the Firebase app and signs in the user anonymously.
 */
export async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    const auth = getAuth(app);
    await signInAnonymously(auth);
    console.log("Firebase initialized and host signed in.");
  } catch (error) {
    console.error("Firebase host init failed:", error);
    // Display this error to the user on the canvas
    return { error: "Could not connect to Firebase. Check console." };
  }
  return { error: null };
}

/**
 * Generates a random 4-letter room code.
 */
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a new game session document in Firestore.
 * @param {number} playerCount - The number of players in the game.
 * @returns {Promise<string>} The 4-letter room code.
 */
export async function createGameSession(playerCount) {
  if (playerCount <= 1) {
    return null; // No remote session needed for 1 player
  }
  if (!db) {
    throw new Error("Firebase not initialized. Call initFirebase() first.");
  }

  const roomCode = generateRoomCode();
  const sessionPath = `game_sessions/${roomCode}`;
  const sessionDoc = doc(db, sessionPath);

  // NEW: Initialize with gameState and a nested players object
  const initialState = {
    gameState: "lobby", // Game states: "lobby", "running", "gameover"
    players: {},
  };
  const playerTemplate = {
    inputs: { l: false, r: false, j: false, s: false },
    connected: false,
  };

  if (playerCount >= 2) {
    initialState.players.p2 = structuredClone(playerTemplate);
  }
  if (playerCount >= 3) {
    initialState.players.p3 = structuredClone(playerTemplate);
  }
  if (playerCount >= 4) {
    initialState.players.p4 = structuredClone(playerTemplate);
  }
  // END NEW

  try {
    await setDoc(sessionDoc, initialState);
    console.log(`Game session created with code: ${roomCode}`);
    return roomCode;
  } catch (error) {
    console.error("Failed to create game session:", error);
    throw new Error("Failed to create Firestore session.");
  }
}

/**
 * NEW: Updates the state of the game.
 * @param {string} roomCode
 * @param {"lobby" | "running" | "gameover"} newState
 */
export async function setGameState(roomCode, newState) {
  if (!db || !roomCode) return;
  const sessionPath = `game_sessions/${roomCode}`;
  const sessionDoc = doc(db, sessionPath);
  try {
    await updateDoc(sessionDoc, { gameState: newState });
  } catch (error) {
    console.error(`Failed to set game state to ${newState}:`, error);
  }
}

/**
 * Listens for real-time changes to the session document.
 * @param {string} roomCode - The room code for the session.
 * @param {function} callback - Function to call with the new session data.
 * @returns {function} An unsubscribe function to stop listening.
 */
export function listenForRemoteInputs(roomCode, callback) {
  if (!db) {
    return null;
  }
  const sessionPath = `game_sessions/${roomCode}`;
  const sessionDoc = doc(db, sessionPath);

  // onSnapshot returns an unsubscribe function
  const unsubscribe = onSnapshot(sessionDoc, (doc) => {
    if (doc.exists()) {
      callback(doc.data()); // Send the *entire* document back
    } else {
      console.log("Session document deleted or does not exist.");
    }
  });

  return unsubscribe;
}