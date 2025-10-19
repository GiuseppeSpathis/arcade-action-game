const MUTED_ICON = "🔇";
const UNMUTED_ICON = "🔊";

function updateButtonState(toggleButton, isMuted) {
  if (!toggleButton) {
    return;
  }

  toggleButton.dataset.muted = isMuted ? "true" : "false";
  toggleButton.setAttribute("aria-pressed", isMuted ? "true" : "false");
  toggleButton.setAttribute(
    "aria-label",
    isMuted ? "Attiva l'audio" : "Disattiva l'audio"
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
}
