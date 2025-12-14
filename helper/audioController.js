const MUTED_ICON = "🔇";
const UNMUTED_ICON = "🔊";
const DEFAULT_VOLUME_KEY = "retro-arcade-volume";
// Dynamically creates a range slider input to control the volume of audio elements
function createVolumeSlider(
  audioElements,
  container,
  storageKey = DEFAULT_VOLUME_KEY,
  labelIcon = null 
) {
  if (!audioElements || !audioElements.length || !container) {
    return null;
  }

  const targets = Array.isArray(audioElements) ? audioElements : [audioElements];
  // Initialize base volume for all targets to allow relative scaling
  targets.forEach((el) => {
    if (el.dataset.baseVolume === undefined) {
      el.dataset.baseVolume = el.volume;
    }
  });
  // Create the slider DOM element
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.01";
  slider.value = localStorage.getItem(storageKey) ?? "1";
  slider.setAttribute("aria-label", "Adjust volume");
  slider.title = "Adjust volume";
  // Applies the slider value (0.0 - 1.0) to all audio targets
  const updateVolumes = (masterVolume) => {
    targets.forEach((el) => {
      const base = parseFloat(el.dataset.baseVolume);
      el.volume = base * masterVolume;
    });
  };
  // Initialize volume immediately
  updateVolumes(parseFloat(slider.value));
  // Handle user input updates
  slider.addEventListener("input", () => {
    const val = parseFloat(slider.value);
    updateVolumes(val);
    localStorage.setItem(storageKey, slider.value); // Persist setting
  });
  // Enable keyboard control for the slider (Arrows)
  slider.addEventListener("keydown", (e) => {
    let val = parseFloat(slider.value);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      val = Math.max(0, val - 0.05);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      val = Math.min(1, val + 0.05);
    } else {
      return;
    }
    slider.value = val.toFixed(2);
    slider.dispatchEvent(new Event("input"));
  });
  // Render the slider into the container
  container.innerHTML = ""; 

  if (labelIcon) {
    const iconSpan = document.createElement("span");
    iconSpan.textContent = labelIcon;
    container.appendChild(iconSpan);
  }

  container.appendChild(slider);

  return slider;
}
// Updates the visual state of the mute button (Icon, Aria labels)
function updateButtonState(toggleButton, isMuted) {
  if (!toggleButton) {
    return;
  }

  toggleButton.dataset.muted = isMuted ? "true" : "false";
  toggleButton.setAttribute("aria-pressed", isMuted ? "true" : "false");
  toggleButton.setAttribute(
    "aria-label",
    isMuted ? "Unmute audio" : "Mute audio",
  );
  toggleButton.title = isMuted ? "Unmute" : "Mute";
  toggleButton.textContent = isMuted ? MUTED_ICON : UNMUTED_ICON;
}
// Main initialization function to hook up a mute button and volume slider
export function setupAudioToggle({
  audioElements,
  audioElement,
  toggleButton,
  sliderContainer,
  storageKeyMuted = "retro-arcade-muted",
  storageKeyVolume = "retro-arcade-volume",
  labelIcon = null, 
} = {}) {
  const targets = audioElements || (audioElement ? [audioElement] : []);
  if (!targets.length || !toggleButton) {
    return;
  }
  // Load saved mute state
  const storedMuted = localStorage.getItem(storageKeyMuted) === "true";

  function applyMute(muted) {
    targets.forEach((el) => (el.muted = muted));
    updateButtonState(toggleButton, muted);
    localStorage.setItem(storageKeyMuted, muted ? "true" : "false");
  }

  applyMute(storedMuted);
  // Click handler
  toggleButton.addEventListener("click", () => {
    const currentMuted = targets[0].muted;
    applyMute(!currentMuted);
  });
  // Setup the slider if a container is found/provided
  const container =
    sliderContainer ||
    toggleButton.parentElement.querySelector("#musicVolumeSliderContainer");

  if (container) {
    createVolumeSlider(targets, container, storageKeyVolume, labelIcon);
  }
}