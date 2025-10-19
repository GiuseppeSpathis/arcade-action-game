import { setupAudioToggle } from "../helper/audioController.js";

document.addEventListener("DOMContentLoaded", () => {
  const playButton = document.getElementById("playButton");

  playButton.addEventListener("click", () => {
    window.location.href = "../scenario/scenario.html";
  });

  const audioElement = document.getElementById("bg_music");
  const toggleButton = document.getElementById("musicToggle");
  setupAudioToggle({ audioElement, toggleButton });
});
