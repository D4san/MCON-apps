import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Activity,
    Beaker,
    Circle,
    Eye,
    Gauge,
    Layers,
    Pause,
    Play,
    RefreshCw,
    Settings,
    Waves,
    X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useIsPortrait } from "../../hooks/useIsPortrait";

type PrimitiveId = "uniform" | "vortex" | "rotation" | "shear" | "source" | "dipole";
type SceneId = "open" | "cylinder" | "venturi" | "bucket";
type TabId = "fields" | "objects" | "diagnostics";

interface Vec2 {
    x: number;
    y: number;
}

interface Domain {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

interface FlowSample {
    u: number;
    v: number;
    insideSolid?: boolean;
}

interface Particle {
    x: number;
    y: number;
    history: Vec2[];
    age: number;
    seed: number;
}

interface PrimitiveState {
    active: boolean;
    strength: number;
}

interface FieldState {
    uniform: PrimitiveState;
    vortex: PrimitiveState;
    rotation: PrimitiveState;
    shear: PrimitiveState;
    source: PrimitiveState;
    dipole: PrimitiveState;
}

interface CylinderState {
    U: number;
    radius: number;
    rho: number;
}

interface VenturiState {
    U0: number;
    throat: number;
    rho: number;
}

interface BucketState {
    H: number;
    g: number;
    rho: number;
}

interface LayerState {
    vectors: boolean;
    particles: boolean;
    streamlines: boolean;
    psi: boolean;
    speed: boolean;
    vorticity: boolean;
    pressure: boolean;
    bernoulli: boolean;
}

interface FlowPrimitive {
    id: PrimitiveId;
    min: number;
    max: number;
    step: number;
}

interface SceneElement {
    id: SceneId;
    title: string;
    detail: (activeCount: number) => string;
}

const OPEN_DOMAIN: Domain = { xMin: -5, xMax: 5, yMin: -4, yMax: 4 };
const BUCKET_DOMAIN: Domain = { xMin: 0, xMax: 10, yMin: 0, yMax: 6 };
const CORE = 0.32;
const RHO_WATER = 1000;

const primitiveLabels: Record<PrimitiveId, { title: string; unit: string; description: string }> = {
    uniform: {
        title: "Corriente uniforme",
        unit: "U",
        description: "Campo base: todo el fluido avanza en la misma direccion.",
    },
    vortex: {
        title: "Vortice puntual regularizado",
        unit: "Gamma",
        description: "Agrega circulacion local; el nucleo esta suavizado para estabilidad visual.",
    },
    rotation: {
        title: "Rotacion rigida",
        unit: "Omega",
        description: "Todo gira como cuerpo rigido; omega_z = 2 Omega.",
    },
    shear: {
        title: "Cizalladura",
        unit: "k",
        description: "Capas con distinta velocidad horizontal.",
    },
    source: {
        title: "Fuente / sumidero",
        unit: "Q",
        description: "Mete o extrae caudal local; prende divergencia cerca del centro.",
    },
    dipole: {
        title: "Dipolo ideal",
        unit: "mu",
        description: "Correccion localizada de flujo potencial.",
    },
};

const initialFields: FieldState = {
    uniform: { active: true, strength: 1.2 },
    vortex: { active: false, strength: 3.2 },
    rotation: { active: false, strength: 0.45 },
    shear: { active: false, strength: 0.45 },
    source: { active: false, strength: 1.5 },
    dipole: { active: false, strength: 3.0 },
};

const initialLayers: LayerState = {
    vectors: true,
    particles: true,
    streamlines: false,
    psi: false,
    speed: false,
    vorticity: false,
    pressure: true,
    bernoulli: true,
};

const flowPrimitives: FlowPrimitive[] = [
    { id: "uniform", min: -3, max: 3, step: 0.05 },
    { id: "vortex", min: -6, max: 6, step: 0.05 },
    { id: "rotation", min: -6, max: 6, step: 0.05 },
    { id: "shear", min: -6, max: 6, step: 0.05 },
    { id: "source", min: -6, max: 6, step: 0.05 },
    { id: "dipole", min: -6, max: 6, step: 0.05 },
];

const sceneElements: SceneElement[] = [
    { id: "open", title: "Plano abierto", detail: (activeCount) => `${activeCount} campo(s) activo(s)` },
    { id: "cylinder", title: "Cilindro en corriente uniforme", detail: () => "funcion de corriente + no penetracion" },
    { id: "venturi", title: "Tubo / Venturi ideal", detail: () => "continuidad + Bernoulli 1D" },
    { id: "bucket", title: "Deposito con orificio", detail: () => "Torricelli + chorro balistico" },
];

const tabs: Array<{ id: TabId; label: string; icon: typeof Waves }> = [
    { id: "fields", label: "Campos", icon: Waves },
    { id: "objects", label: "Objetos", icon: Circle },
    { id: "diagnostics", label: "Diagnostico", icon: Gauge },
];

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function hypot(x: number, y: number) {
    return Math.sqrt(x * x + y * y);
}

function finite(value: number, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function samplePrimitive(id: PrimitiveId, x: number, y: number, strength: number): FlowSample {
    const r2 = x * x + y * y;
    const smooth = r2 + CORE * CORE;
    const twoPi = 2 * Math.PI;

    if (id === "uniform") {
        return { u: strength, v: 0 };
    }

    if (id === "vortex") {
        const c = strength / twoPi;
        return {
            u: -c * y / smooth,
            v: c * x / smooth,
        };
    }

    if (id === "rotation") {
        return {
            u: -strength * y,
            v: strength * x,
        };
    }

    if (id === "shear") {
        return {
            u: strength * y,
            v: 0,
        };
    }

    if (id === "source") {
        const c = strength / twoPi;
        return {
            u: c * x / smooth,
            v: c * y / smooth,
        };
    }

    const c = strength / twoPi;
    const denom = smooth * smooth;
    return {
        u: c * (smooth - 2 * x * x) / denom,
        v: c * (-2 * x * y) / denom,
    };
}

function primitivePsi(id: PrimitiveId, x: number, y: number, strength: number) {
    const r2 = x * x + y * y;
    const smooth = r2 + CORE * CORE;

    if (id === "uniform") return strength * y;
    if (id === "vortex") return (strength / (4 * Math.PI)) * Math.log(smooth);
    if (id === "rotation") return -0.5 * strength * r2;
    if (id === "shear") return 0.5 * strength * y * y;
    if (id === "source") return (strength / (2 * Math.PI)) * Math.atan2(y, x);
    return -(strength / (2 * Math.PI)) * y / smooth;
}

function sampleOpenField(fields: FieldState, x: number, y: number): FlowSample {
    let u = 0;
    let v = 0;
    flowPrimitives.forEach(({ id: key }) => {
        const primitive = fields[key];
        if (!primitive.active) return;
        const sample = samplePrimitive(key, x, y, primitive.strength);
        u += sample.u;
        v += sample.v;
    });
    return { u: finite(u), v: finite(v) };
}

function psiOpen(fields: FieldState, x: number, y: number) {
    let psi = 0;
    flowPrimitives.forEach(({ id: key }) => {
        const primitive = fields[key];
        if (primitive.active) psi += primitivePsi(key, x, y, primitive.strength);
    });
    return finite(psi);
}

function sampleCylinder(state: CylinderState, x: number, y: number): FlowSample {
    const r = hypot(x, y);
    if (r <= state.radius) return { u: 0, v: 0, insideSolid: true };
    const phi = Math.atan2(y, x);
    const ratio = (state.radius * state.radius) / (r * r);
    const vr = state.U * (1 - ratio) * Math.cos(phi);
    const vphi = -state.U * (1 + ratio) * Math.sin(phi);

    return {
        u: finite(vr * Math.cos(phi) - vphi * Math.sin(phi)),
        v: finite(vr * Math.sin(phi) + vphi * Math.cos(phi)),
    };
}

function psiCylinder(state: CylinderState, x: number, y: number) {
    const r = hypot(x, y);
    if (r <= state.radius) return 0;
    const phi = Math.atan2(y, x);
    return state.U * (r - (state.radius * state.radius) / r) * Math.sin(phi);
}

function pressureCylinder(state: CylinderState, x: number, y: number) {
    const sample = sampleCylinder(state, x, y);
    if (sample.insideSolid) return 0;
    const speed2 = sample.u * sample.u + sample.v * sample.v;
    return 0.5 * state.rho * (state.U * state.U - speed2);
}

function venturiHalfHeight(state: VenturiState, x: number) {
    const base = 1.35;
    const throat = clamp(state.throat, 0.32, 0.92);
    const constriction = 1 - (1 - throat) * Math.exp(-x * x / 3.1);
    return base * constriction;
}

function sampleVenturi(state: VenturiState, x: number, y: number): FlowSample {
    const half = venturiHalfHeight(state, x);
    if (Math.abs(y) > half) return { u: 0, v: 0, insideSolid: true };
    const areaRatio = half / 1.35;
    const u = state.U0 / Math.max(0.25, areaRatio);
    return { u, v: 0 };
}

function pressureVenturi(state: VenturiState, x: number, y: number) {
    const sample = sampleVenturi(state, x, y);
    if (sample.insideSolid) return 0;
    const speed2 = sample.u * sample.u;
    return 0.5 * state.rho * (state.U0 * state.U0 - speed2);
}

function primitiveVorticity(id: PrimitiveId, x: number, y: number, strength: number) {
    if (id === "rotation") return 2 * strength;
    if (id === "shear") return -strength;
    if (id === "vortex") {
        const smooth = x * x + y * y + CORE * CORE;
        return (strength / Math.PI) * (CORE * CORE) / (smooth * smooth);
    }
    return 0;
}

function vorticityOpen(fields: FieldState, x: number, y: number) {
    return finite(
        flowPrimitives.reduce((omega, { id }) => (
            fields[id].active ? omega + primitiveVorticity(id, x, y, fields[id].strength) : omega
        ), 0),
    );
}

function sampleSceneVelocity(
    scene: SceneId,
    fields: FieldState,
    cylinder: CylinderState,
    venturi: VenturiState,
    x: number,
    y: number,
) {
    if (scene === "cylinder") return sampleCylinder(cylinder, x, y);
    if (scene === "venturi") return sampleVenturi(venturi, x, y);
    if (scene === "bucket") return { u: 0, v: 0 };
    return sampleOpenField(fields, x, y);
}

function sampleScalar(
    kind: "speed" | "vorticity" | "pressure" | "psi",
    scene: SceneId,
    fields: FieldState,
    cylinder: CylinderState,
    venturi: VenturiState,
    x: number,
    y: number,
) {
    if (kind === "psi") {
        if (scene === "cylinder") return psiCylinder(cylinder, x, y);
        if (scene === "open") return psiOpen(fields, x, y);
        return 0;
    }

    if (kind === "pressure") {
        if (scene === "cylinder") return pressureCylinder(cylinder, x, y);
        if (scene === "venturi") return pressureVenturi(venturi, x, y);
        if (scene === "open" && pressureIsGlobal(fields)) {
            const sample = sampleOpenField(fields, x, y);
            const speed2 = sample.u * sample.u + sample.v * sample.v;
            const ref = fields.uniform.active ? fields.uniform.strength * fields.uniform.strength : 0;
            return 0.5 * RHO_WATER * (ref - speed2);
        }
        return 0;
    }

    if (kind === "vorticity") {
        if (scene === "open") return vorticityOpen(fields, x, y);
        if (scene === "cylinder") return sampleCylinder(cylinder, x, y).insideSolid ? 0 : 0;
        if (scene === "venturi") return sampleVenturi(venturi, x, y).insideSolid ? 0 : 0;
        return 0;
    }

    const sample = sampleSceneVelocity(scene, fields, cylinder, venturi, x, y);
    if (sample.insideSolid) return 0;
    if (kind === "speed") return hypot(sample.u, sample.v);
    return 0;
}

function divergenceAt(
    scene: SceneId,
    fields: FieldState,
    cylinder: CylinderState,
    venturi: VenturiState,
    x: number,
    y: number,
) {
    const h = 0.025;
    const uxRight = sampleSceneVelocity(scene, fields, cylinder, venturi, x + h, y).u;
    const uxLeft = sampleSceneVelocity(scene, fields, cylinder, venturi, x - h, y).u;
    const vyUp = sampleSceneVelocity(scene, fields, cylinder, venturi, x, y + h).v;
    const vyDown = sampleSceneVelocity(scene, fields, cylinder, venturi, x, y - h).v;
    return finite((uxRight - uxLeft) / (2 * h) + (vyUp - vyDown) / (2 * h));
}

function pressureIsGlobal(fields: FieldState) {
    const forbidden: PrimitiveId[] = ["rotation", "shear", "vortex"];
    return forbidden.every((key) => !fields[key].active);
}

function worldToCanvas(x: number, y: number, domain: Domain, width: number, height: number) {
    return {
        px: ((x - domain.xMin) / (domain.xMax - domain.xMin)) * width,
        py: ((domain.yMax - y) / (domain.yMax - domain.yMin)) * height,
    };
}

function canvasToWorld(px: number, py: number, domain: Domain, width: number, height: number) {
    return {
        x: domain.xMin + (px / width) * (domain.xMax - domain.xMin),
        y: domain.yMax - (py / height) * (domain.yMax - domain.yMin),
    };
}

function createParticles(domain: Domain, count: number): Particle[] {
    return Array.from({ length: count }, (_, index) => ({
        x: domain.xMin + Math.random() * (domain.xMax - domain.xMin),
        y: domain.yMin + Math.random() * (domain.yMax - domain.yMin),
        history: [],
        age: Math.random() * 2,
        seed: index,
    }));
}

function colorMap(value: number, min: number, max: number, palette: "speed" | "signed" | "pressure") {
    const t = clamp((value - min) / Math.max(1e-9, max - min), 0, 1);

    if (palette === "signed") {
        if (t < 0.5) {
            const f = t * 2;
            return `rgba(${Math.round(20 + 60 * f)}, ${Math.round(120 + 90 * f)}, 255, 0.42)`;
        }
        const f = (t - 0.5) * 2;
        return `rgba(255, ${Math.round(210 - 125 * f)}, ${Math.round(190 - 145 * f)}, 0.44)`;
    }

    if (palette === "pressure") {
        return `rgba(${Math.round(60 + 150 * t)}, ${Math.round(70 + 20 * t)}, ${Math.round(150 + 80 * (1 - t))}, 0.38)`;
    }

    return `rgba(${Math.round(30 + 230 * t)}, ${Math.round(170 + 70 * (1 - Math.abs(t - 0.55)))}, ${Math.round(205 - 140 * t)}, 0.38)`;
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, color: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-length * 0.45, 0);
    ctx.lineTo(length * 0.45, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(length * 0.45, 0);
    ctx.lineTo(length * 0.25, -4);
    ctx.lineTo(length * 0.25, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function SliderControl({
    label,
    value,
    min,
    max,
    step,
    onChange,
    suffix,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    suffix?: string;
}) {
    return (
        <label className="block rounded-lg border border-white/10 bg-slate-950/55 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-300">{label}</span>
                <span className="font-mono text-cyan-300">
                    {value.toFixed(step < 0.1 ? 2 : 1)}
                    {suffix || ""}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400"
            />
        </label>
    );
}

function ToggleButton({
    active,
    onClick,
    title,
    detail,
    disabled,
}: {
    active: boolean;
    onClick: () => void;
    title: string;
    detail?: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "w-full rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70",
                active
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
                    : "border-white/10 bg-slate-950/55 text-slate-300 hover:border-white/20 hover:bg-slate-800/80",
                disabled && "cursor-not-allowed opacity-45 hover:border-white/10 hover:bg-slate-950/55",
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold">{title}</span>
                <span className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-cyan-300" : "bg-slate-600")} />
            </div>
            {detail && <p className="mt-1 text-[11px] leading-snug text-slate-400">{detail}</p>}
        </button>
    );
}

function drawGrid(ctx: CanvasRenderingContext2D, domain: Domain, width: number, height: number) {
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.09)";
    ctx.lineWidth = 1;
    const xStart = Math.ceil(domain.xMin);
    const xEnd = Math.floor(domain.xMax);
    const yStart = Math.ceil(domain.yMin);
    const yEnd = Math.floor(domain.yMax);
    ctx.beginPath();
    for (let x = xStart; x <= xEnd; x += 1) {
        const a = worldToCanvas(x, domain.yMin, domain, width, height);
        const b = worldToCanvas(x, domain.yMax, domain, width, height);
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
    }
    for (let y = yStart; y <= yEnd; y += 1) {
        const a = worldToCanvas(domain.xMin, y, domain, width, height);
        const b = worldToCanvas(domain.xMax, y, domain, width, height);
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(226, 232, 240, 0.18)";
    ctx.beginPath();
    if (domain.yMin < 0 && domain.yMax > 0) {
        const a = worldToCanvas(domain.xMin, 0, domain, width, height);
        const b = worldToCanvas(domain.xMax, 0, domain, width, height);
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
    }
    if (domain.xMin < 0 && domain.xMax > 0) {
        const a = worldToCanvas(0, domain.yMin, domain, width, height);
        const b = worldToCanvas(0, domain.yMax, domain, width, height);
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
    }
    ctx.stroke();
    ctx.restore();
}

function drawHeatmap(
    ctx: CanvasRenderingContext2D,
    domain: Domain,
    width: number,
    height: number,
    scalar: (x: number, y: number) => number,
    palette: "speed" | "signed" | "pressure",
) {
    const cols = 74;
    const rows = 54;
    const values: number[] = [];
    let min = Infinity;
    let max = -Infinity;
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const x = domain.xMin + ((col + 0.5) / cols) * (domain.xMax - domain.xMin);
            const y = domain.yMin + ((row + 0.5) / rows) * (domain.yMax - domain.yMin);
            const value = finite(scalar(x, y));
            values.push(value);
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
    }

    if (palette === "signed") {
        const abs = Math.max(Math.abs(min), Math.abs(max), 0.1);
        min = -abs;
        max = abs;
    }

    if (palette === "pressure") {
        const abs = Math.max(Math.abs(min), Math.abs(max), 1);
        min = -abs;
        max = abs;
    }

    const cellW = width / cols;
    const cellH = height / rows;
    ctx.save();
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            ctx.fillStyle = colorMap(values[row * cols + col], min, max, palette);
            ctx.fillRect(col * cellW, row * cellH, cellW + 1, cellH + 1);
        }
    }
    ctx.restore();
}

function drawContours(
    ctx: CanvasRenderingContext2D,
    domain: Domain,
    width: number,
    height: number,
    scalar: (x: number, y: number) => number,
    color: string,
) {
    const cols = 58;
    const rows = 44;
    const values: number[][] = [];
    let min = Infinity;
    let max = -Infinity;

    for (let row = 0; row <= rows; row += 1) {
        values[row] = [];
        for (let col = 0; col <= cols; col += 1) {
            const x = domain.xMin + (col / cols) * (domain.xMax - domain.xMin);
            const y = domain.yMin + (row / rows) * (domain.yMax - domain.yMin);
            const value = finite(scalar(x, y));
            values[row][col] = value;
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
    }

    if (Math.abs(max - min) < 1e-6) return;

    const levels = 18;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.72;

    for (let li = 1; li < levels; li += 1) {
        const level = min + (li / levels) * (max - min);
        for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
                const cell = [
                    { col, row, v: values[row][col] },
                    { col: col + 1, row, v: values[row][col + 1] },
                    { col: col + 1, row: row + 1, v: values[row + 1][col + 1] },
                    { col, row: row + 1, v: values[row + 1][col] },
                ];
                const intersections: Vec2[] = [];

                for (let edge = 0; edge < 4; edge += 1) {
                    const a = cell[edge];
                    const b = cell[(edge + 1) % 4];
                    if ((a.v < level && b.v >= level) || (a.v >= level && b.v < level)) {
                        const t = (level - a.v) / (b.v - a.v);
                        const gx = a.col + (b.col - a.col) * t;
                        const gy = a.row + (b.row - a.row) * t;
                        intersections.push({
                            x: (gx / cols) * width,
                            y: (gy / rows) * height,
                        });
                    }
                }

                if (intersections.length === 2) {
                    ctx.beginPath();
                    ctx.moveTo(intersections[0].x, intersections[0].y);
                    ctx.lineTo(intersections[1].x, intersections[1].y);
                    ctx.stroke();
                } else if (intersections.length === 4) {
                    ctx.beginPath();
                    ctx.moveTo(intersections[0].x, intersections[0].y);
                    ctx.lineTo(intersections[1].x, intersections[1].y);
                    ctx.moveTo(intersections[2].x, intersections[2].y);
                    ctx.lineTo(intersections[3].x, intersections[3].y);
                    ctx.stroke();
                }
            }
        }
    }
    ctx.restore();
}

function drawVectorField(
    ctx: CanvasRenderingContext2D,
    domain: Domain,
    width: number,
    height: number,
    velocity: (x: number, y: number) => FlowSample,
) {
    const cols = 21;
    const rows = 15;
    let maxMag = 0;
    const samples: Array<{ x: number; y: number; u: number; v: number; mag: number }> = [];

    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const x = domain.xMin + ((col + 0.5) / cols) * (domain.xMax - domain.xMin);
            const y = domain.yMin + ((row + 0.5) / rows) * (domain.yMax - domain.yMin);
            const sample = velocity(x, y);
            if (sample.insideSolid) continue;
            const mag = hypot(sample.u, sample.v);
            maxMag = Math.max(maxMag, mag);
            samples.push({ x, y, u: sample.u, v: sample.v, mag });
        }
    }

    samples.forEach((sample) => {
        if (sample.mag < 0.01) return;
        const p = worldToCanvas(sample.x, sample.y, domain, width, height);
        const length = 9 + 18 * Math.min(1, sample.mag / Math.max(maxMag, 1e-6));
        const angle = Math.atan2(-sample.v, sample.u);
        drawArrow(ctx, p.px, p.py, angle, length, "rgba(125, 211, 252, 0.68)");
    });
}

function drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    domain: Domain,
    width: number,
    height: number,
) {
    ctx.save();
    particles.forEach((particle) => {
        if (particle.history.length > 2) {
            ctx.beginPath();
            particle.history.forEach((point, index) => {
                const p = worldToCanvas(point.x, point.y, domain, width, height);
                if (index === 0) ctx.moveTo(p.px, p.py);
                else ctx.lineTo(p.px, p.py);
            });
            ctx.strokeStyle = "rgba(34, 211, 238, 0.28)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        const p = worldToCanvas(particle.x, particle.y, domain, width, height);
        ctx.fillStyle = "rgba(103, 232, 249, 0.92)";
        ctx.beginPath();
        ctx.arc(p.px, p.py, 1.9, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawCylinderOverlay(
    ctx: CanvasRenderingContext2D,
    state: CylinderState,
    domain: Domain,
    width: number,
    height: number,
) {
    const center = worldToCanvas(0, 0, domain, width, height);
    const edge = worldToCanvas(state.radius, 0, domain, width, height);
    const radiusPx = Math.abs(edge.px - center.px);
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = "rgba(226, 232, 240, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.px, center.py, radiusPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(248, 250, 252, 0.35)";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(center.px, center.py, radiusPx + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    [
        { x: -state.radius, y: 0 },
        { x: state.radius, y: 0 },
    ].forEach((point) => {
        const p = worldToCanvas(point.x, point.y, domain, width, height);
        ctx.fillStyle = "#f8fafc";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.px, p.py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore();
}

function drawVenturiOverlay(
    ctx: CanvasRenderingContext2D,
    state: VenturiState,
    domain: Domain,
    width: number,
    height: number,
) {
    ctx.save();
    ctx.strokeStyle = "rgba(226, 232, 240, 0.78)";
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.lineWidth = 2.5;
    const pointsTop: Vec2[] = [];
    const pointsBottom: Vec2[] = [];
    for (let i = 0; i <= 100; i += 1) {
        const x = domain.xMin + (i / 100) * (domain.xMax - domain.xMin);
        const half = venturiHalfHeight(state, x);
        pointsTop.push({ x, y: half });
        pointsBottom.push({ x, y: -half });
    }
    ctx.beginPath();
    pointsTop.forEach((point, index) => {
        const p = worldToCanvas(point.x, point.y, domain, width, height);
        if (index === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
    });
    [...pointsBottom].reverse().forEach((point) => {
        const p = worldToCanvas(point.x, point.y, domain, width, height);
        ctx.lineTo(p.px, p.py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const throat = worldToCanvas(0, 0, domain, width, height);
    const pTop = worldToCanvas(0, venturiHalfHeight(state, 0), domain, width, height);
    const pBottom = worldToCanvas(0, -venturiHalfHeight(state, 0), domain, width, height);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(throat.px, pTop.py);
    ctx.lineTo(throat.px, pBottom.py);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("garganta", throat.px + 8, pTop.py - 8);
    ctx.restore();
}

function drawBucketScene(
    ctx: CanvasRenderingContext2D,
    state: BucketState,
    layers: LayerState,
    domain: Domain,
    width: number,
    height: number,
    time: number,
) {
    const tank = { x: 0.95, y: 0.7, w: 3.1, h: 4.7 };
    const waterTop = tank.y + clamp(state.H, 0.8, 4.3);
    const orifice = { x: tank.x + tank.w, y: tank.y + 0.62 };
    const v0 = Math.sqrt(2 * state.g * state.H);
    const scaleX = 0.26;
    const scaleY = 0.26;

    const toCanvas = (x: number, y: number) => worldToCanvas(x, y, domain, width, height);
    ctx.save();
    drawGrid(ctx, domain, width, height);

    const tankBottom = toCanvas(tank.x, tank.y);
    const tankTop = toCanvas(tank.x + tank.w, tank.y + tank.h);
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.strokeStyle = "rgba(226, 232, 240, 0.78)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(tankBottom.px, tankTop.py, tankTop.px - tankBottom.px, tankBottom.py - tankTop.py);

    const waterA = toCanvas(tank.x + 0.05, tank.y);
    const waterB = toCanvas(tank.x + tank.w - 0.05, waterTop);
    const gradient = ctx.createLinearGradient(0, waterB.py, 0, waterA.py);
    gradient.addColorStop(0, "rgba(14, 165, 233, 0.72)");
    gradient.addColorStop(1, "rgba(14, 165, 233, 0.22)");
    ctx.fillStyle = gradient;
    ctx.fillRect(waterA.px, waterB.py, waterB.px - waterA.px, waterA.py - waterB.py);

    if (layers.pressure) {
        const bands = 9;
        for (let i = 0; i < bands; i += 1) {
            const y0 = waterTop - (i / bands) * (waterTop - tank.y);
            const y1 = waterTop - ((i + 1) / bands) * (waterTop - tank.y);
            const depth = (i + 0.5) / bands;
            const a = toCanvas(tank.x + 0.07, y1);
            const b = toCanvas(tank.x + tank.w - 0.07, y0);
            ctx.fillStyle = `rgba(14, 116, 144, ${0.06 + depth * 0.18})`;
            ctx.fillRect(a.px, b.py, b.px - a.px, a.py - b.py);
        }
    }

    ctx.strokeStyle = "rgba(125, 211, 252, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const surfaceL = toCanvas(tank.x + 0.08, waterTop);
    const surfaceR = toCanvas(tank.x + tank.w - 0.08, waterTop);
    ctx.moveTo(surfaceL.px, surfaceL.py);
    for (let i = 0; i <= 28; i += 1) {
        const x = surfaceL.px + (i / 28) * (surfaceR.px - surfaceL.px);
        const y = surfaceL.py + Math.sin(i * 0.9 + time * 2.5) * 2.5;
        ctx.lineTo(x, y);
    }
    ctx.stroke();

    const outlet = toCanvas(orifice.x, orifice.y);
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(outlet.px, outlet.py, 5, 0, Math.PI * 2);
    ctx.fill();

    if (layers.bernoulli) {
        ctx.strokeStyle = "rgba(16, 185, 129, 0.85)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        const headTop = toCanvas(orifice.x + 0.22, waterTop);
        const headBottom = toCanvas(orifice.x + 0.22, orifice.y);
        ctx.moveTo(headTop.px, headTop.py);
        ctx.lineTo(headBottom.px, headBottom.py);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (layers.streamlines) {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.94)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        let first = true;
        const tStart = (time * 0.7) % 0.45;
        for (let i = 0; i <= 90; i += 1) {
            const tau = i / 14 + tStart;
            const x = orifice.x + v0 * tau * scaleX;
            const y = orifice.y - 0.5 * state.g * tau * tau * scaleY;
            if (y < 0.25 || x > domain.xMax - 0.2) break;
            const p = toCanvas(x, y);
            if (first) {
                ctx.moveTo(p.px, p.py);
                first = false;
            } else {
                ctx.lineTo(p.px, p.py);
            }
        }
        ctx.stroke();
    }

    if (layers.vectors) {
        const arrowStart = toCanvas(orifice.x + 0.12, orifice.y);
        const arrowEnd = toCanvas(orifice.x + 1.25, orifice.y);
        ctx.strokeStyle = "rgba(250, 204, 21, 0.88)";
        ctx.fillStyle = "rgba(250, 204, 21, 0.88)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(arrowStart.px, arrowStart.py);
        ctx.lineTo(arrowEnd.px, arrowEnd.py);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(arrowEnd.px, arrowEnd.py);
        ctx.lineTo(arrowEnd.px - 10, arrowEnd.py - 5);
        ctx.lineTo(arrowEnd.px - 10, arrowEnd.py + 5);
        ctx.closePath();
        ctx.fill();
    }

    if (layers.particles) {
        for (let i = 0; i < 16; i += 1) {
            const tau = ((time * 0.9 + i * 0.16) % 2.4) + 0.05;
            const x = orifice.x + v0 * tau * scaleX;
            const y = orifice.y - 0.5 * state.g * tau * tau * scaleY;
            if (y < 0.2 || x > domain.xMax) continue;
            const p = toCanvas(x, y);
            ctx.fillStyle = "rgba(103, 232, 249, 0.9)";
            ctx.beginPath();
            ctx.arc(p.px, p.py, 2.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (layers.bernoulli) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
        ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
        ctx.lineWidth = 1;
        const noteX = Math.max(18, width - 315);
        const noteY = 24;
        ctx.fillRect(noteX, noteY, 285, 92);
        ctx.strokeRect(noteX, noteY, 285, 92);
        ctx.fillStyle = "#d1fae5";
        ctx.font = "bold 13px ui-sans-serif, system-ui";
        ctx.fillText("Bernoulli entre superficie y salida", noteX + 14, noteY + 24);
        ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(`v0 = sqrt(2 g H) = ${v0.toFixed(2)} m/s`, noteX + 14, noteY + 49);
        ctx.fillText(`altura equivalente hmax = H = ${state.H.toFixed(2)} m`, noteX + 14, noteY + 71);
    }

    ctx.restore();
}

function drawBernoulliOverlay(
    ctx: CanvasRenderingContext2D,
    scene: SceneId,
    fields: FieldState,
    cylinder: CylinderState,
    venturi: VenturiState,
    domain: Domain,
    width: number,
    height: number,
) {
    const w = Math.min(420, width - 36);
    const x = Math.max(18, width - w - 18);
    const y = 24;
    const h = scene === "open" && !pressureIsGlobal(fields) ? 104 : 86;
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
    ctx.strokeStyle = "rgba(16, 185, 129, 0.42)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#bbf7d0";
    ctx.font = "bold 13px ui-sans-serif, system-ui";
    ctx.fillText("Lectura de Bernoulli", x + 14, y + 24);
    ctx.fillStyle = "#67e8f9";
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";

    if (scene === "venturi") {
        const throatU = venturi.U0 / venturi.throat;
        ctx.fillText("Q = A U", x + 14, y + 49);
        ctx.fillText(`p + 1/2 rho U^2 = cte, U_g = ${throatU.toFixed(2)} m/s`, x + 14, y + 70);
    } else if (scene === "cylinder") {
        const sample = sampleCylinder(cylinder, 0, cylinder.radius + 0.03);
        const cp = sample.insideSolid ? 0 : 1 - (hypot(sample.u, sample.v) ** 2) / (cylinder.U * cylinder.U);
        ctx.fillText("H = p/rho + |v|^2/2", x + 14, y + 49);
        ctx.fillText(`modelo potencial: omega = 0,  Cp_superior ~ ${cp.toFixed(2)}`, x + 14, y + 70);
    } else if (pressureIsGlobal(fields)) {
        const center = canvasToWorld(width * 0.62, height * 0.48, domain, width, height);
        const sample = sampleOpenField(fields, center.x, center.y);
        ctx.fillText("H = p/rho + |v|^2/2", x + 14, y + 49);
        ctx.fillText(`campo irrotacional activo: |v| ~ ${hypot(sample.u, sample.v).toFixed(2)}`, x + 14, y + 70);
    } else {
        ctx.fillText("∇H = v × ω", x + 14, y + 49);
        ctx.fillStyle = "#fde68a";
        ctx.font = "12px ui-sans-serif, system-ui";
        ctx.fillText("Hay vorticidad: Bernoulli se lee por línea, no como mapa global.", x + 14, y + 74);
        ctx.fillText("Activa Presión solo cuando el modelo permita una constante global.", x + 14, y + 93);
    }
    ctx.restore();
}

function getSceneDomain(scene: SceneId): Domain {
    return scene === "bucket" ? BUCKET_DOMAIN : OPEN_DOMAIN;
}

function defaultProbeForScene(scene: SceneId): Vec2 | null {
    if (scene === "bucket") return null;
    if (scene === "venturi") return { x: -2, y: 0 };
    return { x: 1.8, y: 0.8 };
}

function getConceptLine(scene: SceneId, fields: FieldState) {
    if (scene === "bucket") {
        return "No resolvimos todo el interior; usamos Bernoulli entre superficie libre y salida.";
    }
    if (scene === "venturi") {
        return "Continuidad fija la velocidad; Bernoulli traduce ese cambio en presion.";
    }
    if (scene === "cylinder") {
        return "La funcion de corriente ajusta el flujo hasta convertir la pared en linea de corriente.";
    }
    if (!pressureIsGlobal(fields)) {
        return "Con vorticidad encendida, Bernoulli puede leerse por linea, pero ya no como constante global.";
    }
    return "Primero se construye el campo; despues se pregunta que energia y presion puede leer Bernoulli.";
}

function sceneEquation(scene: SceneId, fields: FieldState, cylinder: CylinderState, venturi: VenturiState, bucket: BucketState) {
    if (scene === "bucket") {
        const v0 = Math.sqrt(2 * bucket.g * bucket.H);
        return `v0 = √(2gH) = ${v0.toFixed(2)} m/s`;
    }
    if (scene === "venturi") {
        const throatU = venturi.U0 / venturi.throat;
        return `Q = AU · p + ½ρU² = cte · U_garganta ≈ ${throatU.toFixed(2)} m/s`;
    }
    if (scene === "cylinder") {
        return `ψ = U(r − a²/r) sin φ · a = ${cylinder.radius.toFixed(2)} · vᵣ(a,φ)=0`;
    }
    const active = flowPrimitives.map(({ id }) => id).filter((key) => fields[key].active);
    if (!active.length) return "v(x,y) = 0";
    return active.map((key) => primitiveLabels[key].title).join(" + ");
}

export default function EulerFlowTable() {
    const [fields, setFields] = useState<FieldState>(initialFields);
    const [layers, setLayers] = useState<LayerState>(initialLayers);
    const [scene, setScene] = useState<SceneId>("open");
    const [activeTab, setActiveTab] = useState<TabId>("fields");
    const [isPlaying, setIsPlaying] = useState(true);
    const [boardMode, setBoardMode] = useState(false);
    const [panelOpen, setPanelOpen] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= window.innerHeight));
    const [time, setTime] = useState(0);
    const [cylinder, setCylinder] = useState<CylinderState>({ U: 1.4, radius: 1.05, rho: RHO_WATER });
    const [venturi, setVenturi] = useState<VenturiState>({ U0: 1.3, throat: 0.5, rho: RHO_WATER });
    const [bucket, setBucket] = useState<BucketState>({ H: 2.4, g: 9.81, rho: RHO_WATER });
    const [probe, setProbe] = useState<Vec2 | null>({ x: 1.8, y: 0.8 });
    const [canvasSize, setCanvasSize] = useState({ width: 900, height: 620 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<number | null>(null);
    const lastTickRef = useRef<number | null>(null);
    const lastUiTimeRef = useRef(0);
    const particlesRef = useRef<Particle[]>(createParticles(OPEN_DOMAIN, 360));
    const stateRef = useRef({ fields, layers, scene, isPlaying, time, cylinder, venturi, bucket });
    const isPortrait = useIsPortrait();

    useEffect(() => {
        stateRef.current = { fields, layers, scene, isPlaying, time, cylinder, venturi, bucket };
    }, [fields, layers, scene, isPlaying, time, cylinder, venturi, bucket]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resize = () => {
            const rect = container.getBoundingClientRect();
            setCanvasSize({
                width: Math.max(420, Math.floor(rect.width)),
                height: Math.max(320, Math.floor(rect.height)),
            });
        };

        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const domain = getSceneDomain(scene);

    const resetParticles = useCallback((targetScene: SceneId) => {
        particlesRef.current = createParticles(getSceneDomain(targetScene), targetScene === "venturi" ? 180 : 360);
    }, []);

    const selectScene = useCallback((targetScene: SceneId) => {
        setScene(targetScene);
        resetParticles(targetScene);
        setProbe(defaultProbeForScene(targetScene));
    }, [resetParticles]);

    const updateField = useCallback((id: PrimitiveId, patch: Partial<PrimitiveState>) => {
        setFields((prev) => ({
            ...prev,
            [id]: { ...prev[id], ...patch },
        }));
    }, []);

    const toggleLayer = useCallback((key: keyof LayerState) => {
        setLayers((prev) => {
            const nextValue = !prev[key];
            const next = { ...prev, [key]: nextValue };
            if (nextValue && (key === "speed" || key === "pressure" || key === "vorticity")) {
                next.speed = key === "speed";
                next.pressure = key === "pressure";
                next.vorticity = key === "vorticity";
            }
            return next;
        });
    }, []);

    const activePressure = scene === "cylinder" || scene === "venturi" || (scene === "open" && pressureIsGlobal(fields));
    const pressureLayerAvailable = activePressure || scene === "bucket";
    const psiAvailable = scene === "open" || scene === "cylinder";
    const vorticityNote = useMemo(() => {
        if (scene === "cylinder" || scene === "venturi") return "omega_z ~ 0 en el modelo ideal elegido.";
        if (scene === "bucket") return "La escena usa Bernoulli 1D; el campo 2D interior no se resuelve.";
        const hasRot = fields.rotation.active;
        const hasShear = fields.shear.active;
        const hasVortex = fields.vortex.active;
        if (hasRot) return `omega_z = 2 Omega = ${(2 * fields.rotation.strength).toFixed(2)}`;
        if (hasShear) return `omega_z = -k = ${(-fields.shear.strength).toFixed(2)}`;
        if (hasVortex) return "omega_z se concentra en el nucleo regularizado del vortice.";
        return "omega_z ~ 0: Bernoulli global puede tener sentido si no hay fuentes.";
    }, [scene, fields]);

    const draw = useCallback((now: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const { fields: currentFields, layers: currentLayers, scene: currentScene, isPlaying: playing } = stateRef.current;
        const currentCylinder = stateRef.current.cylinder;
        const currentVenturi = stateRef.current.venturi;
        const currentBucket = stateRef.current.bucket;
        const currentDomain = getSceneDomain(currentScene);
        const width = canvas.width;
        const height = canvas.height;
        const last = lastTickRef.current ?? now;
        const frameDt = clamp((now - last) / 1000, 0, 0.045);
        lastTickRef.current = now;
        const localTime = stateRef.current.time + (playing ? frameDt : 0);
        if (playing) {
            stateRef.current.time = localTime;
            if (Math.abs(localTime - lastUiTimeRef.current) > 0.05) {
                lastUiTimeRef.current = localTime;
                setTime(localTime);
            }
        }

        ctx.clearRect(0, 0, width, height);
        const bg = ctx.createLinearGradient(0, 0, width, height);
        bg.addColorStop(0, "#07111f");
        bg.addColorStop(0.45, "#0f172a");
        bg.addColorStop(1, "#030712");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        const velocity = (x: number, y: number) =>
            sampleSceneVelocity(currentScene, currentFields, currentCylinder, currentVenturi, x, y);

        if (currentScene === "bucket") {
            drawBucketScene(ctx, currentBucket, currentLayers, currentDomain, width, height, localTime);
        } else {
            if (currentLayers.speed) {
                drawHeatmap(ctx, currentDomain, width, height, (x, y) => sampleScalar("speed", currentScene, currentFields, currentCylinder, currentVenturi, x, y), "speed");
            }
            if (currentLayers.vorticity) {
                drawHeatmap(ctx, currentDomain, width, height, (x, y) => sampleScalar("vorticity", currentScene, currentFields, currentCylinder, currentVenturi, x, y), "signed");
            }
            if (currentLayers.pressure) {
                drawHeatmap(ctx, currentDomain, width, height, (x, y) => sampleScalar("pressure", currentScene, currentFields, currentCylinder, currentVenturi, x, y), "pressure");
            }

            drawGrid(ctx, currentDomain, width, height);

            if (currentLayers.psi && (currentScene === "open" || currentScene === "cylinder")) {
                drawContours(ctx, currentDomain, width, height, (x, y) => sampleScalar("psi", currentScene, currentFields, currentCylinder, currentVenturi, x, y), "rgba(196, 181, 253, 0.72)");
            }
            if (currentLayers.vectors) drawVectorField(ctx, currentDomain, width, height, velocity);

            if (currentScene === "cylinder") drawCylinderOverlay(ctx, currentCylinder, currentDomain, width, height);
            if (currentScene === "venturi") drawVenturiOverlay(ctx, currentVenturi, currentDomain, width, height);

            if (currentLayers.particles && playing) {
                const dt = Math.min(0.025, frameDt);
                const subSteps = Math.max(1, Math.ceil(dt / 0.012));
                const stepDt = dt / subSteps;
                particlesRef.current.forEach((particle) => {
                    for (let step = 0; step < subSteps; step += 1) {
                        const v1 = velocity(particle.x, particle.y);
                        const mag1 = hypot(v1.u, v1.v);
                        if (v1.insideSolid || mag1 > 12) {
                            particle.x = currentDomain.xMin + Math.random() * (currentDomain.xMax - currentDomain.xMin);
                            particle.y = currentDomain.yMin + Math.random() * (currentDomain.yMax - currentDomain.yMin);
                            particle.history = [];
                            break;
                        }
                        const u1 = clamp(v1.u, -8, 8);
                        const vv1 = clamp(v1.v, -8, 8);
                        const midX = particle.x + u1 * stepDt * 0.5;
                        const midY = particle.y + vv1 * stepDt * 0.5;
                        const v2 = velocity(midX, midY);
                        particle.x += clamp(v2.u, -8, 8) * stepDt;
                        particle.y += clamp(v2.v, -8, 8) * stepDt;
                    }

                    particle.age += dt;
                    particle.history.push({ x: particle.x, y: particle.y });
                    if (particle.history.length > 34) particle.history.shift();

                    const out =
                        particle.x < currentDomain.xMin - 0.2 ||
                        particle.x > currentDomain.xMax + 0.2 ||
                        particle.y < currentDomain.yMin - 0.2 ||
                        particle.y > currentDomain.yMax + 0.2 ||
                        particle.age > 8;

                    if (out) {
                        if (currentScene === "venturi") {
                            particle.x = currentDomain.xMin + 0.3;
                            particle.y = (Math.random() - 0.5) * venturiHalfHeight(currentVenturi, currentDomain.xMin + 0.3) * 1.4;
                        } else {
                            particle.x = currentDomain.xMin + Math.random() * (currentDomain.xMax - currentDomain.xMin);
                            particle.y = currentDomain.yMin + Math.random() * (currentDomain.yMax - currentDomain.yMin);
                        }
                        particle.history = [];
                        particle.age = Math.random() * 1.5;
                    }
                });
            }

            if (currentLayers.particles) drawParticles(ctx, particlesRef.current, currentDomain, width, height);
            if (currentLayers.bernoulli) {
                drawBernoulliOverlay(ctx, currentScene, currentFields, currentCylinder, currentVenturi, currentDomain, width, height);
            }
        }

        if (probe && currentScene !== "bucket") {
            const p = worldToCanvas(probe.x, probe.y, currentDomain, width, height);
            const sample = velocity(probe.x, probe.y);
            if (!sample.insideSolid) {
                ctx.save();
                ctx.strokeStyle = "rgba(250, 204, 21, 0.95)";
                ctx.fillStyle = "rgba(250, 204, 21, 0.18)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.px, p.py, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = "rgba(254, 240, 138, 0.95)";
                ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
                ctx.fillText("|v| " + hypot(sample.u, sample.v).toFixed(2), p.px + 13, p.py - 12);
                ctx.restore();
            }
        }

        if (boardMode) {
            ctx.save();
            ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
            ctx.fillRect(18, height - 94, Math.min(width - 36, 720), 70);
            ctx.strokeStyle = "rgba(34, 211, 238, 0.35)";
            ctx.strokeRect(18, height - 94, Math.min(width - 36, 720), 70);
            ctx.fillStyle = "#e0f2fe";
            ctx.font = "bold 15px ui-sans-serif, system-ui";
            ctx.fillText(getConceptLine(currentScene, currentFields), 34, height - 54);
            ctx.fillStyle = "#67e8f9";
            ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
            ctx.fillText(sceneEquation(currentScene, currentFields, currentCylinder, currentVenturi, currentBucket), 34, height - 31);
            ctx.restore();
        }

    }, [boardMode, probe]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = canvasSize.width;
            canvas.height = canvasSize.height;
        }
    }, [canvasSize]);

    useEffect(() => {
        let active = true;
        const loop = (now: number) => {
            if (!active) return;
            draw(now);
            frameRef.current = requestAnimationFrame(loop);
        };

        frameRef.current = requestAnimationFrame(loop);
        return () => {
            active = false;
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [draw]);

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (scene === "bucket") return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const px = (event.clientX - rect.left) * (canvas.width / rect.width);
        const py = (event.clientY - rect.top) * (canvas.height / rect.height);
        setProbe(canvasToWorld(px, py, domain, canvas.width, canvas.height));
    };

    const activeCount = flowPrimitives.filter(({ id }) => fields[id].active).length;
    const probeSample = probe && scene !== "bucket"
        ? sampleSceneVelocity(scene, fields, cylinder, venturi, probe.x, probe.y)
        : null;
    const probeSpeed = probeSample && !probeSample.insideSolid ? hypot(probeSample.u, probeSample.v) : 0;
    const probeOmega = probe ? sampleScalar("vorticity", scene, fields, cylinder, venturi, probe.x, probe.y) : 0;
    const probeDiv = probe ? divergenceAt(scene, fields, cylinder, venturi, probe.x, probe.y) : 0;
    const bucketV0 = Math.sqrt(2 * bucket.g * bucket.H);
    const cylinderNoPenetration = Math.abs(sampleCylinder(cylinder, cylinder.radius, 0).u);
    const throatSpeed = venturi.U0 / venturi.throat;

    const PanelContent = (
        <div className="flex h-full min-h-0 flex-col bg-slate-900/95">
            <div className="border-b border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-white">Tablero de Flujo Ideal de Euler</h1>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-cyan-300">sandbox analitico</p>
                    </div>
                    {isPortrait && (
                        <button type="button" onClick={() => setPanelOpen(false)} className="rounded-lg bg-slate-800 p-2 text-slate-300">
                            <X size={18} />
                        </button>
                    )}
                </div>

                <div className="relative z-10 mt-4 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-slate-950/70 p-1">
                    {tabs.map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            aria-pressed={activeTab === item.id}
                            data-tab={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-colors",
                                activeTab === item.id ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-white",
                            )}
                        >
                            <item.icon size={14} />
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === "fields" && (
                    <div className="space-y-3">
                        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
                            Estas piezas se combinan en plano abierto. Al activar una escena de objeto, el tablero usa su modelo ideal propio.
                        </div>
                        {flowPrimitives.map(({ id: key, min, max, step }) => (
                            <div key={key} className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                                <ToggleButton
                                    active={fields[key].active}
                                    title={primitiveLabels[key].title}
                                    detail={primitiveLabels[key].description}
                                    onClick={() => {
                                        if (scene !== "open") selectScene("open");
                                        updateField(key, { active: !fields[key].active });
                                        resetParticles("open");
                                    }}
                                />
                                <div className="mt-3">
                                    <SliderControl
                                        label={primitiveLabels[key].unit}
                                        min={min}
                                        max={max}
                                        step={step}
                                        value={fields[key].strength}
                                        onChange={(value) => {
                                            updateField(key, { strength: value });
                                            resetParticles("open");
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === "objects" && (
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            {sceneElements.map((item) => (
                                <ToggleButton
                                    key={item.id}
                                    active={scene === item.id}
                                    title={item.title}
                                    detail={item.detail(activeCount)}
                                    onClick={() => selectScene(item.id as SceneId)}
                                />
                            ))}
                        </div>

                        {scene === "cylinder" && (
                            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                                <SliderControl label="U" value={cylinder.U} min={0.2} max={3.2} step={0.05} onChange={(U) => setCylinder((prev) => ({ ...prev, U }))} />
                                <SliderControl label="radio a" value={cylinder.radius} min={0.45} max={1.8} step={0.05} onChange={(radius) => setCylinder((prev) => ({ ...prev, radius }))} />
                                <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-100">
                                    Verificacion: |v_r(a,0)| = {cylinderNoPenetration.toExponential(1)}. La pared queda como linea de corriente.
                                </div>
                            </div>
                        )}

                        {scene === "venturi" && (
                            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                                <SliderControl label="U entrada" value={venturi.U0} min={0.4} max={3} step={0.05} onChange={(U0) => setVenturi((prev) => ({ ...prev, U0 }))} />
                                <SliderControl label="A garganta / A0" value={venturi.throat} min={0.34} max={0.9} step={0.01} onChange={(throat) => setVenturi((prev) => ({ ...prev, throat }))} />
                                <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-100">
                                    U garganta ~ {throatSpeed.toFixed(2)} m/s; al estrechar, baja la presion estatica.
                                </div>
                            </div>
                        )}

                        {scene === "bucket" && (
                            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                                <SliderControl label="altura H" value={bucket.H} min={0.6} max={4.2} step={0.05} suffix=" m" onChange={(H) => setBucket((prev) => ({ ...prev, H }))} />
                                <SliderControl label="gravedad g" value={bucket.g} min={1.6} max={24.8} step={0.01} suffix=" m/s2" onChange={(g) => setBucket((prev) => ({ ...prev, g }))} />
                                <SliderControl label="densidad rho" value={bucket.rho} min={600} max={1400} step={10} suffix=" kg/m3" onChange={(rho) => setBucket((prev) => ({ ...prev, rho }))} />
                                <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-100">
                                    v0 = {bucketV0.toFixed(2)} m/s. La densidad se cancela en Torricelli si ambos puntos estan a presion atmosferica.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "diagnostics" && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                ["vectors", "Velocidad", "flechas"],
                                ["particles", "Particulas", "trayectorias"],
                                ["psi", "psi", "contornos"],
                                ["speed", "Rapidez", "mapa"],
                                ["vorticity", "Vorticidad", "omega_z"],
                                ["pressure", "Presion", "relativa"],
                                ["bernoulli", "Bernoulli", "lectura"],
                            ].map(([key, title, detail]) => {
                                const disabled = (key === "pressure" && !pressureLayerAvailable) || (key === "psi" && !psiAvailable);
                                return (
                                    <ToggleButton
                                        key={key}
                                        active={layers[key as keyof LayerState] && !disabled}
                                        disabled={disabled}
                                        title={title}
                                        detail={disabled ? "no aplica aqui" : detail}
                                        onClick={() => toggleLayer(key as keyof LayerState)}
                                    />
                                );
                            })}
                        </div>

                        <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/55 p-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                <Activity size={16} className="text-cyan-300" />
                                Lectura local
                            </div>
                            {scene === "bucket" ? (
                                <div className="grid gap-2 text-xs text-slate-300">
                                    <div className="flex justify-between"><span>v0</span><span className="font-mono text-cyan-300">{bucketV0.toFixed(2)} m/s</span></div>
                                    <div className="flex justify-between"><span>hmax ideal</span><span className="font-mono text-emerald-300">{bucket.H.toFixed(2)} m</span></div>
                                    <p className="leading-relaxed text-slate-400">{getConceptLine(scene, fields)}</p>
                                </div>
                            ) : (
                                <div className="grid gap-2 text-xs text-slate-300">
                                    <div className="flex justify-between"><span>|v| en sonda</span><span className="font-mono text-cyan-300">{probeSpeed.toFixed(3)}</span></div>
                                    <div className="flex justify-between"><span>div v</span><span className="font-mono text-amber-300">{probeDiv.toFixed(3)}</span></div>
                                    <div className="flex justify-between"><span>omega_z</span><span className="font-mono text-rose-300">{probeOmega.toFixed(3)}</span></div>
                                    <p className="leading-relaxed text-slate-400">Haz clic en el lienzo para mover la sonda.</p>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs leading-relaxed text-emerald-100">
                            <strong className="text-emerald-200">Bernoulli:</strong>{" "}
                            {scene === "open" && !activePressure
                                ? "la capa global queda deshabilitada porque hay vorticidad apreciable."
                                : "las capas activas respetan las hipotesis del modelo ideal seleccionado."}
                        </div>
                        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">
                            {vorticityNote}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#05070d] text-slate-200">
            {isPortrait && (
                <button
                    type="button"
                    onClick={() => setPanelOpen(true)}
                    className="fixed bottom-4 right-4 z-50 rounded-full bg-cyan-500 p-3 text-slate-950 shadow-xl shadow-cyan-950/40"
                    aria-label="Abrir panel"
                >
                    <Settings size={22} />
                </button>
            )}

            {!boardMode && (!isPortrait || panelOpen) && (
                <aside
                    className={cn(
                        "z-30 flex-shrink-0 border-r border-white/10 shadow-2xl shadow-black/30",
                        isPortrait ? "fixed inset-x-0 bottom-0 top-16 max-h-[calc(100dvh-4rem)]" : "w-[370px]",
                    )}
                >
                    {PanelContent}
                </aside>
            )}

            {isPortrait && panelOpen && !boardMode && (
                <div className="fixed inset-0 z-20 bg-black/40" onClick={() => setPanelOpen(false)} />
            )}

            <main className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur md:px-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-bold text-white">
                            <Beaker size={18} className="text-cyan-300" />
                            <span className="min-w-0 whitespace-normal leading-snug">{sceneEquation(scene, fields, cylinder, venturi, bucket)}</span>
                        </div>
                        <p className="mt-0.5 max-w-4xl truncate text-xs text-slate-400">{getConceptLine(scene, fields)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsPlaying((prev) => !prev)}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
                        >
                            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                            {isPlaying ? "Pausar" : "Simular"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                lastUiTimeRef.current = 0;
                                stateRef.current.time = 0;
                                setTime(0);
                                resetParticles(scene);
                            }}
                            className="rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800"
                            aria-label="Reiniciar"
                        >
                            <RefreshCw size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setBoardMode((prev) => !prev)}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold",
                                boardMode ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200" : "border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800",
                            )}
                        >
                            <Eye size={15} />
                            Modo tablero
                        </button>
                    </div>
                </div>

                <div ref={containerRef} className="relative min-h-0 flex-1">
                    <canvas
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        className="block h-full w-full cursor-crosshair"
                    />
                    <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-slate-950/70 p-3 backdrop-blur">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                            <Layers size={14} />
                            {scene === "open" ? "campos combinables" : scene}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
                            <span>t = <b className="font-mono text-slate-100">{time.toFixed(1)} s</b></span>
                            <span>{activeCount} piezas</span>
                            <span>{layers.pressure && pressureLayerAvailable ? "presion activa" : "presion limitada"}</span>
                            <span>{layers.vorticity ? "omega visible" : "omega oculto"}</span>
                        </div>
                    </div>

                    {!activePressure && layers.pressure && scene === "open" && (
                        <div className="pointer-events-none absolute bottom-4 left-4 max-w-sm rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100 backdrop-blur">
                            Presion global deshabilitada: la combinacion actual tiene vorticidad apreciable. Puedes leer energia por lineas, pero no imponer una unica constante global.
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
