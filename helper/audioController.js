const MUTED_ICON = "🔇";
const UNMUTED_ICON = "🔊";
const DEFAULT_VOLUME_KEY = "retro-arcade-volume";

function createVolumeSlider(
  audioElements,
  container,
  storageKey = DEFAULT_VOLUME_KEY,
  labelIcon = null // New parameter for the icon
) {
  if (!audioElements || !audioElements.length || !container) {
    return null;
  }

  // Normalize audioElements to array
  const targets = Array.isArray(audioElements) ? audioElements : [audioElements];

  // Capture initial "base" volumes
  targets.forEach((el) => {
    if (el.dataset.baseVolume === undefined) {
      el.dataset.baseVolume = el.volume;
    }
  });

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.01";
  slider.value = localStorage.getItem(storageKey) ?? "1";
  //slider.style.width = "80px";
  slider.setAttribute("aria-label", "Adjust volume");
  slider.title = "Adjust volume";

  const updateVolumes = (masterVolume) => {
    targets.forEach((el) => {
      const base = parseFloat(el.dataset.baseVolume);
      el.volume = base * masterVolume;
    });
  };

  // Set initial state
  updateVolumes(parseFloat(slider.value));

  // Update volume on slider change
  slider.addEventListener("input", () => {
    const val = parseFloat(slider.value);
    updateVolumes(val);
    localStorage.setItem(storageKey, slider.value);
  });

  // Keyboard accessibility
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

  // Insert into container
  container.innerHTML = ""; // Clear existing

  // Add Label Icon if provided
  if (labelIcon) {
    const iconSpan = document.createElement("span");
    iconSpan.textContent = labelIcon;
    container.appendChild(iconSpan);
  }

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
    isMuted ? "Unmute audio" : "Mute audio",
  );
  toggleButton.title = isMuted ? "Unmute" : "Mute";
  toggleButton.textContent = isMuted ? MUTED_ICON : UNMUTED_ICON;
}

export function setupAudioToggle({
  audioElements,
  audioElement,
  toggleButton,
  sliderContainer,
  storageKeyMuted = "retro-arcade-muted",
  storageKeyVolume = "retro-arcade-volume",
  labelIcon = null, // Pass this through
} = {}) {
  const targets = audioElements || (audioElement ? [audioElement] : []);
  if (!targets.length || !toggleButton) {
    return;
  }

  const storedMuted = localStorage.getItem(storageKeyMuted) === "true";

  function applyMute(muted) {
    targets.forEach((el) => (el.muted = muted));
    updateButtonState(toggleButton, muted);
    localStorage.setItem(storageKeyMuted, muted ? "true" : "false");
  }

  applyMute(storedMuted);

  toggleButton.addEventListener("click", () => {
    const currentMuted = targets[0].muted;
    applyMute(!currentMuted);
  });

  const container =
    sliderContainer ||
    toggleButton.parentElement.querySelector("#musicVolumeSliderContainer");

  if (container) {
    // Pass labelIcon to the slider creator
    createVolumeSlider(targets, container, storageKeyVolume, labelIcon);
  }
}