import { useEffect, useMemo, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";
import {
    CircleDot,
    Eye,
    Gauge,
    Layers,
    RefreshCw,
    Sigma,
    SlidersHorizontal,
    Waves,
} from "lucide-react";

type BodyKind = "cylinder" | "sphere";
type LayerKind = "streamlines" | "vectors" | "pressure" | "speed";

interface DerivationStep {
    title: string;
    idea: string;
    math: string;
    note: string;
}

interface Vec2 {
    x: number;
    y: number;
}

interface FlowSample extends Vec2 {
    speed: number;
    pressureCoeff: number;
    inside: boolean;
}

const domain = {
    xMin: -3.4,
    xMax: 3.4,
    yMin: -2.55,
    yMax: 2.55,
};

const bodyCopy: Record<BodyKind, {
    title: string;
    short: string;
    psi: string;
    vr: string;
    vt: string;
    correction: string;
    wall: string;
}> = {
    cylinder: {
        title: "Cilindro en corriente uniforme",
        short: "2D: curvas de nivel de psi son lineas de corriente.",
        psi: String.raw`\psi=U r\sin\phi\left(1-\frac{a^2}{r^2}\right)`,
        vr: String.raw`v_r=U\left(1-\frac{a^2}{r^2}\right)\cos\phi`,
        vt: String.raw`v_\phi=-U\left(1+\frac{a^2}{r^2}\right)\sin\phi`,
        correction: String.raw`\left(Ar+\frac{B}{r}\right)\sin\phi`,
        wall: String.raw`\psi(a,\phi)=0 \Rightarrow v_r(a,\phi)=0`,
    },
    sphere: {
        title: "Esfera en corriente uniforme",
        short: "Axisimetrico: la vista muestra un corte meridional.",
        psi: String.raw`\psi=\frac12 U r^2\sin^2\theta\left(1-\frac{a^3}{r^3}\right)`,
        vr: String.raw`v_r=U\left(1-\frac{a^3}{r^3}\right)\cos\theta`,
        vt: String.raw`v_\theta=-U\left(1+\frac{a^3}{2r^3}\right)\sin\theta`,
        correction: String.raw`\frac12 U\left(r^2-\frac{a^3}{r}\right)\sin^2\theta`,
        wall: String.raw`\psi(a,\theta)=0 \Rightarrow v_r(a,\theta)=0`,
    },
};

const lessonSteps = [
    {
        label: "1",
        title: "Definir psi",
        text: "Se introduce psi para que la continuidad ya venga incorporada en el campo.",
        math: String.raw`\nabla\cdot\mathbf v=0`,
    },
    {
        label: "2",
        title: "Elegir familia",
        text: "Se busca la forma armonica compatible con la simetria del flujo uniforme.",
        math: String.raw`\nabla^2\psi=0`,
    },
    {
        label: "3",
        title: "Fijar la pared",
        text: "La constante se determina haciendo que r=a sea una linea de corriente.",
        math: String.raw`\psi(a,\cdot)=0`,
    },
    {
        label: "4",
        title: "Derivar velocidad",
        text: "Solo al final se calculan las componentes y se verifica que no hay penetracion.",
        math: String.raw`v_r(a,\cdot)=0`,
    },
];

const derivationSteps: Record<BodyKind, DerivationStep[]> = {
    cylinder: [
        {
            title: "1. Corriente uniforme sin cilindro",
            idea: "Primero se escribe la funcion de corriente del flujo que se quiere recuperar lejos del obstaculo.",
            math: String.raw`\psi_U=U r\sin\phi`,
            note: "Al derivarla se obtiene v_r=U cos phi y v_phi=-U sin phi: una corriente uniforme hacia x.",
        },
        {
            title: "2. La forma admisible no se adivina",
            idea: "Fuera del cilindro el flujo es ideal e irrotacional, asi que psi debe ser armonica. Con simetria sin phi, la familia separable es unica en esta escala.",
            math: String.raw`\psi(r,\phi)=\left(A r+\frac{B}{r}\right)\sin\phi`,
            note: "El termino Ar sin phi es la corriente uniforme; el termino B/r sin phi es la correccion que se apaga cuando r crece.",
        },
        {
            title: "3. Igualar el comportamiento lejano",
            idea: "Como lejos del cilindro debe quedar psi_U, se fija A=U. La unica libertad que queda es B.",
            math: String.raw`\psi=\left(U r+\frac{B}{r}\right)\sin\phi`,
            note: "Esta es la forma mas general que conserva la simetria, respeta Laplace y no altera el flujo lejano.",
        },
        {
            title: "4. Convertir la pared en linea de corriente",
            idea: "La pared del cilindro es r=a. Si toda esa circunferencia tiene el mismo valor de psi, el flujo no la atraviesa.",
            math: String.raw`\psi(a,\phi)=\left(Ua+\frac{B}{a}\right)\sin\phi=0`,
            note: "Para que valga para todo phi se necesita Ua+B/a=0, por tanto B=-Ua^2.",
        },
        {
            title: "5. Resultado construido",
            idea: "La formula final ya no es una receta: es corriente uniforme mas la unica correccion que vuelve impermeable la frontera.",
            math: String.raw`\boxed{\psi=Ur\sin\phi\left(1-\frac{a^2}{r^2}\right)}`,
            note: "Al derivar, v_r=U(1-a^2/r^2)cos phi, luego v_r(a,phi)=0.",
        },
    ],
    sphere: [
        {
            title: "1. Corriente uniforme axisimetrica",
            idea: "En una esfera se usa la funcion de Stokes para flujo axisimetrico. Lejos del cuerpo debe representar una corriente uniforme en el eje polar.",
            math: String.raw`\psi_U=\frac12 U r^2\sin^2\theta`,
            note: "Con esta convencion, v_r=U cos theta y v_theta=-U sin theta.",
        },
        {
            title: "2. La simetria cambia la familia radial",
            idea: "La variable angular ya no es sin phi, sino sin^2 theta. La solucion exterior que combina flujo uniforme y perturbacion decreciente toma otra potencia radial.",
            math: String.raw`\psi=\frac12 U\left(r^2+\frac{B}{r}\right)\sin^2\theta`,
            note: "El termino r^2 da la corriente uniforme; el termino B/r es la perturbacion dipolar axisimetrica.",
        },
        {
            title: "3. La constante se fija con la pared",
            idea: "La superficie solida es r=a. Se exige que esa esfera sea una superficie de corriente.",
            math: String.raw`\psi(a,\theta)=\frac12U\left(a^2+\frac{B}{a}\right)\sin^2\theta=0`,
            note: "Para todo theta debe cumplirse a^2+B/a=0, de modo que B=-a^3.",
        },
        {
            title: "4. Resultado construido",
            idea: "La potencia a^3/r^3 aparece por imponer la impermeabilidad de una frontera esferica, no por memoria algebraica.",
            math: String.raw`\boxed{\psi=\frac12Ur^2\sin^2\theta\left(1-\frac{a^3}{r^3}\right)}`,
            note: "Al derivar, v_r=U(1-a^3/r^3)cos theta, luego v_r(a,theta)=0.",
        },
        {
            title: "5. Comparacion con el cilindro",
            idea: "La diferencia entre a^2/r^2 y a^3/r^3 viene de la geometria: 2D polar contra flujo axisimetrico 3D.",
            math: String.raw`\text{cilindro: } B=-Ua^2,\qquad \text{esfera: } B=-a^3`,
            note: "La logica pedagogica es la misma: flujo lejano + correccion decreciente + pared como superficie de corriente.",
        },
    ],
};

const consultationBlocks = [
    {
        title: "Pregunta guia",
        body: "Como se construye un campo de velocidades que rodea una frontera solida sin atravesarla, y que al mismo tiempo se parezca a una corriente uniforme lejos del cuerpo?",
    },
    {
        title: "Idea que debe sobrevivir",
        body: "La funcion de corriente no es una formula magica: es una forma de codificar continuidad y de convertir una pared impermeable en una linea o superficie de corriente.",
    },
    {
        title: "Chequeo minimo",
        body: "Al final siempre se debe verificar el limite lejano y la condicion de no penetracion: v_r(a)=0. Sin esos dos chequeos, la deduccion queda incompleta.",
    },
];

const commonMistakes = [
    "Creer que Bernoulli produce la funcion de corriente. Bernoulli entra despues de construir el campo.",
    "Imponer velocidad tangencial cero en un fluido ideal. Aqui se impone no penetracion, no no-deslizamiento.",
    "Memorizar a^2/r^2 y a^3/r^3 sin ver que salen de la geometria y de la condicion psi(a)=constante.",
    "Olvidar que cilindro es un problema plano y esfera es axisimetrico: por eso las potencias radiales cambian.",
];

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function math(markup: string, displayMode = false) {
    return {
        __html: katex.renderToString(markup, {
            displayMode,
            throwOnError: false,
            strict: false,
        }),
    };
}

function sampleFlow(kind: BodyKind, x: number, y: number, U: number, a: number): FlowSample {
    const r2 = x * x + y * y;
    const r = Math.sqrt(r2);
    if (r <= a) {
        return { x: 0, y: 0, speed: 0, pressureCoeff: 0, inside: true };
    }

    const cos = x / r;
    const sin = y / r;
    let vr = 0;
    let vt = 0;

    if (kind === "cylinder") {
        const ratio = (a * a) / r2;
        vr = U * (1 - ratio) * cos;
        vt = -U * (1 + ratio) * sin;
    } else {
        const ratio = (a * a * a) / (r * r * r);
        vr = U * (1 - ratio) * cos;
        vt = -U * (1 + ratio / 2) * sin;
    }

    const vx = vr * cos - vt * sin;
    const vy = vr * sin + vt * cos;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const pressureCoeff = 1 - (speed * speed) / Math.max(U * U, 0.0001);
    return { x: vx, y: vy, speed, pressureCoeff, inside: false };
}

function streamFunction(kind: BodyKind, x: number, y: number, U: number, a: number) {
    const r = Math.sqrt(x * x + y * y);
    if (r <= a) return 0;
    if (kind === "cylinder") {
        return U * y * (1 - (a * a) / (r * r));
    }
    const signedTransverse = y * Math.abs(y);
    return 0.5 * U * signedTransverse * (1 - (a * a * a) / (r * r * r));
}

function drawArrow(ctx: CanvasRenderingContext2D, from: Vec2, to: Vec2, color: string) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - 6 * Math.cos(angle - Math.PI / 6), to.y - 6 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(to.x - 6 * Math.cos(angle + Math.PI / 6), to.y - 6 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function colorRamp(value: number, layer: LayerKind) {
    const t = clamp(value, 0, 1);
    if (layer === "pressure") {
        const r = Math.round(lerp(34, 248, t));
        const g = Math.round(lerp(211, 113, t));
        const b = Math.round(lerp(238, 113, t));
        return `rgba(${r}, ${g}, ${b}, 0.45)`;
    }

    const r = Math.round(lerp(15, 56, t));
    const g = Math.round(lerp(118, 189, t));
    const b = Math.round(lerp(110, 248, t));
    return `rgba(${r}, ${g}, ${b}, 0.42)`;
}

function StreamFunctionExplainer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [kind, setKind] = useState<BodyKind>("cylinder");
    const [U, setU] = useState(1.15);
    const [radius, setRadius] = useState(0.82);
    const [activeLayer, setActiveLayer] = useState<LayerKind>("streamlines");
    const [showVectors, setShowVectors] = useState(true);
    const [showPressure, setShowPressure] = useState(true);
    const [selectedStep, setSelectedStep] = useState(0);

    const copy = bodyCopy[kind];
    const steps = derivationSteps[kind];
    const currentStep = steps[selectedStep] ?? steps[0];
    const surfaceSpeed = kind === "cylinder" ? 2 * U : 1.5 * U;
    const surfaceCp = 1 - (surfaceSpeed * surfaceSpeed) / (U * U);

    function focusStep(index: number) {
        setSelectedStep(index);
        setShowVectors(index >= 3);
        setShowPressure(index >= 4);
        setActiveLayer(index >= 4 ? "pressure" : "streamlines");
    }

    const stats = useMemo(() => {
        const front = sampleFlow(kind, -radius, 0, U, radius);
        const top = sampleFlow(kind, 0, radius * 1.002, U, radius);
        const far = sampleFlow(kind, domain.xMax, 0, U, radius);
        return [
            { label: "Lejos", value: `${far.speed.toFixed(2)} U`, detail: "recupera corriente uniforme" },
            { label: "Pared", value: `${Math.abs(front.x).toFixed(2)}`, detail: "normal nula en el punto de frente" },
            { label: "Tangencial", value: `${surfaceSpeed.toFixed(2)}`, detail: `max ideal aprox.; Cp=${surfaceCp.toFixed(2)}` },
            { label: "Cima", value: `${top.speed.toFixed(2)}`, detail: "la pared no exige no-deslizamiento" },
        ];
    }, [kind, radius, U, surfaceCp, surfaceSpeed]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const pixelRatio = window.devicePixelRatio || 1;
        const cssWidth = canvas.clientWidth || 960;
        const cssHeight = canvas.clientHeight || 560;
        canvas.width = Math.floor(cssWidth * pixelRatio);
        canvas.height = Math.floor(cssHeight * pixelRatio);
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const w = cssWidth;
        const h = cssHeight;
        const sx = w / (domain.xMax - domain.xMin);
        const sy = h / (domain.yMax - domain.yMin);
        const toScreen = (x: number, y: number) => ({
            x: (x - domain.xMin) * sx,
            y: h - (y - domain.yMin) * sy,
        });

        ctx.clearRect(0, 0, w, h);
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, "#05111e");
        gradient.addColorStop(0.55, "#0b1b2c");
        gradient.addColorStop(1, "#10172b");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        const grid = 84;
        const cellW = w / grid;
        const cellH = h / Math.round(grid * h / w);
        const rows = Math.ceil(h / cellH);
        for (let i = 0; i < grid; i += 1) {
            for (let j = 0; j < rows; j += 1) {
                const x = lerp(domain.xMin, domain.xMax, (i + 0.5) / grid);
                const y = lerp(domain.yMax, domain.yMin, (j + 0.5) / rows);
                const sample = sampleFlow(kind, x, y, U, radius);
                if (sample.inside) continue;
                if (activeLayer === "pressure" || showPressure) {
                    const normalized = clamp((sample.pressureCoeff + 2.2) / 3.8, 0, 1);
                    ctx.fillStyle = colorRamp(normalized, "pressure");
                } else {
                    const normalized = clamp(sample.speed / (2.2 * U), 0, 1);
                    ctx.fillStyle = colorRamp(normalized, "speed");
                }
                ctx.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
            }
        }

        ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
        ctx.lineWidth = 1;
        for (let x = Math.ceil(domain.xMin); x <= domain.xMax; x += 1) {
            const p1 = toScreen(x, domain.yMin);
            const p2 = toScreen(x, domain.yMax);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
        for (let y = Math.ceil(domain.yMin); y <= domain.yMax; y += 1) {
            const p1 = toScreen(domain.xMin, y);
            const p2 = toScreen(domain.xMax, y);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        const seeds = Array.from({ length: 25 }, (_, index) => lerp(domain.yMin + 0.2, domain.yMax - 0.2, index / 24));
        seeds.forEach((seedY, index) => {
            let x = domain.xMin + 0.04;
            let y = seedY;
            ctx.beginPath();
            const start = toScreen(x, y);
            ctx.moveTo(start.x, start.y);
            let visible = true;
            for (let step = 0; step < 660; step += 1) {
                const sample = sampleFlow(kind, x, y, U, radius);
                if (sample.inside || !Number.isFinite(sample.x) || !Number.isFinite(sample.y)) {
                    visible = false;
                    break;
                }
                const speed = Math.max(sample.speed, 0.08);
                const ds = 0.024;
                x += (sample.x / speed) * ds;
                y += (sample.y / speed) * ds;
                if (x > domain.xMax || y < domain.yMin || y > domain.yMax) break;
                const p = toScreen(x, y);
                ctx.lineTo(p.x, p.y);
            }
            const alpha = visible ? 0.25 + 0.45 * (index / seeds.length) : 0.22;
            ctx.strokeStyle = `rgba(226, 232, 240, ${alpha})`;
            ctx.lineWidth = index % 4 === 0 ? 1.55 : 1.0;
            ctx.stroke();
        });

        if (activeLayer === "streamlines") {
            const levels = [-1.6, -1.1, -0.7, -0.35, 0.35, 0.7, 1.1, 1.6].map((v) => v * U);
            levels.forEach((level) => {
                ctx.strokeStyle = level > 0 ? "rgba(45, 212, 191, 0.38)" : "rgba(96, 165, 250, 0.36)";
                ctx.lineWidth = 1;
                for (let y = domain.yMin; y <= domain.yMax; y += 0.04) {
                    let previous: Vec2 | null = null;
                    for (let x = domain.xMin; x <= domain.xMax; x += 0.04) {
                        const psi = streamFunction(kind, x, y, U, radius);
                        if (Math.abs(psi - level) < 0.018 * U) {
                            const p = toScreen(x, y);
                            if (!previous || Math.hypot(p.x - previous.x, p.y - previous.y) > 9) {
                                ctx.beginPath();
                                ctx.moveTo(p.x, p.y);
                            } else {
                                ctx.lineTo(p.x, p.y);
                                ctx.stroke();
                            }
                            previous = p;
                        }
                    }
                }
            });
        }

        if (showVectors) {
            for (let x = domain.xMin + 0.35; x <= domain.xMax - 0.2; x += 0.55) {
                for (let y = domain.yMin + 0.35; y <= domain.yMax - 0.2; y += 0.55) {
                    const sample = sampleFlow(kind, x, y, U, radius);
                    if (sample.inside || sample.speed < 0.04) continue;
                    const p = toScreen(x, y);
                    const scale = 0.09 / Math.max(sample.speed, 0.2);
                    const q = toScreen(x + sample.x * scale, y + sample.y * scale);
                    drawArrow(ctx, p, q, "rgba(186, 230, 253, 0.55)");
                }
            }
        }

        const center = toScreen(0, 0);
        const rPx = radius * sx;
        ctx.save();
        ctx.beginPath();
        ctx.arc(center.x, center.y, rPx, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
        ctx.stroke();

        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
        ctx.beginPath();
        ctx.arc(center.x, center.y, rPx + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        const front = toScreen(-radius, 0);
        const back = toScreen(radius, 0);
        ctx.fillStyle = "rgba(248, 250, 252, 0.9)";
        [front, back].forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.font = "12px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(226,232,240,0.86)";
        ctx.fillText("v_r=0", front.x - 20, front.y - 13);
        ctx.fillText("v_r=0", back.x - 12, back.y - 13);
        ctx.restore();

        const arrowStart = toScreen(domain.xMin + 0.25, domain.yMax - 0.28);
        const arrowEnd = toScreen(domain.xMin + 1.18, domain.yMax - 0.28);
        drawArrow(ctx, arrowStart, arrowEnd, "rgba(34, 211, 238, 0.9)");
        ctx.font = "600 13px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
        ctx.fillText(`U=${U.toFixed(2)}`, arrowEnd.x + 9, arrowEnd.y + 4);
        const active = derivationSteps[kind][selectedStep] ?? derivationSteps[kind][0];
        const boxX = Math.max(16, w - 270);
        ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
        ctx.strokeStyle = "rgba(34, 211, 238, 0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX, 16, 252, 68, 8);
        ctx.fill();
        ctx.stroke();
        ctx.font = "700 11px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(103, 232, 249, 0.95)";
        ctx.fillText(`PASO ${selectedStep + 1}`, boxX + 14, 38);
        ctx.font = "600 12px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
        ctx.fillText(active.title.replace(/^[0-9]+\\.\\s*/, "").slice(0, 34), boxX + 14, 62);
    }, [U, activeLayer, kind, radius, selectedStep, showPressure, showVectors]);

    return (
        <article className="h-full overflow-y-auto custom-scrollbar bg-slate-950/30">
            <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[0.9fr_1.4fr] lg:px-8 lg:py-8">
                <div className="flex flex-col justify-center">
                    <div className="mb-5 flex items-center gap-3 text-cyan-200">
                        <Waves className="h-6 w-6" />
                        <span className="text-sm font-semibold uppercase tracking-[0.18em]">MCON · taller de flujo ideal</span>
                    </div>
                    <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
                        Deducir la funcion de corriente alrededor de un cilindro y una esfera
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                        La clase no empieza memorizando la formula final. Empieza preguntando que forma puede tener
                        <span className="text-cyan-200"> psi</span>, que condicion impone la pared y por que aparece
                        exactamente la correccion que cancela la velocidad normal.
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        {lessonSteps.map((step) => (
                            <div key={step.label} className="rounded-lg border border-white/10 bg-slate-900/62 p-4">
                                <div className="mb-2 flex items-center gap-3">
                                    <span className="grid h-7 w-7 place-items-center rounded-full bg-cyan-400 text-sm font-black text-slate-950">
                                        {step.label}
                                    </span>
                                    <h2 className="text-sm font-bold text-white">{step.title}</h2>
                                </div>
                                <p className="min-h-12 text-sm leading-6 text-slate-300">{step.text}</p>
                                <div className="mt-3 overflow-x-auto rounded-md bg-slate-950/70 px-3 py-2 text-cyan-100">
                                    <span dangerouslySetInnerHTML={math(step.math)} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/70 p-3 shadow-2xl shadow-cyan-950/30">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
                        <div>
                            <h2 className="text-lg font-bold text-white">{copy.title}</h2>
                            <p className="text-sm text-slate-400">{copy.short}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setU(1.15);
                                setRadius(0.82);
                                setKind("cylinder");
                                setSelectedStep(0);
                                setActiveLayer("streamlines");
                                setShowVectors(true);
                                setShowPressure(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Reiniciar
                        </button>
                    </div>
                    <canvas
                        ref={canvasRef}
                        className="h-[410px] w-full rounded-md border border-white/10 bg-slate-950 md:h-[560px]"
                        aria-label="Visualizacion interactiva de funcion de corriente alrededor de un cuerpo solido"
                    />
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Esta figura es el chequeo geometrico de la deduccion: despues de fijar la constante, la
                        frontera amarilla queda como una linea o superficie de corriente y el flujo no la cruza.
                    </p>
                </div>
            </section>

            <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pb-8 sm:px-6 lg:grid-cols-[340px_1fr] lg:px-8">
                <aside className="rounded-lg border border-white/10 bg-slate-900/72 p-5">
                    <div className="mb-4 flex items-center gap-3">
                        <SlidersHorizontal className="h-5 w-5 text-cyan-300" />
                        <h2 className="text-lg font-bold text-white">Controles</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {(["cylinder", "sphere"] as BodyKind[]).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => {
                                    setKind(option);
                                    focusStep(0);
                                }}
                                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                                    kind === option
                                        ? "border-cyan-300 bg-cyan-300 text-slate-950"
                                        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                                }`}
                            >
                                {option === "cylinder" ? "Cilindro" : "Esfera"}
                            </button>
                        ))}
                    </div>

                    <label className="mt-5 block">
                        <span className="flex items-center justify-between text-sm font-semibold text-slate-200">
                            Velocidad U <span className="text-cyan-200">{U.toFixed(2)}</span>
                        </span>
                        <input
                            type="range"
                            min="0.45"
                            max="2.2"
                            step="0.05"
                            value={U}
                            onChange={(event) => setU(Number(event.target.value))}
                            className="mt-3 w-full accent-cyan-300"
                        />
                    </label>

                    <label className="mt-5 block">
                        <span className="flex items-center justify-between text-sm font-semibold text-slate-200">
                            Radio a <span className="text-cyan-200">{radius.toFixed(2)}</span>
                        </span>
                        <input
                            type="range"
                            min="0.48"
                            max="1.32"
                            step="0.02"
                            value={radius}
                            onChange={(event) => setRadius(Number(event.target.value))}
                            className="mt-3 w-full accent-amber-300"
                        />
                    </label>

                    <div className="mt-6">
                        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-200">
                            <Layers className="h-4 w-4 text-cyan-300" />
                            Lectura visual
                        </div>
                        <div className="grid gap-2">
                            {[
                                ["streamlines", "psi y lineas"],
                                ["speed", "rapidez"],
                                ["pressure", "presion ideal"],
                            ].map(([id, label]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setActiveLayer(id as LayerKind)}
                                    className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
                                        activeLayer === id
                                            ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-5 grid gap-2">
                        <label className="flex cursor-pointer items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                            <span>Vectores locales</span>
                            <input
                                type="checkbox"
                                checked={showVectors}
                                onChange={(event) => setShowVectors(event.target.checked)}
                                className="accent-cyan-300"
                            />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                            <span>Mapa de presion</span>
                            <input
                                type="checkbox"
                                checked={showPressure}
                                onChange={(event) => setShowPressure(event.target.checked)}
                                className="accent-cyan-300"
                            />
                        </label>
                    </div>

                    <div className="mt-6">
                        <div className="mb-3 text-sm font-bold text-slate-200">Pasos criticos</div>
                        <div className="grid gap-2">
                            {steps.map((step, index) => (
                                <button
                                    key={step.title}
                                    type="button"
                                    onClick={() => focusStep(index)}
                                    className={`rounded-md border px-3 py-2 text-left transition ${
                                        selectedStep === index
                                            ? "border-amber-300 bg-amber-300/15 text-amber-100"
                                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                    }`}
                                >
                                    <span className="block text-xs font-black uppercase tracking-[0.14em] text-current">
                                        Paso {index + 1}
                                    </span>
                                    <span className="mt-1 block text-sm font-semibold">
                                        {step.title.replace(/^[0-9]+\. /, "")}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                <div className="grid gap-6">
                    <section className="rounded-lg border border-white/10 bg-slate-900/68 p-5">
                        <div className="mb-4 flex items-center gap-3">
                            <Sigma className="h-5 w-5 text-cyan-300" />
                            <h2 className="text-xl font-bold text-white">Deduccion paso a paso: {kind === "cylinder" ? "cilindro" : "esfera"}</h2>
                        </div>
                        <p className="max-w-4xl text-sm leading-7 text-slate-300">
                            Cada paso critico es clicable. La formula activa, el comentario y la capa visual cambian
                            juntos para que la consulta reproduzca el razonamiento de clase: forma lejana, familia
                            admisible, condicion de pared y verificacion.
                        </p>
                        <div className="mt-5 grid gap-2 md:grid-cols-5">
                            {steps.map((step, index) => (
                                <button
                                    key={step.title}
                                    type="button"
                                    onClick={() => focusStep(index)}
                                    className={`rounded-md border p-3 text-left transition ${
                                        selectedStep === index
                                            ? "border-cyan-300 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30"
                                            : "border-white/10 bg-slate-950/62 text-slate-300 hover:bg-white/10"
                                    }`}
                                >
                                    <span className="block text-xs font-black uppercase tracking-[0.16em]">Paso {index + 1}</span>
                                    <span className="mt-2 block text-sm font-bold leading-5">
                                        {step.title.replace(/^[0-9]+\. /, "")}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="mt-5 grid gap-5 rounded-lg border border-cyan-300/20 bg-slate-950/70 p-5 lg:grid-cols-[0.86fr_1.14fr]">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                                    Paso activo {selectedStep + 1}
                                </p>
                                <h3 className="mt-2 text-2xl font-black leading-tight text-white">{currentStep.title}</h3>
                                <p className="mt-4 text-base leading-8 text-slate-300">{currentStep.idea}</p>
                                <div className="mt-5 rounded-md border border-white/10 bg-white/5 p-4">
                                    <p className="text-sm font-bold text-amber-200">Que debe mirar el estudiante</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-300">{currentStep.note}</p>
                                </div>
                            </div>
                            <div className="rounded-md border border-white/10 bg-slate-950 p-4">
                                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    Formula que se esta construyendo
                                </p>
                                <div className="overflow-x-auto text-cyan-50" dangerouslySetInnerHTML={math(currentStep.math, true)} />
                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-md bg-cyan-950/40 p-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">Control visual</p>
                                        <p className="mt-2 text-sm leading-6 text-slate-300">
                                            {selectedStep >= 4
                                                ? "Se activa la lectura de presion para mostrar que Bernoulli viene despues del campo."
                                                : "Se resaltan las lineas de corriente para mantener visible la geometria de psi."}
                                        </p>
                                    </div>
                                    <div className="rounded-md bg-amber-950/30 p-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-200">Chequeo</p>
                                        <p className="mt-2 text-sm leading-6 text-slate-300">
                                            {selectedStep >= 3
                                                ? "La pared debe quedar como psi constante y por eso v_r(a)=0."
                                                : "Aun no se impone la pared; todavia se esta armando la familia posible."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <details className="mt-5 rounded-lg border border-white/10 bg-slate-950/45 p-4">
                            <summary className="cursor-pointer text-sm font-bold text-slate-200">
                                Ver relatoria completa de los pasos
                            </summary>
                            <div className="mt-4 grid gap-3">
                                {steps.map((step, index) => (
                                    <button
                                        key={step.title}
                                        type="button"
                                        onClick={() => focusStep(index)}
                                        className="grid gap-3 rounded-md border border-white/10 bg-slate-900/70 p-3 text-left hover:bg-slate-800/70 lg:grid-cols-[0.8fr_1fr]"
                                    >
                                        <span>
                                            <span className="block text-sm font-bold text-white">{step.title}</span>
                                            <span className="mt-1 block text-sm leading-6 text-slate-400">{step.idea}</span>
                                        </span>
                                        <span className="rounded-md bg-slate-950/80 p-3 text-cyan-50" dangerouslySetInnerHTML={math(step.math)} />
                                    </button>
                                ))}
                            </div>
                        </details>
                    </section>

                    <section className="rounded-lg border border-cyan-300/20 bg-cyan-950/30 p-5">
                        <h2 className="text-xl font-bold text-white">Lo que debe quedar cristalino</h2>
                        <div className="mt-4 grid gap-4 lg:grid-cols-3">
                            {consultationBlocks.map((block) => (
                                <div key={block.title} className="rounded-md bg-slate-950/70 p-4">
                                    <p className="mb-2 text-sm font-bold text-cyan-200">{block.title}</p>
                                    <p className="text-sm leading-6 text-slate-300">{block.body}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-lg border border-white/10 bg-slate-900/68 p-5">
                        <h2 className="text-xl font-bold text-white">Errores que esta relatoria intenta evitar</h2>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {commonMistakes.map((mistake, index) => (
                                <div key={mistake} className="flex gap-3 rounded-md border border-white/10 bg-slate-950/62 p-4">
                                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-300 text-sm font-black text-slate-950">
                                        {index + 1}
                                    </span>
                                    <p className="text-sm leading-6 text-slate-300">{mistake}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="grid gap-4 md:grid-cols-4">
                        {stats.map((item) => (
                            <div key={item.label} className="rounded-lg border border-white/10 bg-slate-900/68 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                                <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
                                <p className="mt-2 text-sm leading-5 text-slate-400">{item.detail}</p>
                            </div>
                        ))}
                    </section>

                    <section className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-lg border border-white/10 bg-slate-900/68 p-5">
                            <CircleDot className="mb-3 h-6 w-6 text-amber-300" />
                            <h3 className="text-lg font-bold text-white">No penetracion</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                                En fluido ideal la pared solo bloquea la componente normal. Por eso el flujo puede
                                resbalar sobre el cuerpo.
                            </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-slate-900/68 p-5">
                            <Eye className="mb-3 h-6 w-6 text-cyan-300" />
                            <h3 className="text-lg font-bold text-white">Irrotacional afuera</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                                La familia usada es armonica en la region exterior. En el problema, eso se verifica
                                calculando que la vorticidad se anula fuera del cuerpo.
                            </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-slate-900/68 p-5">
                            <Gauge className="mb-3 h-6 w-6 text-rose-300" />
                            <h3 className="text-lg font-bold text-white">Presion despues</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                                Bernoulli no inventa psi. Entra despues: cuando ya existe un campo sin vorticidad,
                                permite traducir rapidez en presion ideal.
                            </p>
                        </div>
                    </section>

                    <section className="rounded-lg border border-white/10 bg-slate-900/68 p-5">
                        <h2 className="text-xl font-bold text-white">Guion de cierre para clase</h2>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="rounded-md bg-slate-950/70 p-4">
                                <p className="mb-2 text-sm font-bold text-cyan-200">{kind === "cylinder" ? "Velocidad del cilindro" : "Velocidad de la esfera"}</p>
                                <div className="overflow-x-auto text-slate-100" dangerouslySetInnerHTML={math(copy.vr, true)} />
                                <div className="overflow-x-auto text-slate-100" dangerouslySetInnerHTML={math(copy.vt, true)} />
                            </div>
                            <div className="rounded-md bg-slate-950/70 p-4">
                                <p className="mb-2 text-sm font-bold text-amber-200">Formula final construida</p>
                                <div className="overflow-x-auto text-slate-100" dangerouslySetInnerHTML={math(copy.psi, true)} />
                                <p className="mt-3 text-sm leading-6 text-slate-300">
                                    Se lee como corriente uniforme mas correccion que respeta la frontera. Ese es el
                                    puente aprendible del problema.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </section>
        </article>
    );
}

export default StreamFunctionExplainer;
