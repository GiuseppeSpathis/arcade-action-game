document.addEventListener('DOMContentLoaded', () => {
  const playButton = document.getElementById('playButton');

  playButton.addEventListener('click', () => {
    window.location.href = '../scenario/scenario.html';
  });
});
