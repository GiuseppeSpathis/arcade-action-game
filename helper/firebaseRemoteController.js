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


function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}


export async function createGameSession(playerCount) {
  if (playerCount <= 1) {
    return null; 
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
        ml: false, mr: false, mu: false, md: false, 
        sl: false, sr: false, su: false, sd: false, 
        j: false 
    },
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

  try {
    await setDoc(sessionDoc, initialState);
    console.log(`Game session created with code: ${roomCode}`);
    return roomCode;
  } catch (error) {
    console.error("Failed to create game session:", error);
    throw new Error("Failed to create Firestore session.");
  }
}


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