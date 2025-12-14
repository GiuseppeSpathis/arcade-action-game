import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  deleteDoc, 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


import { firebaseConfig } from "./firebaseConfig.js";

let db;

// Connects to Firebase services and performs an anonymous sign-in
// to allow database reading/writing without a user account.
export async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    const auth = getAuth(app);
    await signInAnonymously(auth);
    console.log("Firebase initialized and host signed in.");
  } catch (error) {
    console.error("Firebase host init failed:", error);
    return { error: "Could not connect to Firebase. Check console." };
  }
  return { error: null };
}

// Helper to create a random 4-letter room ID (e.g., "ABCD")
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Creates a new document in Firestore to host the game session state.
// Initializes empty input slots for players 2, 3, and 4.
export async function createGameSession(playerCount) {
  if (playerCount <= 1) {
    return null;  // Local single player doesn't need a DB session
  }
  if (!db) {
    throw new Error("Firebase not initialized. Call initFirebase() first.");
  }

  const roomCode = generateRoomCode();
  const sessionPath = `game_sessions/${roomCode}`;
  const sessionDoc = doc(db, sessionPath);

  const initialState = {
    gameState: "lobby", 
    players: {},
  };
  
  const playerTemplate = {
    inputs: { 
        ml: false, mr: false, mu: false, md: false,  // Movement keys
        sl: false, sr: false, su: false, sd: false,  // Shoot keys
        j: false  // Jump key
    },
    connected: false,
  };
  // Dynamically create slots only for the requested number of players
  if (playerCount >= 2) {
    initialState.players.p2 = structuredClone(playerTemplate);
  }
  if (playerCount >= 3) {
    initialState.players.p3 = structuredClone(playerTemplate);
  }
  if (playerCount >= 4) {
    initialState.players.p4 = structuredClone(playerTemplate);
  }

  try {
    await setDoc(sessionDoc, initialState);
    console.log(`Game session created with code: ${roomCode}`);
    return roomCode;
  } catch (error) {
    console.error("Failed to create game session:", error);
    throw new Error("Failed to create Firestore session.");
  }
}

// Updates the session status (e.g., to 'running' or 'gameover') so connected phones react accordingly.
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

// Deletes the session document from the database (cleanup).
export async function deleteGameSession(roomCode) {
    if (!db || !roomCode) return;
    const sessionPath = `game_sessions/${roomCode}`;
    const sessionDoc = doc(db, sessionPath);
    try {
      await deleteDoc(sessionDoc);
      console.log(`Game session ${roomCode} deleted.`);
    } catch (error) {
      console.error("Failed to delete game session:", error);
    }
}

// Sets up a real-time listener to receive input updates from remote players (phones).
export function listenForRemoteInputs(roomCode, callback) {
  if (!db) {
    return null;
  }
  const sessionPath = `game_sessions/${roomCode}`;
  const sessionDoc = doc(db, sessionPath);

  const unsubscribe = onSnapshot(sessionDoc, (doc) => {
    if (doc.exists()) {
      callback(doc.data()); 
    } else {
      console.log("Session document deleted or does not exist.");
    }
  });

  return unsubscribe;
}