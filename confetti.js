/**
 * confetti.js
 * Very small confetti burst using plain divs + CSS animation.
 */
function launchConfetti(count = 60) {
  const layer = document.getElementById('confetti-layer');
  const colors = ['#FFB100', '#FF3D7F', '#00C2A8', '#FFD23F', '#FFFFFF'];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const size = 6 + Math.random() * 6;
    piece.style.width = size + 'px';
    piece.style.height = (size * 0.4) + 'px';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    const duration = 2.2 + Math.random() * 1.6;
    piece.style.animationDuration = duration + 's';
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), (duration + 0.5) * 1000);
  }
}
