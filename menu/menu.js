import { setupAudioToggle } from "../helper/audioController.js";

document.addEventListener("DOMContentLoaded", () => {
  const playButton = document.getElementById("playButton");
  const tutorialButton = document.getElementById("tutorialButton");
  const closeTutorialButton = document.getElementById("closeTutorialButton");
  
  const mainMenuButtons = document.getElementById("mainMenuButtons");
  const gameModeContainer = document.getElementById("gameModeContainer");
  const tutorialOverlay = document.getElementById("tutorialOverlay");
  // Select the scrollable content container
  const tutorialContent = document.querySelector(".tutorial-content");
  
  const player1Button = document.getElementById("player1Button");
  const player2Button = document.getElementById("player2Button");
  const player3Button = document.getElementById("player3Button");
  const player4Button = document.getElementById("player4Button");

  const scenarioUrl = "../scenario/scenario.html";

  // --- PLAY BUTTON LOGIC ---
  playButton.addEventListener("click", () => {
    // Hide the main menu buttons container (Play + Tutorial)
    mainMenuButtons.classList.add("hidden"); 
    
    // Show mode buttons container
    gameModeContainer.classList.remove("hidden"); 

    // Animation logic
    requestAnimationFrame(() => {
        const modeButtons = gameModeContainer.querySelectorAll(".mode-button");
        modeButtons.forEach((button, index) => {
            button.classList.add("fade-in-up");
            button.style.animationDelay = `${index * 0.1}s`;
        });
    });
  });

  // --- TUTORIAL LOGIC ---
  if (tutorialButton) {
      tutorialButton.addEventListener("click", () => {
        tutorialOverlay.classList.remove("hidden");
        // RESET SCROLL POSITION TO TOP
        if (tutorialContent) {
            tutorialContent.scrollTop = 0;
        }
      });
  }

  if (closeTutorialButton) {
      closeTutorialButton.addEventListener("click", () => {
        tutorialOverlay.classList.add("hidden");
      });
  }

  // Allow closing tutorial by clicking outside the content box
  if (tutorialOverlay) {
      tutorialOverlay.addEventListener("click", (e) => {
        if (e.target === tutorialOverlay) {
            tutorialOverlay.classList.add("hidden");
        }
      });
  }

  // --- GAME MODE SELECTION LOGIC ---
  player1Button.addEventListener("click", () => {
    window.location.href = `${scenarioUrl}?players=1`;
  });
  
  player2Button.addEventListener("click", () => {
    window.location.href = `${scenarioUrl}?players=2`;
  });

  player3Button.addEventListener("click", () => {
    window.location.href = `${scenarioUrl}?players=3`;
  });

  player4Button.addEventListener("click", () => {
    window.location.href = `${scenarioUrl}?players=4`;
  });

  const audioElement = document.getElementById("bg_music");
  const toggleButton = document.getElementById("musicToggle");
  setupAudioToggle({ audioElement, toggleButton });
});