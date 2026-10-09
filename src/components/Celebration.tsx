// src/components/Celebration.tsx
// Confete (canvas, sem dependências) + carinha feliz ao pagar uma parcela.
import { AnimatePresence, motion } from 'framer-motion';

const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#a855f7'];

/** Dispara confete a partir de (x, y) em coordenadas de viewport. */
export function fireConfetti(x = window.innerWidth / 2, y = window.innerHeight / 2, count = 90) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999';
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  const parts = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const speed = 5 + Math.random() * 7;
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });

  const start = performance.now();
  const DURATION = 1800;
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const fade = Math.max(0, 1 - t / DURATION);
    for (const p of parts) {
      p.vy += 0.22; p.vx *= 0.99;
      p.x += p.vx;  p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Carinha feliz que "pula" na tela por ~1,4s. Mude `trigger` para disparar. */
export function HappyFace({ trigger, big = false }: { trigger: number; big?: boolean }) {
  return (
    <AnimatePresence>
      {trigger > 0 && (
        <motion.div
          key={trigger}
          initial={{ opacity: 0, scale: 0.3, y: 10 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.25, 1, 1], y: [10, -6, -6, -22] }}
          transition={{ duration: 1.4, times: [0, 0.2, 0.7, 1] }}
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          aria-hidden
        >
          <span className={big ? 'text-6xl' : 'text-5xl'} role="img" aria-label="Feliz">
            {big ? '🥳' : '😄'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
