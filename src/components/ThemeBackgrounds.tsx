import { useEffect, useRef } from 'react';

// --- 1. Home Background (Crystalline Network + Waves) ---
export function HomeBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let mouse = { x: -1000, y: -1000 };

        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        const handleMouseLeave = () => {
            mouse = { x: -1000, y: -1000 };
        };

        window.addEventListener('mousemove', handleMouseMove);
        document.body.addEventListener('mouseleave', handleMouseLeave);

        let nodes: { x: number, y: number, ox: number, oy: number, vx: number, vy: number, phase: number }[] = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initNodes();
        };

        const initNodes = () => {
            nodes = [];
            const numNodes = Math.floor((canvas.width * canvas.height) / 8000);
            for (let i = 0; i < numNodes; i++) {
                nodes.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    ox: Math.random() * canvas.width,
                    oy: Math.random() * canvas.height,
                    vx: 0, vy: 0,
                    phase: Math.random() * Math.PI * 2
                });
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const time = Date.now() * 0.001;

            // Draw subtle waves at the bottom
            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += 20) {
                const y = canvas.height - 100 + Math.sin(x * 0.003 + time * 1.5) * 60 + Math.sin(x * 0.007 - time * 0.8) * 30;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Update & Draw nodes
            nodes.forEach(n => {
                // Faster drift
                n.ox += Math.cos(n.phase + time * 0.8) * 0.8;
                n.oy += Math.sin(n.phase + time * 0.8) * 0.8;

                // Mouse interaction (repel)
                const dx = mouse.x - n.x;
                const dy = mouse.y - n.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    const force = (150 - dist) / 150;
                    n.vx -= (dx / dist) * force * 0.5;
                    n.vy -= (dy / dist) * force * 0.5;
                }

                // Spring to origin
                n.vx += (n.ox - n.x) * 0.01;
                n.vy += (n.oy - n.y) * 0.01;
                
                // Friction
                n.vx *= 0.9;
                n.vy *= 0.9;

                n.x += n.vx;
                n.y += n.vy;
            });

            // Draw connections
            ctx.lineWidth = 1;
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < 20000) { // ~141px
                        const alpha = 1 - (distSq / 20000);
                        ctx.strokeStyle = `rgba(14, 165, 233, ${alpha * 0.5})`;
                        ctx.beginPath();
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.stroke();
                    }
                }
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            document.body.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] bg-slate-950 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.05),transparent_60%)]" />
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
}

// --- 2. Rest Fluid Background (Planet Atmosphere) ---
export function RestFluidBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let mouse = { x: -1000, y: -1000 };

        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        const handleMouseLeave = () => {
            mouse = { x: -1000, y: -1000 };
        };

        window.addEventListener('mousemove', handleMouseMove);
        document.body.addEventListener('mouseleave', handleMouseLeave);

        let particles: { x: number, y: number, angle: number, radius: number, speed: number, size: number }[] = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        const initParticles = () => {
            particles = [];
            const numParticles = Math.floor((canvas.width * canvas.height) / 3000);
            for (let i = 0; i < numParticles; i++) {
                particles.push({
                    angle: Math.random() * Math.PI * 2,
                    radius: 100 + Math.random() * (canvas.height * 1.2),
                    speed: 0.0005 + Math.random() * 0.0015,
                    size: Math.random() * 2.5 + 0.5,
                    x: 0, y: 0
                });
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const centerX = canvas.width / 2;
            const centerY = canvas.height + 200;

            particles.forEach(p => {
                p.angle += p.speed;
                
                // Base position (orbiting)
                let targetX = centerX + Math.cos(p.angle) * p.radius;
                let targetY = centerY - Math.sin(p.angle) * (p.radius * 0.6); // Elliptical

                // Mouse interaction (gentle push)
                const dx = mouse.x - targetX;
                const dy = mouse.y - targetY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 350) {
                    const force = (350 - dist) / 350;
                    targetX -= (dx / dist) * force * 80;
                    targetY -= (dy / dist) * force * 80;
                }

                p.x += (targetX - p.x) * 0.05 || targetX;
                p.y += (targetY - p.y) * 0.05 || targetY;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(56, 189, 248, ${0.2 + Math.random() * 0.3})`;
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            document.body.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] bg-slate-950 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(30,58,138,0.2),transparent_70%)]" />
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
}

// --- 3. Solid Background (Deforming Lattice) ---
export function SolidBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let mouse = { x: -1000, y: -1000 };

        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        const handleMouseLeave = () => {
            mouse = { x: -1000, y: -1000 };
        };

        window.addEventListener('mousemove', handleMouseMove);
        document.body.addEventListener('mouseleave', handleMouseLeave);

        let points: { x: number, y: number, ox: number, oy: number, vx: number, vy: number }[] = [];
        let cols = 0;
        let rows = 0;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initGrid();
        };

        const initGrid = () => {
            points = [];
            const spacing = 50;
            cols = Math.ceil(canvas.width / spacing) + 1;
            rows = Math.ceil(canvas.height / spacing) + 1;
            
            for (let i = 0; i <= cols; i++) {
                for (let j = 0; j <= rows; j++) {
                    points.push({
                        x: i * spacing, y: j * spacing,
                        ox: i * spacing, oy: j * spacing,
                        vx: 0, vy: 0
                    });
                }
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Update physics
            points.forEach(p => {
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 200) {
                    const force = (200 - dist) / 200;
                    p.vx -= (dx / dist) * force * 1.5;
                    p.vy -= (dy / dist) * force * 1.5;
                }

                p.vx += (p.ox - p.x) * 0.05; // spring
                p.vy += (p.oy - p.y) * 0.05;
                p.vx *= 0.85; // friction
                p.vy *= 0.85;
                p.x += p.vx;
                p.y += p.vy;
            });

            ctx.strokeStyle = 'rgba(244, 63, 94, 0.15)'; // Rose color
            ctx.lineWidth = 1;
            
            // Draw horizontal lines
            for (let j = 0; j <= rows; j++) {
                ctx.beginPath();
                for (let i = 0; i <= cols; i++) {
                    const p = points[i * (rows + 1) + j];
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }
            
            // Draw vertical lines
            for (let i = 0; i <= cols; i++) {
                ctx.beginPath();
                for (let j = 0; j <= rows; j++) {
                    const p = points[i * (rows + 1) + j];
                    if (j === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            document.body.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] bg-slate-950 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(225,29,72,0.05),transparent_70%)]" />
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
}

// --- 4. Hydro Background (Turbulent Gas Flow) ---
export function HydroBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let mouse = { x: -1000, y: -1000 };

        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        const handleMouseLeave = () => {
            mouse = { x: -1000, y: -1000 };
        };

        window.addEventListener('mousemove', handleMouseMove);
        document.body.addEventListener('mouseleave', handleMouseLeave);

        let particles: { x: number, y: number, vx: number, vy: number, history: {x: number, y: number}[] }[] = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        const initParticles = () => {
            particles = [];
            const numParticles = Math.floor((canvas.width * canvas.height) / 8000);
            for (let i = 0; i < numParticles; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: 0, vy: 0,
                    history: []
                });
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const time = Date.now() * 0.001;

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)'; // Sky blue
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            particles.forEach(p => {
                // Base flow (left to right with sine wave turbulence)
                let flowX = 1.5 + Math.sin(p.y * 0.005 + time) * 0.5;
                let flowY = Math.cos(p.x * 0.005 + time) * 0.5;

                // Mouse interaction (obstacle)
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 200) {
                    const force = (200 - dist) / 200;
                    // Push outward and slightly around
                    flowX += (dx / dist) * force * 4;
                    flowY += (dy / dist) * force * 4;
                }

                p.vx = p.vx * 0.9 + flowX * 0.1;
                p.vy = p.vy * 0.9 + flowY * 0.1;

                p.x += p.vx;
                p.y += p.vy;

                // Wrap around
                if (p.x > canvas.width + 50) {
                    p.x = -50;
                    p.y = Math.random() * canvas.height;
                    p.vx = 0; p.vy = 0;
                    p.history = [];
                }
                if (p.y < -50) { p.y = canvas.height + 50; p.history = []; }
                if (p.y > canvas.height + 50) { p.y = -50; p.history = []; }

                // Update history for trail
                p.history.push({ x: p.x, y: p.y });
                if (p.history.length > 15) p.history.shift();

                // Draw trail
                if (p.history.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(p.history[0].x, p.history[0].y);
                    for (let i = 1; i < p.history.length; i++) {
                        ctx.lineTo(p.history[i].x, p.history[i].y);
                    }
                    ctx.stroke();
                }
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            document.body.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] bg-slate-950 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.05),transparent_60%)]" />
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
}
