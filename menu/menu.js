import { setupAudioToggle } from "../helper/audioController.js";

document.addEventListener("DOMContentLoaded", () => {
  const playButton = document.getElementById("playButton");
  const tutorialButton = document.getElementById("tutorialButton");
  const closeTutorialButton = document.getElementById("closeTutorialButton");
  const backToMenuButton = document.getElementById("backToMenuButton"); // Select Back Button
  
  const mainMenuButtons = document.getElementById("mainMenuButtons");
  const gameModeContainer = document.getElementById("gameModeContainer");
  const tutorialOverlay = document.getElementById("tutorialOverlay");
  const tutorialContent = document.querySelector(".tutorial-content");
  
  const player1Button = document.getElementById("player1Button");
  const player2Button = document.getElementById("player2Button");
  const player3Button = document.getElementById("player3Button");
  const player4Button = document.getElementById("player4Button");

  const scenarioUrl = "../scenario/scenario.html";

  // --- PLAY BUTTON LOGIC ---
  playButton.addEventListener("click", () => {
    mainMenuButtons.classList.add("hidden"); 
    gameModeContainer.classList.remove("hidden"); 

    requestAnimationFrame(() => {
        const modeButtons = gameModeContainer.querySelectorAll(".mode-button");
        modeButtons.forEach((button, index) => {
            button.classList.add("fade-in-up");
            button.style.animationDelay = `${index * 0.1}s`;
        });
    });
  });

  // --- BACK BUTTON LOGIC ---
  if (backToMenuButton) {
      backToMenuButton.addEventListener("click", () => {
          // Hide mode container, Show main menu
          gameModeContainer.classList.add("hidden");
          mainMenuButtons.classList.remove("hidden");
          
          // Reset animations
          const modeButtons = gameModeContainer.querySelectorAll(".mode-button");
          modeButtons.forEach((button) => {
              button.classList.remove("fade-in-up");
              button.style.animationDelay = '0s';
          });
      });
  }

  // --- TUTORIAL LOGIC ---
  if (tutorialButton) {
      tutorialButton.addEventListener("click", () => {
        tutorialOverlay.classList.remove("hidden");
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