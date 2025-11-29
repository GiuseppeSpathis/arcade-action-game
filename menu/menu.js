import { setupAudioToggle } from "../helper/audioController.js";

document.addEventListener("DOMContentLoaded", () => {
  const playButton = document.getElementById("playButton");
  const gameModeContainer = document.getElementById("gameModeContainer");
  
  const player1Button = document.getElementById("player1Button");
  const player2Button = document.getElementById("player2Button");
  const player3Button = document.getElementById("player3Button");
  const player4Button = document.getElementById("player4Button");

  const scenarioUrl = "../scenario/scenario.html";

  // When Play is clicked, hide it and show the mode buttons
  playButton.addEventListener("click", () => {
    playButton.classList.add("hidden"); // Hide play button
    gameModeContainer.classList.remove("hidden"); // Show mode buttons container

    // Use requestAnimationFrame to ensure the browser renders the container 
    // as visible BEFORE adding the animation class.
    requestAnimationFrame(() => {
        const modeButtons = gameModeContainer.querySelectorAll(".mode-button");
        
        modeButtons.forEach((button, index) => {
            button.classList.add("fade-in-up");
            // Delay increases by 0.1s for each button
            button.style.animationDelay = `${index * 0.1}s`;
        });
    });
  });

  // Event listeners to each button, passing the player count as a URL parameter
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