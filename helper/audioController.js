const MUTED_ICON = "🔇";
const UNMUTED_ICON = "🔊";
const VOLUME_STORAGE_KEY = "retro-arcade-volume";

function createVolumeSlider(
  audioElement,
  container,
  storageKey = VOLUME_STORAGE_KEY,
) {
  if (!audioElement || !container) {
    return null;
  }

  // Create slider element
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.01";
  slider.value = localStorage.getItem(storageKey) ?? "1";
  slider.style.width = "80px";
  slider.setAttribute("aria-label", "Adjust music volume");
  slider.title = "Adjust music volume";

  // Set initial volume
  audioElement.volume = parseFloat(slider.value);

  // Update volume on slider change
  slider.addEventListener("input", () => {
    audioElement.volume = parseFloat(slider.value);
    localStorage.setItem(storageKey, slider.value);
  });

  // Keyboard accessibility
  slider.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      slider.value = Math.max(0, parseFloat(slider.value) - 0.05).toFixed(2);
      slider.dispatchEvent(new Event("input"));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      slider.value = Math.min(1, parseFloat(slider.value) + 0.05).toFixed(2);
      slider.dispatchEvent(new Event("input"));
    }
  });

  // Insert into container
  container.appendChild(slider);

  return slider;
}

function updateButtonState(toggleButton, isMuted) {
  if (!toggleButton) {
    return;
  }

  toggleButton.dataset.muted = isMuted ? "true" : "false";
  toggleButton.setAttribute("aria-pressed", isMuted ? "true" : "false");
  toggleButton.setAttribute(
    "aria-label",
    isMuted ? "Attiva l'audio" : "Disattiva l'audio",
  );
  toggleButton.title = isMuted ? "Riattiva musica" : "Disattiva musica";
  toggleButton.textContent = isMuted ? MUTED_ICON : UNMUTED_ICON;
}

export function setupAudioToggle({
  audioElement,
  toggleButton,
  storageKey = "retro-arcade-muted",
} = {}) {
  if (!audioElement || !toggleButton) {
    return;
  }

  const storedValue = localStorage.getItem(storageKey);
  const initialMuted = storedValue === "true";

  function applyState(muted) {
    audioElement.muted = muted;
    updateButtonState(toggleButton, muted);
    localStorage.setItem(storageKey, muted ? "true" : "false");
  }

  applyState(initialMuted);

  toggleButton.addEventListener("click", () => {
    const nextState = !audioElement.muted;
    applyState(nextState);
  });

  // Add volume slider next to toggle button
  const sliderContainer = toggleButton.parentElement.querySelector(
    "#musicVolumeSliderContainer",
  );
  createVolumeSlider(audioElement, sliderContainer);
}
