import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Circle, Square, Triangle, Brush, Eraser, Layers, Activity, Minus, Trash2, ChevronDown, ChevronUp, Wind, Droplet } from "lucide-react";
import { cn } from "../../../lib/utils";

const COLS = 200;
const ROWS = 80;
const ITER = 40;

// ---- PHYSICS ENGINE ----
class FluidGrid {
    cols: number;
    rows: number;
    u: Float32Array;
    v: Float32Array;
    p: Float32Array;
    u0: Float32Array;
    v0: Float32Array;
    div: Float32Array;
    isSolid: Uint8Array;
    
    constructor(cols: number, rows: number) {
        this.cols = cols;
        this.rows = rows;
        let size = cols * rows;
        this.u = new Float32Array(size);
        this.v = new Float32Array(size);
        this.p = new Float32Array(size);
        this.u0 = new Float32Array(size);
        this.v0 = new Float32Array(size);
        this.div = new Float32Array(size);
        this.isSolid = new Uint8Array(size);
    }
    
    IX(x: number, y: number) { 
        return Math.max(0, Math.min(this.rows - 1, y)) * this.cols + Math.max(0, Math.min(this.cols - 1, x)); 
    }
    
    advect(dt: number) {
        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                let i = this.IX(x, y);
                if (this.isSolid[i]) continue;
                
                let px = x - this.u0[i] * dt;
                let py = y - this.v0[i] * dt;
                
                if (px < 0.5) px = 0.5; if (px > this.cols - 1.5) px = this.cols - 1.5;
                if (py < 0.5) py = 0.5; if (py > this.rows - 1.5) py = this.rows - 1.5;
                
                let x0 = Math.floor(px); let x1 = x0 + 1;
                let y0 = Math.floor(py); let y1 = y0 + 1;
                
                let s1 = px - x0; let s0 = 1 - s1;
                let t1 = py - y0; let t0 = 1 - t1;
                
                this.u[i] = s0 * (t0 * this.u0[this.IX(x0, y0)] + t1 * this.u0[this.IX(x0, y1)]) +
                            s1 * (t0 * this.u0[this.IX(x1, y0)] + t1 * this.u0[this.IX(x1, y1)]);
                            
                this.v[i] = s0 * (t0 * this.v0[this.IX(x0, y0)] + t1 * this.v0[this.IX(x0, y1)]) +
                            s1 * (t0 * this.v0[this.IX(x1, y0)] + t1 * this.v0[this.IX(x1, y1)]);
            }
        }
    }

    project() {
        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                let i = this.IX(x, y);
                if (this.isSolid[i]) continue;
                
                let uR = this.isSolid[this.IX(x+1, y)] ? 0 : this.u[this.IX(x+1, y)];
                let uL = this.isSolid[this.IX(x-1, y)] ? 0 : this.u[this.IX(x-1, y)];
                let vB = this.isSolid[this.IX(x, y+1)] ? 0 : this.v[this.IX(x, y+1)];
                let vT = this.isSolid[this.IX(x, y-1)] ? 0 : this.v[this.IX(x, y-1)];
                
                this.div[i] = -0.5 * (uR - uL + vB - vT);
                this.p[i] = 0;
            }
        }
        
        for (let k = 0; k < ITER; k++) {
            for (let y = 1; y < this.rows - 1; y++) {
                for (let x = 1; x < this.cols - 1; x++) {
                    let i = this.IX(x, y);
                    if (this.isSolid[i]) continue;
                    
                    let pL = this.isSolid[this.IX(x-1, y)] ? this.p[i] : this.p[this.IX(x-1, y)];
                    let pR = this.isSolid[this.IX(x+1, y)] ? this.p[i] : this.p[this.IX(x+1, y)];
                    let pU = this.isSolid[this.IX(x, y-1)] ? this.p[i] : this.p[this.IX(x, y-1)];
                    let pD = this.isSolid[this.IX(x, y+1)] ? this.p[i] : this.p[this.IX(x, y+1)];
                    
                    let pNew = (this.div[i] + pL + pR + pU + pD) / 4.0;
                    this.p[i] = this.p[i] + 1.7 * (pNew - this.p[i]);
                }
            }
            for (let y = 0; y < this.rows; y++) {
                this.p[this.IX(0, y)] = this.p[this.IX(1, y)];
                this.p[this.IX(this.cols-1, y)] = 0; 
            }
            for (let x = 0; x < this.cols; x++) {
                this.p[this.IX(x, 0)] = this.p[this.IX(x, 1)];
                this.p[this.IX(x, this.rows-1)] = this.p[this.IX(x, this.rows-2)];
            }
        }
        
        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                let i = this.IX(x, y);
                if (this.isSolid[i]) continue;
                
                let pL = this.isSolid[this.IX(x-1, y)] ? this.p[i] : this.p[this.IX(x-1, y)];
                let pR = this.isSolid[this.IX(x+1, y)] ? this.p[i] : this.p[this.IX(x+1, y)];
                let pU = this.isSolid[this.IX(x, y-1)] ? this.p[i] : this.p[this.IX(x, y-1)];
                let pD = this.isSolid[this.IX(x, y+1)] ? this.p[i] : this.p[this.IX(x, y+1)];
                
                this.u[i] -= 0.5 * (pR - pL);
                this.v[i] -= 0.5 * (pD - pU);
            }
        }

        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                let i = this.IX(x, y);
                if (this.isSolid[i]) {
                    let n = 0;
                    let su = 0; let sv = 0;
                    if (!this.isSolid[this.IX(x+1, y)]) { su += this.u[this.IX(x+1, y)]; sv += this.v[this.IX(x+1, y)]; n++; }
                    if (!this.isSolid[this.IX(x-1, y)]) { su += this.u[this.IX(x-1, y)]; sv += this.v[this.IX(x-1, y)]; n++; }
                    if (!this.isSolid[this.IX(x, y+1)]) { su += this.u[this.IX(x, y+1)]; sv += this.v[this.IX(x, y+1)]; n++; }
                    if (!this.isSolid[this.IX(x, y-1)]) { su += this.u[this.IX(x, y-1)]; sv += this.v[this.IX(x, y-1)]; n++; }
                    if (n > 0) {
                        this.u[i] = su / n;
                        this.v[i] = sv / n;
                    } else {
                        this.u[i] = 0; this.v[i] = 0;
                    }
                }
            }
        }
    }
    
    step(dt: number, U0: number) {
        this.u0.set(this.u);
        this.v0.set(this.v);
        
        this.advect(dt);
        
        for (let y = 0; y < this.rows; y++) {
            let iLeft = this.IX(0, y);
            if (!this.isSolid[iLeft]) {
                 this.u[iLeft] = U0; 
                 this.v[iLeft] = 0;
            }
        }
        for (let x = 0; x < this.cols; x++) {
            let iTop = this.IX(x, 0);
            let iBot = this.IX(x, this.rows-1);
            if (!this.isSolid[iTop]) this.v[iTop] = 0;
            if (!this.isSolid[iBot]) this.v[iBot] = 0;
        }

        this.project();
        
        for (let y = 0; y < this.rows; y++) {
            let iRight = this.IX(this.cols-1, y);
            if (!this.isSolid[iRight]) {
                 this.u[iRight] = this.u[this.IX(this.cols-2, y)];
                 this.v[iRight] = this.v[this.IX(this.cols-2, y)];
            }
            let iLeft = this.IX(0, y);
            if (!this.isSolid[iLeft]) {
                 this.u[iLeft] = U0; 
                 this.v[iLeft] = 0;
            }
        }
    }

    getVelocityAt(x: number, y: number) {
        if (x < 0) x = 0; if (x >= this.cols - 1) x = this.cols - 1.001;
        if (y < 0) y = 0; if (y >= this.rows - 1) y = this.rows - 1.001;
        
        let x0 = Math.floor(x); let x1 = x0 + 1;
        let y0 = Math.floor(y); let y1 = y0 + 1;
        
        let s1 = x - x0; let s0 = 1 - s1;
        let t1 = y - y0; let t0 = 1 - t1;
        
        let u = s0 * (t0 * this.u[this.IX(x0, y0)] + t1 * this.u[this.IX(x0, y1)]) +
                s1 * (t0 * this.u[this.IX(x1, y0)] + t1 * this.u[this.IX(x1, y1)]);
                
        let v = s0 * (t0 * this.v[this.IX(x0, y0)] + t1 * this.v[this.IX(x0, y1)]) +
                s1 * (t0 * this.v[this.IX(x1, y0)] + t1 * this.v[this.IX(x1, y1)]);
                
        return { u, v };
    }
}

// ---- DRAWING MECHANICS ----
function drawCircle(grid: FluidGrid, cx: number, cy: number, r: number, solid: boolean) {
    let yStart = Math.floor(Math.max(0, cy-r)); let yEnd = Math.floor(Math.min(ROWS-1, cy+r));
    let xStart = Math.floor(Math.max(0, cx-r)); let xEnd = Math.floor(Math.min(COLS-1, cx+r));
    for(let y = yStart; y <= yEnd; y++) {
        for(let x = xStart; x <= xEnd; x++) {
            if (Math.hypot(x-cx, y-cy) <= r) grid.isSolid[grid.IX(x,y)] = solid ? 1 : 0;
        }
    }
}

function drawSquare(grid: FluidGrid, cx: number, cy: number, r: number, solid: boolean) {
    let yStart = Math.floor(Math.max(0, cy-r)); let yEnd = Math.floor(Math.min(ROWS-1, cy+r));
    let xStart = Math.floor(Math.max(0, cx-r)); let xEnd = Math.floor(Math.min(COLS-1, cx+r));
    for(let y = yStart; y <= yEnd; y++) {
        for(let x = xStart; x <= xEnd; x++) grid.isSolid[grid.IX(x,y)] = solid ? 1 : 0;
    }
}

function drawTriangle(grid: FluidGrid, cx: number, cy: number, r: number, solid: boolean) {
    let yStart = Math.floor(Math.max(0, cy-r)); let yEnd = Math.floor(Math.min(ROWS-1, cy+r));
    let xStart = Math.floor(Math.max(0, cx-r)); let xEnd = Math.floor(Math.min(COLS-1, cx+r));
    for(let y = yStart; y <= yEnd; y++) {
        for(let x = xStart; x <= xEnd; x++) {
            if (y >= cy - r) {
                let w = (y - (cy-r)) * 0.866;
                if (Math.abs(x-cx) <= w) grid.isSolid[grid.IX(x,y)] = solid ? 1 : 0;
            }
        }
    }
}

function drawAirfoil(grid: FluidGrid, cx: number, cy: number, r: number, solid: boolean) {
    let chord = r * 2; let leadX = cx - r;
    let xStart = Math.floor(Math.max(0, cx-r)); let xEnd = Math.floor(Math.min(COLS-1, cx+r));
    for(let x = xStart; x <= xEnd; x++) {
        let px = (x - leadX) / chord;
        if (px >= 0 && px <= 1) {
            let thick = 0.60 * (0.2969 * Math.sqrt(px) - 0.1260*px - 0.3516*px*px + 0.2843*px*px*px - 0.1015*px*px*px*px);
            let h = Math.abs(thick * chord * 2.5); 
            let yStart = Math.floor(Math.max(0, cy-h)); let yEnd = Math.floor(Math.min(ROWS-1, cy+h));
            for(let y = yStart; y <= yEnd; y++) grid.isSolid[grid.IX(x,y)] = solid ? 1 : 0;
        }
    }
}

function drawBar(grid: FluidGrid, cx: number, cy: number, r: number, solid: boolean) {
    let w = Math.max(2, r * 0.15);
    let yStart = Math.floor(Math.max(0, cy-r)); let yEnd = Math.floor(Math.min(ROWS-1, cy+r));
    let xStart = Math.floor(Math.max(0, cx-w)); let xEnd = Math.floor(Math.min(COLS-1, cx+w));
    for(let y = yStart; y <= yEnd; y++) {
        for(let x = xStart; x <= xEnd; x++) grid.isSolid[grid.IX(x,y)] = solid ? 1 : 0;
    }
}

function drawShape(grid: FluidGrid, shape: string, cx: number, cy: number, r: number, solid: boolean) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    if (shape === 'circle') drawCircle(grid, cx, cy, r, solid);
    else if (shape === 'square') drawSquare(grid, cx, cy, r, solid);
    else if (shape === 'triangle') drawTriangle(grid, cx, cy, r, solid);
    else if (shape === 'airfoil') drawAirfoil(grid, cx, cy, r, solid);
    else if (shape === 'bar') drawBar(grid, cx, cy, r, solid);
}

function drawLine(grid: FluidGrid, x0: number, y0: number, x1: number, y1: number, r: number, solid: boolean) {
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let e2;
    while (true) {
        drawCircle(grid, x0, y0, r, solid);
        if (x0 === x1 && y0 === y1) break;
        e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}

// ---- COLOR MAPPERS ----
function getColorVorticity(v: number, contrast: number) {
    v = v * contrast;
    let c = Math.max(-1, Math.min(1, v));
    let r = c > 0 ? 255 : 255 * (1 + c);
    let b = c < 0 ? 255 : 255 * (1 - c);
    let g = 255 * (1 - Math.abs(c));
    return `rgba(${r|0}, ${g|0}, ${b|0}, 0.8)`;
}

function getColorMagnitude(v: number, contrast: number) {
    v = v * contrast;
    let t = Math.max(0, Math.min(1, v / 3.0));
    return `rgba(${30 + 200*t}, ${170 + 70*(1-Math.abs(t-0.5))}, ${200 - 150*t}, 0.8)`;
}

function getColorPressure(p: number, contrast: number) {
    p = p * contrast;
    let t = Math.max(0, Math.min(1, (p + 0.5)));
    let r = t > 0.5 ? 255 : 255 * (t * 2);
    let g = t > 0.5 ? 255 * (2 - t * 2) : 255 * (t * 2);
    let b = t < 0.5 ? 255 : 255 * (2 - t * 2);
    return `rgba(${r|0}, ${g|0}, ${b|0}, 0.8)`;
}

// ---- REACT COMPONENT ----
export default function EulerSandbox() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fluidRef = useRef<FluidGrid | null>(null);
    const masterSolidRef = useRef<Uint8Array | null>(null);
    const smokeLinesRef = useRef<{x: number, y: number}[][]>([]);
    const mParticlesRef = useRef<{x: number, y: number}[]>([]);
    
    if (!fluidRef.current) {
        fluidRef.current = new FluidGrid(COLS, ROWS);
        masterSolidRef.current = new Uint8Array(COLS * ROWS);
    }
    
    const [tool, setTool] = useState('circle');
    const [heatmap, setHeatmap] = useState<'none'|'pressure'|'magnitude'|'vorticity'>('none');
    const [showStreamlines, setShowStreamlines] = useState(true);
    const [showParticles, setShowParticles] = useState(true);
    const [smokeDensity, setSmokeDensity] = useState<'poco'|'normal'|'mucho'>('normal');
    const [massDensity, setMassDensity] = useState<'poco'|'normal'|'mucho'>('normal');
    const [U0, setU0] = useState(1.0);
    const [contrast, setContrast] = useState(1.0);
    const [isMenuOpen, setIsMenuOpen] = useState(true);
    
    const isDraggingRef = useRef(false);
    const startPosRef = useRef({x:0, y:0});
    const lastPosRef = useRef({x:0, y:0});
    
    const uiStateRef = useRef({ heatmap, showStreamlines, showParticles, U0, smokeDensity, massDensity, contrast });
    useEffect(() => {
        uiStateRef.current = { heatmap, showStreamlines, showParticles, U0, smokeDensity, massDensity, contrast };
    }, [heatmap, showStreamlines, showParticles, U0, smokeDensity, massDensity, contrast]);

    const getGridPos = (e: React.PointerEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const scaleX = COLS / rect.width;
        const scaleY = ROWS / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const onPointerDown = (e: React.PointerEvent) => {
        isDraggingRef.current = true;
        const pos = getGridPos(e);
        startPosRef.current = { ...pos };
        lastPosRef.current = { ...pos };
        
        if (tool === 'brush') {
            drawLine(fluidRef.current!, Math.round(pos.x), Math.round(pos.y), Math.round(pos.x), Math.round(pos.y), 2, true);
            masterSolidRef.current!.set(fluidRef.current!.isSolid);
        } else if (tool === 'eraser') {
            drawLine(fluidRef.current!, Math.round(pos.x), Math.round(pos.y), Math.round(pos.x), Math.round(pos.y), 4, false);
            masterSolidRef.current!.set(fluidRef.current!.isSolid);
        }
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        const pos = getGridPos(e);
        const fluid = fluidRef.current!;
        const master = masterSolidRef.current!;
        
        if (tool === 'brush') {
            drawLine(fluid, Math.round(lastPosRef.current.x), Math.round(lastPosRef.current.y), Math.round(pos.x), Math.round(pos.y), 2, true);
            master.set(fluid.isSolid);
        } else if (tool === 'eraser') {
            drawLine(fluid, Math.round(lastPosRef.current.x), Math.round(lastPosRef.current.y), Math.round(pos.x), Math.round(pos.y), 4, false);
            master.set(fluid.isSolid);
        } else {
            fluid.isSolid.set(master); 
            const r = Math.max(2, Math.hypot(pos.x - startPosRef.current.x, pos.y - startPosRef.current.y));
            drawShape(fluid, tool, startPosRef.current.x, startPosRef.current.y, r, true);
        }
        lastPosRef.current = { ...pos };
    };

    const onPointerUp = () => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            masterSolidRef.current!.set(fluidRef.current!.isSolid);
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        
        let reqId: number;
        
        const render = () => {
            const ui = uiStateRef.current;
            const fluid = fluidRef.current!;
            fluid.step(0.1, ui.U0);
            
            // Re-size density arrays dynamically
            const targetSmokeCount = ui.smokeDensity === 'poco' ? 12 : ui.smokeDensity === 'normal' ? 28 : 60;
            const targetMassCount = ui.massDensity === 'poco' ? 500 : ui.massDensity === 'normal' ? 1500 : 4000;

            if (smokeLinesRef.current.length !== targetSmokeCount) {
                smokeLinesRef.current = Array.from({length: targetSmokeCount}, () => []);
            }
            if (mParticlesRef.current.length !== targetMassCount) {
                if (mParticlesRef.current.length < targetMassCount) {
                    while(mParticlesRef.current.length < targetMassCount) {
                        mParticlesRef.current.push({x: Math.random()*COLS, y: Math.random()*ROWS});
                    }
                } else {
                    mParticlesRef.current.length = targetMassCount;
                }
            }
            
            ctx.fillStyle = "#05070d";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const sX = canvas.width / COLS;
            const sY = canvas.height / ROWS;

            if (ui.heatmap !== 'none') {
                for (let y = 0; y < ROWS; y++) {
                    for (let x = 0; x < COLS; x++) {
                        let i = fluid.IX(x, y);
                        if (fluid.isSolid[i]) continue;
                        let val = 0;
                        if (ui.heatmap === 'pressure') val = fluid.p[i];
                        else if (ui.heatmap === 'magnitude') val = Math.hypot(fluid.u[i], fluid.v[i]);
                        else {
                            let vR = fluid.v[fluid.IX(Math.min(x+1, COLS-1), y)];
                            let vL = fluid.v[fluid.IX(Math.max(x-1, 0), y)];
                            let uB = fluid.u[fluid.IX(x, Math.min(y+1, ROWS-1))];
                            let uT = fluid.u[fluid.IX(x, Math.max(y-1, 0))];
                            val = 0.5 * (vR - vL - (uB - uT)) * 5.0;
                        }
                        ctx.fillStyle = ui.heatmap === 'pressure' ? getColorPressure(val, ui.contrast) : 
                                        ui.heatmap === 'magnitude' ? getColorMagnitude(val, ui.contrast) : 
                                        getColorVorticity(val, ui.contrast);
                        ctx.fillRect(x*sX, y*sY, sX+1, sY+1);
                    }
                }
            }
            
            ctx.fillStyle = "rgba(15, 23, 42, 1)";
            ctx.beginPath();
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    if (fluid.isSolid[fluid.IX(x, y)]) {
                        ctx.rect(x*sX, y*sY, sX+1, sY+1);
                    }
                }
            }
            ctx.fill();
            
            if (ui.showStreamlines) {
                ctx.strokeStyle = "rgba(220, 240, 255, 0.5)";
                ctx.lineWidth = 1.8;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                
                let lines = smokeLinesRef.current;
                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i];
                    let emitterY = (i + 0.5) * (ROWS / lines.length);
                    
                    let lastP = line.length > 0 ? line[line.length - 1] : null;
                    if (!lastP || Math.hypot(lastP.x - 0.5, lastP.y - emitterY) > 0.4) {
                         line.push({ x: 0.5, y: emitterY });
                    }
                    
                    let hitSolidIdx = -1;
                    for (let j = 0; j < line.length; j++) {
                        let p = line[j];
                        let vel = fluid.getVelocityAt(p.x, p.y);
                        p.x += vel.u * 1.0; 
                        p.y += vel.v * 1.0;
                        if (p.x < 0 || p.x > COLS || p.y < 0 || p.y > ROWS || fluid.isSolid[fluid.IX(p.x|0, p.y|0)]) {
                            hitSolidIdx = j;
                        }
                    }
                    
                    if (hitSolidIdx !== -1) {
                        line.splice(0, hitSolidIdx + 1);
                    }
                    
                    if (line.length > 800) line.splice(0, line.length - 800);
                    
                    if (line.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(line[0].x * sX, line[0].y * sY);
                        for (let j = 1; j < line.length; j++) {
                            ctx.lineTo(line[j].x * sX, line[j].y * sY);
                        }
                        ctx.stroke();
                    }
                }
            }
            
            if (ui.showParticles) {
                ctx.fillStyle = "rgba(103, 232, 249, 0.9)";
                ctx.beginPath();
                let mParticles = mParticlesRef.current;
                for(let p of mParticles) {
                    let vel = fluid.getVelocityAt(p.x, p.y);
                    p.x += vel.u * 0.5; p.y += vel.v * 0.5; 
                    if (p.x<0 || p.x>COLS || p.y<0 || p.y>ROWS || fluid.isSolid[fluid.IX(p.x|0, p.y|0)]) {
                        p.x = Math.random() * 2; p.y = Math.random() * ROWS; 
                    } else {
                        ctx.moveTo(p.x * sX, p.y * sY);
                        ctx.arc(p.x * sX, p.y * sY, 2.0, 0, Math.PI*2);
                    }
                }
                ctx.fill();
            }
            
            reqId = requestAnimationFrame(render);
        };
        reqId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(reqId);
    }, []);

    const toolsConfig = [
        { id: 'circle', icon: Circle, tooltip: 'Círculo' },
        { id: 'square', icon: Square, tooltip: 'Cuadrado' },
        { id: 'triangle', icon: Triangle, tooltip: 'Triángulo' },
        { id: 'airfoil', icon: Activity, tooltip: 'Perfil Alar' },
        { id: 'bar', icon: Minus, tooltip: 'Muro' },
        { id: 'brush', icon: Brush, tooltip: 'Pincel Libre' },
        { id: 'eraser', icon: Eraser, tooltip: 'Borrador' }
    ];

    return (
        <div className="flex h-full w-full flex-col relative bg-[#05070d]">
            
            <div className={cn(
                "flex-1 w-full relative flex items-center justify-center p-4 lg:p-6 overflow-hidden transition-all duration-300",
                isMenuOpen ? "pb-[200px]" : "pb-6"
            )}>
                <canvas 
                    ref={canvasRef} 
                    width={1000} 
                    height={400} 
                    className="w-full h-full object-contain cursor-crosshair rounded-xl shadow-2xl bg-[#0a0f1a] border border-white/5"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                    onContextMenu={(e) => e.preventDefault()}
                />
            </div>

            <div className="absolute left-6 top-6 flex flex-col gap-2 bg-slate-950/80 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-xl z-10">
                {toolsConfig.map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setTool(t.id)}
                        className={cn(
                            "p-2.5 rounded-lg transition-all",
                            tool === t.id ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        )}
                        title={t.tooltip}
                    >
                        <t.icon size={20} />
                    </button>
                ))}
                <div className="h-px bg-white/10 my-1" />
                <button 
                    onClick={() => {
                        fluidRef.current!.isSolid.fill(0);
                        masterSolidRef.current!.fill(0);
                    }}
                    className="p-2.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-all"
                    title="Limpiar Todo"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            {heatmap !== 'none' && (
                <div className="absolute top-6 right-6 bg-slate-950/80 backdrop-blur-md p-3 rounded-xl border border-white/10 w-52 shadow-xl z-10 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-slate-300 text-center uppercase tracking-wider">
                        {heatmap === 'magnitude' ? 'Magnitud Vel. (|V|)' : heatmap === 'vorticity' ? 'Vorticidad (ω)' : 'Presión Relativa (P)'}
                    </div>
                    <div className="h-2 w-full rounded-full" style={{ 
                        background: heatmap === 'magnitude' 
                            ? 'linear-gradient(to right, rgb(30,170,200), rgb(130,240,125), rgb(230,170,50))' 
                            : heatmap === 'vorticity'
                                ? 'linear-gradient(to right, rgb(0,0,255), rgb(255,255,255), rgb(255,0,0))'
                                : 'linear-gradient(to right, rgb(0,0,255), rgb(255,255,255), rgb(255,0,0))'
                    }} />
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>{heatmap === 'magnitude' ? '0.0' : heatmap === 'vorticity' ? (-1.0 / contrast).toFixed(1) : (-0.5 / contrast).toFixed(2)}</span>
                        <span>{heatmap === 'magnitude' ? (3.0 / contrast).toFixed(1) : heatmap === 'vorticity' ? (1.0 / contrast).toFixed(1) : (0.5 / contrast).toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t border-white/10 mt-1 pt-2">
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase mb-2">
                            <span>Sensibilidad (Contraste)</span>
                            <span className="text-cyan-400">{contrast.toFixed(1)}x</span>
                        </div>
                        <input
                            type="range"
                            min={0.2} max={3.0} step={0.1}
                            value={contrast}
                            onChange={(e) => setContrast(Number(e.target.value))}
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400"
                        />
                    </div>
                </div>
            )}

            <div className={cn(
                "absolute bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 transition-transform duration-300 z-20",
                isMenuOpen ? "translate-y-0" : "translate-y-[calc(100%-3.5rem)]"
            )}>
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex w-full items-center justify-between p-4 px-6 hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                        <Layers size={16} className="text-cyan-400" />
                        Opciones del Sandbox
                    </div>
                    {isMenuOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
                </button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 pt-0">
                    <div className="space-y-4">
                        <label className="block rounded-xl border border-white/10 bg-slate-900/50 p-4">
                            <div className="mb-3 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-300">Corriente Libre (U0)</span>
                                <span className="font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded">{U0.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                min={0} max={3} step={0.1}
                                value={U0}
                                onChange={(e) => setU0(Number(e.target.value))}
                                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400"
                            />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => { 
                                    let grid = fluidRef.current;
                                    grid.u.fill(U0); grid.v.fill(0); grid.p.fill(0); grid.div.fill(0);
                                    setParticles([]);
                                }}
                                className={`py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 border border-indigo-500/20`}
                            >
                                <Activity size={16} /> Reset Fluido
                            </button>
                            <button 
                                onClick={() => { setGeometries([]); fluidRef.current.isSolid.fill(false); }}
                                className={`py-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 border border-red-500/20`}
                            >
                                <Trash2 size={16} /> Borrar Sólidos
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Mapas de Calor (Fondos)</div>
                        <div className="grid grid-cols-2 gap-2">
                            {(['none', 'pressure', 'magnitude', 'vorticity'] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setHeatmap(m)}
                                    className={cn(
                                        "p-2.5 text-xs font-semibold rounded-xl border transition-all text-center",
                                        heatmap === m ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.15)]" : "bg-slate-900/50 border-white/5 text-slate-400 hover:bg-slate-800 hover:border-white/10"
                                    )}
                                >
                                    {m === 'none' ? 'Ninguno' : m === 'pressure' ? 'Presión' : m === 'magnitude' ? 'Magnitud' : 'Vorticidad'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Trazadores Físicos</div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button
                                onClick={() => setShowStreamlines(!showStreamlines)}
                                className={cn(
                                    "flex items-center justify-center gap-2 p-2.5 text-xs font-semibold rounded-xl border transition-all",
                                    showStreamlines ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.15)]" : "bg-slate-900/50 border-white/5 text-slate-400 hover:bg-slate-800 hover:border-white/10"
                                )}
                            >
                                <Wind size={14} /> Humo
                            </button>
                            <button
                                onClick={() => setShowParticles(!showParticles)}
                                className={cn(
                                    "flex items-center justify-center gap-2 p-2.5 text-xs font-semibold rounded-xl border transition-all",
                                    showParticles ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.15)]" : "bg-slate-900/50 border-white/5 text-slate-400 hover:bg-slate-800 hover:border-white/10"
                                )}
                            >
                                <Droplet size={14} /> Masa
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex bg-slate-900/60 rounded-lg p-1 border border-white/5">
                                {(['poco', 'normal', 'mucho'] as const).map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSmokeDensity(d)}
                                        disabled={!showStreamlines}
                                        className={cn(
                                            "flex-1 text-[9px] font-bold uppercase py-1 rounded transition-all",
                                            smokeDensity === d && showStreamlines ? "bg-slate-700 text-cyan-200" : "text-slate-500 hover:text-slate-300",
                                            !showStreamlines && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                            <div className="flex bg-slate-900/60 rounded-lg p-1 border border-white/5">
                                {(['poco', 'normal', 'mucho'] as const).map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setMassDensity(d)}
                                        disabled={!showParticles}
                                        className={cn(
                                            "flex-1 text-[9px] font-bold uppercase py-1 rounded transition-all",
                                            massDensity === d && showParticles ? "bg-slate-700 text-cyan-200" : "text-slate-500 hover:text-slate-300",
                                            !showParticles && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
