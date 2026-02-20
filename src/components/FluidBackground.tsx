import { useEffect, useRef } from 'react';

// --- Types ---
interface FluidParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  alpha: number;
  life: number;
  maxLife: number;
}

// --- Constants ---
const PARTICLE_COUNT = 180;
const MOUSE_RADIUS = 150;
const MOUSE_FORCE = 0.8;
const FRICTION = 0.985;
const BASE_SPEED = 0.3;
const NOISE_SCALE = 0.003;
const TIME_SPEED = 0.0004;

// Simple 2D noise-like function for organic flow
function flowFieldAngle(x: number, y: number, t: number): number {
  const a = Math.sin(x * NOISE_SCALE + t) * Math.cos(y * NOISE_SCALE * 1.3 + t * 0.7);
  const b = Math.cos(x * NOISE_SCALE * 0.8 - t * 0.5) * Math.sin(y * NOISE_SCALE + t * 1.1);
  return (a + b) * Math.PI;
}

export function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<FluidParticle[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // --- Resize ---
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5); // cap for perf
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // --- Mouse tracking ---
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    // --- Init Particles ---
    const w = window.innerWidth;
    const h = window.innerHeight;
    const particles: FluidParticle[] = [];
    // Vibrant palette: cyans (170-200), blues (200-240), magentas (270-310)
    const hueRanges = [
      [170, 200], // cyan-teal
      [200, 250], // blue
      [270, 310], // magenta-purple
    ];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const maxLife = 500 + Math.random() * 700;
      const range = hueRanges[Math.floor(Math.random() * hueRanges.length)];
      const hue = range[0] + Math.random() * (range[1] - range[0]);
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * BASE_SPEED,
        vy: (Math.random() - 0.5) * BASE_SPEED,
        radius: 40 + Math.random() * 120,
        hue,
        alpha: 0.04 + Math.random() * 0.08,
        life: Math.random() * maxLife,
        maxLife,
      });
    }
    particlesRef.current = particles;

    // --- Animation Loop ---
    const animate = () => {
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      timeRef.current += TIME_SPEED;
      const t = timeRef.current;

      // Fade trail — slower fade = brighter, longer-lasting trails
      ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
      ctx.fillRect(0, 0, cw, ch);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      particles.forEach(p => {
        // 1. Flow field force
        const angle = flowFieldAngle(p.x, p.y, t);
        p.vx += Math.cos(angle) * BASE_SPEED * 0.1;
        p.vy += Math.sin(angle) * BASE_SPEED * 0.1;

        // 2. Mouse repulsion (obstacle)
        const dx = p.x - mx;
        const dy = p.y - my;
        const distSq = dx * dx + dy * dy;
        const mouseR = MOUSE_RADIUS;

        if (distSq < mouseR * mouseR && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / mouseR) * MOUSE_FORCE;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // 3. Friction
        p.vx *= FRICTION;
        p.vy *= FRICTION;

        // 4. Move
        p.x += p.vx;
        p.y += p.vy;

        // 5. Life cycle
        p.life += 1;
        if (p.life > p.maxLife || p.x < -100 || p.x > cw + 100 || p.y < -100 || p.y > ch + 100) {
          // Respawn
          p.x = Math.random() * cw;
          p.y = Math.random() * ch;
          p.vx = (Math.random() - 0.5) * BASE_SPEED;
          p.vy = (Math.random() - 0.5) * BASE_SPEED;
          p.life = 0;
          const range = hueRanges[Math.floor(Math.random() * hueRanges.length)];
          p.hue = range[0] + Math.random() * (range[1] - range[0]);
        }

        // 6. Draw — soft radial gradient blob
        const lifeFade = 1 - Math.abs(p.life / p.maxLife - 0.5) * 2; // peak at midlife
        const drawAlpha = p.alpha * Math.max(0, lifeFade);

        if (drawAlpha > 0.003) {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          grad.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${drawAlpha})`);
          grad.addColorStop(0.35, `hsla(${p.hue}, 90%, 60%, ${drawAlpha * 0.6})`);
          grad.addColorStop(0.7, `hsla(${p.hue}, 85%, 50%, ${drawAlpha * 0.2})`);
          grad.addColorStop(1, `hsla(${p.hue}, 80%, 40%, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    // Initial clear to dark
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    />
  );
}
