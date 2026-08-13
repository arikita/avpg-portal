/** Lightweight, dependency-free confetti burst. Used on onboarding completion. */
export function celebrate(count = 90): void {
  if (typeof document === 'undefined') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#6a5bff', '#10c8b6', '#a855f7', '#ff6b6b', '#ffb03a', '#22d3ee'];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[i % colors.length];
    const duration = 2.2 + Math.random() * 1.8;
    piece.style.animationDuration = duration + 's';
    piece.style.animationDelay = Math.random() * 0.3 + 's';
    piece.style.transform = `translateY(-20px) rotate(${Math.random() * 360}deg)`;
    piece.style.opacity = String(0.7 + Math.random() * 0.3);
    if (Math.random() > 0.5) piece.style.borderRadius = '50%';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), (duration + 0.6) * 1000);
  }
}
