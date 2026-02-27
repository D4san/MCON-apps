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

// --- 2. Rest Fluid Background (Hydrostatic Pressure) ---
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

        let particles: { ox: number, oy: number, x: number, y: number, targetX: number, targetY: number, size: number, phaseX: number, phaseY: number, speed: number }[] = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        const initParticles = () => {
            particles = [];
            // OPTIMIZATION: Drastically reduced particle count, but they will be much larger
            const numParticles = Math.floor((canvas.width * canvas.height) / 5000); 
            for (let i = 0; i < numParticles; i++) {
                // Exponential distribution: heavily weighted towards the bottom, but less extreme now
                const depthFactor = Math.pow(Math.random(), 0.75); 
                const oy = canvas.height * depthFactor;
                const ox = Math.random() * canvas.width;
                
                // OPTIMIZATION: Particles are MUCH larger to compensate for fewer numbers
                const depth = oy / canvas.height;
                const size = Math.random() * 12 + 12 + (depth * 15); // Smaller at bottom, less difference overall

                particles.push({
                    ox, oy,
                    x: ox, y: oy,
                    targetX: ox, targetY: oy,
                    size,
                    phaseX: Math.random() * Math.PI * 2,
                    phaseY: Math.random() * Math.PI * 2,
                    speed: 0.2 + Math.random() * 0.8 // Slower, more majestic movement for large particles
                });
            }

            // RELAXATION STEP: Push base positions apart to prevent excessive overlapping at the bottom
            for (let step = 0; step < 15; step++) {
                for (let i = 0; i < particles.length; i++) {
                    for (let j = i + 1; j < particles.length; j++) {
                        const p1 = particles[i];
                        const p2 = particles[j];
                        const dx = p1.ox - p2.ox;
                        const dy = p1.oy - p2.oy;
                        
                        // Allow some overlap (65% of combined radii) for a "bubbly" look
                        const minDist = (p1.size + p2.size) * 0.65; 
                        
                        if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) {
                            const distSq = dx * dx + dy * dy;
                            if (distSq < minDist * minDist && distSq > 0.1) {
                                const dist = Math.sqrt(distSq);
                                const force = (minDist - dist) / dist * 0.5;
                                
                                p1.ox += dx * force;
                                p1.oy += dy * force * 0.3; // Less vertical push to maintain depth distribution
                                p2.ox -= dx * force;
                                p2.oy -= dy * force * 0.3;
                            }
                        }
                    }
                }
            }

            // Ensure they stay within bounds after relaxation
            particles.forEach(p => {
                p.ox = Math.max(p.size, Math.min(canvas.width - p.size, p.ox));
                p.oy = Math.max(p.size, Math.min(canvas.height + p.size * 2, p.oy)); // Allow slightly below screen
                p.x = p.ox;
                p.y = p.oy;
                p.targetX = p.ox;
                p.targetY = p.oy;
            });
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const time = Date.now() * 0.001;

            // 1. Calculate base targets with vibration
            particles.forEach(p => {
                const depth = p.oy / canvas.height;
                
                // Vibration amplitude: very tight at the bottom, very loose at the top
                const vibrationAmp = 2 + Math.pow(1 - depth, 2) * 15; 
                
                p.targetX = p.ox + Math.sin(p.phaseX + time * p.speed * 5) * vibrationAmp;
                p.targetY = p.oy + Math.cos(p.phaseY + time * p.speed * 5) * vibrationAmp;
            });

            // 2. Dynamic soft repulsion (makes them bounce off each other organically)
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const p1 = particles[i];
                    const p2 = particles[j];
                    const dx = p1.targetX - p2.targetX;
                    const dy = p1.targetY - p2.targetY;
                    
                    const minDist = (p1.size + p2.size) * 0.6; 
                    if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) {
                        const distSq = dx * dx + dy * dy;
                        if (distSq < minDist * minDist && distSq > 0.1) {
                            const dist = Math.sqrt(distSq);
                            const force = (minDist - dist) / dist * 0.15; // Gentle dynamic push
                            
                            p1.targetX += dx * force;
                            p1.targetY += dy * force;
                            p2.targetX -= dx * force;
                            p2.targetY -= dy * force;
                        }
                    }
                }
            }

            // 3. Apply mouse interaction, interpolate, and draw
            particles.forEach(p => {
                const depth = p.oy / canvas.height;

                // Mouse interaction (repel)
                const dx = mouse.x - p.targetX;
                const dy = mouse.y - p.targetY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 300) {
                    const force = Math.pow((300 - dist) / 300, 2);
                    p.targetX -= (dx / dist) * force * 80;
                    p.targetY -= (dy / dist) * force * 80;
                }

                // Smooth interpolation to target
                p.x += (p.targetX - p.x) * 0.1;
                p.y += (p.targetY - p.y) * 0.1;

                // Color gradient based on depth: lighter blue at top, deep cyan/blue at bottom
                const opacity = 0.1 + Math.pow(depth, 1.5) * 0.4; // Lower opacity since they are huge and overlap
                const r = Math.floor(56 - depth * 40); 
                const g = Math.floor(189 - depth * 80); 
                const b = Math.floor(248 + depth * 7); 
                
                // OPTIMIZATION: Only create radial gradient if particle is on screen to save CPU
                if (p.x + p.size > 0 && p.x - p.size < canvas.width && p.y + p.size > 0 && p.y - p.size < canvas.height) {
                    const gradient = ctx.createRadialGradient(p.x, p.y, p.size * 0.2, p.x, p.y, p.size);
                    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`); 
                    gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${opacity * 0.5})`); 
                    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${opacity})`); 

                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = gradient;
                    ctx.fill();
                    
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 1.5})`;
                    ctx.lineWidth = 1.5; // Thicker stroke for larger particles
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
            {/* Deep water gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-blue-950/20 to-blue-900/40" />
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
}

// --- 3. Solid Background (Deforming Lattice / FEA Mesh) ---
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
            const spacing = 45; // Slightly larger spacing for a more structural look
            cols = Math.ceil(canvas.width / spacing) + 2;
            rows = Math.ceil(canvas.height / spacing) + 2;
            
            for (let i = 0; i <= cols; i++) {
                for (let j = 0; j <= rows; j++) {
                    // Add slight irregularity to make it look like an unstructured FEA mesh
                    const isEdge = i === 0 || i === cols || j === 0 || j === rows;
                    const offsetX = isEdge ? 0 : (Math.random() - 0.5) * 15;
                    const offsetY = isEdge ? 0 : (Math.random() - 0.5) * 15;
                    
                    points.push({
                        x: i * spacing + offsetX, y: j * spacing + offsetY,
                        ox: i * spacing + offsetX, oy: j * spacing + offsetY,
                        vx: 0, vy: 0
                    });
                }
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Update physics (Stiff material)
            points.forEach(p => {
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Smooth, wide deformation field (like pressing into a thick rubber mat)
                // Increased radius from 300 to 450 for a wider deformation area
                if (dist < 450) {
                    const force = Math.pow((450 - dist) / 450, 2);
                    p.vx -= (dx / dist) * force * 4.5; // Slightly stronger force to compensate for wider area
                    p.vy -= (dy / dist) * force * 4.5;
                }

                // High stiffness spring (snaps back quickly)
                p.vx += (p.ox - p.x) * 0.15; 
                p.vy += (p.oy - p.y) * 0.15;
                // High damping (doesn't oscillate like jelly)
                p.vx *= 0.65; 
                p.vy *= 0.65;
                
                p.x += p.vx;
                p.y += p.vy;
            });

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Helper to draw a line and calculate its "stress" (strain)
            const drawLine = (p1: any, p2: any) => {
                // Calculate how far the nodes have moved from their rest positions
                const stress1 = Math.sqrt((p1.x - p1.ox)**2 + (p1.y - p1.oy)**2);
                const stress2 = Math.sqrt((p2.x - p2.ox)**2 + (p2.y - p2.oy)**2);
                const avgStress = (stress1 + stress2) / 2;
                
                // Normalize stress intensity (0 to 1)
                const intensity = Math.min(1, avgStress / 25); 

                if (intensity < 0.02) {
                    // Rest state: Darker base mesh
                    ctx.strokeStyle = 'rgba(225, 29, 72, 0.12)'; 
                    ctx.lineWidth = 0.8; 
                    ctx.shadowBlur = 0;
                } else {
                    // Stressed state: Less bright, but more blurry glow
                    const r = Math.floor(225 + intensity * 15); // Less shift to white/bright
                    const g = Math.floor(29 + intensity * 50);  // Less shift
                    const b = Math.floor(72 + intensity * 50);  // Less shift
                    
                    // Reduced max opacity for the line itself
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.15 + intensity * 0.4})`; 
                    ctx.lineWidth = 0.8 + intensity * 1.2; 
                    
                    // Increased blur, but with a softer, less opaque color
                    if (intensity > 0.15) { // Starts glowing slightly earlier
                        ctx.shadowBlur = intensity * 15; // Increased blur significantly
                        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.35)`; // Reduced glow opacity
                    } else {
                        ctx.shadowBlur = 0;
                    }
                }

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            };

            // Draw the FEA Truss Mesh Lines
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const p = points[i * (rows + 1) + j];
                    const right = points[(i + 1) * (rows + 1) + j];
                    const bottom = points[i * (rows + 1) + (j + 1)];
                    const diagonal = points[(i + 1) * (rows + 1) + (j + 1)]; // Cross-bracing

                    if (right) drawLine(p, right);
                    if (bottom) drawLine(p, bottom);
                    if (diagonal) drawLine(p, diagonal); // Adds the triangular/truss look
                }
            }
            
            ctx.shadowBlur = 0; // Reset shadow for nodes

            // Draw the Nodes (Joints)
            points.forEach(p => {
                const stress = Math.sqrt((p.x - p.ox)**2 + (p.y - p.oy)**2);
                const intensity = Math.min(1, stress / 25);
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5 + intensity * 1.5, 0, Math.PI * 2); 
                
                if (intensity < 0.02) {
                    ctx.fillStyle = 'rgba(244, 63, 94, 0.2)'; // Darker base node color
                } else {
                    ctx.fillStyle = `rgba(251, 113, 133, ${0.3 + intensity * 0.7})`; 
                }
                
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

            // Neon glow settings - More blurry and transparent
            ctx.shadowBlur = 15; // Increased blur
            ctx.shadowColor = 'rgba(245, 158, 11, 0.4)'; // Reduced opacity of the glow
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
                if (p.history.length > 35) p.history.shift(); // Increased from 15 to 35 for much longer trails

                // Draw trail and vector head
                if (p.history.length > 1) {
                    // 1. Draw the trail
                    ctx.beginPath();
                    ctx.moveTo(p.history[0].x, p.history[0].y);
                    for (let i = 1; i < p.history.length; i++) {
                        ctx.lineTo(p.history[i].x, p.history[i].y);
                    }
                    ctx.strokeStyle = 'rgba(245, 158, 11, 0.12)'; // More transparent trail
                    ctx.lineWidth = 1.5; // Thinner line
                    ctx.stroke();

                    // 2. Draw the vector arrowhead
                    const angle = Math.atan2(p.vy, p.vx);
                    const headLength = 6; // Slightly smaller head to match thinner line
                    
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - headLength * Math.cos(angle - Math.PI / 6), p.y - headLength * Math.sin(angle - Math.PI / 6));
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - headLength * Math.cos(angle + Math.PI / 6), p.y - headLength * Math.sin(angle + Math.PI / 6));
                    
                    ctx.strokeStyle = 'rgba(251, 146, 60, 0.4)'; // More transparent head
                    ctx.lineWidth = 1.5; // Thinner head lines
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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.08),transparent_60%)]" />
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
}
