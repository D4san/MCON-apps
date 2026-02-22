import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as math from 'mathjs';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Activity, HelpCircle, ChevronDown, Check, AlertTriangle, Play, Settings, X } from 'lucide-react';
import { useIsPortrait } from '../../hooks/useIsPortrait';

// --- Constants & Types ---
const PRESETS = {
    expansion: { u: "0.2*x", v: "0.2*y", w: "0.2*z", name: "Expansión Uniforme" },
    shear: { u: "0.3*y", v: "0.3*x", w: "0", name: "Cizalladura Pura (XY)" },
    torsion: { u: "-0.2*y*z", v: "0.2*x*z", w: "0", name: "Torsión (alrededor de Z)" },
    translation: { u: "0.5", v: "0.2", w: "0", name: "Traslación (Movimiento Rígido)" },
    rotation: { u: "-0.2*y", v: "0.2*x", w: "0", name: "Rotación (Movimiento Rígido sobre Z)" }
};

const GRID_CONFIG = {
    divisions: 7,
    size: 2,
    sphereRadius: 0.05
};

type PresetKey = keyof typeof PRESETS;

interface TensorState {
    e11: string; e12: string; e13: string;
    e21: string; e22: string; e23: string;
    e31: string; e32: string; e33: string;
}

const INITIAL_TENSOR: TensorState = {
    e11: "", e12: "", e13: "",
    e21: "", e22: "", e23: "",
    e31: "", e32: "", e33: ""
};

const Deformations = () => {
    // --- State ---
    const [u, setU] = useState("0.1*x + 0.05*y");
    const [v, setV] = useState("0.05*x");
    const [w, setW] = useState("0");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tensor, setTensor] = useState<TensorState>(INITIAL_TENSOR);
    const [selectedPreset, setSelectedPreset] = useState<string>("");
    const [showHelp, setShowHelp] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const isPortrait = useIsPortrait();

    // --- Refs ---
    const canvasRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const frameIdRef = useRef<number | null>(null);
    
    // Three.js Objects
    const originalGroupRef = useRef<THREE.Group | null>(null);
    const deformedGroupRef = useRef<THREE.Group | null>(null);
    const deformedSurfaceMeshRef = useRef<THREE.Mesh | null>(null);

    // Math Compilation
    const compiledURef = useRef<math.EvalFunction | null>(null);
    const compiledVRef = useRef<math.EvalFunction | null>(null);
    const compiledWRef = useRef<math.EvalFunction | null>(null);

    // DOM Refs for KaTeX (optional, but good for direct manipulation if needed, mostly handled by state/effect)
    const formulaRef = useRef<HTMLDivElement>(null);

    // --- Initialization ---
    useEffect(() => {
        initThree();
        renderStaticMath();
        
        // Initial Calculation
        handleCalculate();

        return () => {
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
            if (rendererRef.current) {
                rendererRef.current.dispose();
                if (canvasRef.current && rendererRef.current.domElement) {
                    canvasRef.current.removeChild(rendererRef.current.domElement);
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Math & Tensor Logic ---
    const getSafeDerivative = (expr: string, variable: string) => {
        try {
            const safeExpr = expr.trim() === "" ? "0" : expr;
            const node = math.parse(safeExpr);
            const derivNode = math.derivative(node, variable);
            return math.simplify(derivNode);
        } catch (err) {
            console.error(`Error calculating derivative: ${err}`);
            return math.parse("0"); // Fallback
        }
    };

    const simplifyExpressionString = (expr: string | math.MathNode) => {
        try {
            if (typeof expr === 'string') {
                return math.simplify(math.parse(expr));
            }
            return math.simplify(expr);
        } catch (err) {
            return math.parse("0");
        }
    };

    const calculateTensor = () => {
        try {
            const dudx = getSafeDerivative(u, 'x'); const dudy = getSafeDerivative(u, 'y'); const dudz = getSafeDerivative(u, 'z');
            const dvdx = getSafeDerivative(v, 'x'); const dvdy = getSafeDerivative(v, 'y'); const dvdz = getSafeDerivative(v, 'z');
            const dwdx = getSafeDerivative(w, 'x'); const dwdy = getSafeDerivative(w, 'y'); const dwdz = getSafeDerivative(w, 'z');

            const e11 = simplifyExpressionString(dudx);
            const e22 = simplifyExpressionString(dvdy);
            const e33 = simplifyExpressionString(dwdz);
            
            // e_ij = 0.5 * (du_i/dx_j + du_j/dx_i)
            // Note: toString() might not be perfect for complex exprs but works for simple polynomials
            const e12 = simplifyExpressionString(`0.5 * (${dudy.toString()} + ${dvdx.toString()})`);
            const e13 = simplifyExpressionString(`0.5 * (${dudz.toString()} + ${dwdx.toString()})`);
            const e23 = simplifyExpressionString(`0.5 * (${dvdz.toString()} + ${dwdy.toString()})`);

            setTensor({
                e11: e11.toTex(), e12: e12.toTex(), e13: e13.toTex(),
                e21: e12.toTex(), e22: e22.toTex(), e23: e23.toTex(), // Symmetric
                e31: e13.toTex(), e32: e23.toTex(), e33: e33.toTex()
            });
        } catch (err) {
            console.error("Tensor calculation error", err);
            setError("Error calculando el tensor.");
        }
    };

    const compileFunctions = () => {
        try {
            const uStr = u.trim() === "" ? "0" : u;
            const vStr = v.trim() === "" ? "0" : v;
            const wStr = w.trim() === "" ? "0" : w;

            compiledURef.current = math.compile(uStr);
            compiledVRef.current = math.compile(vStr);
            compiledWRef.current = math.compile(wStr);
            return true;
        } catch (err: any) {
            setError(`Error de sintaxis: ${err.message}`);
            return false;
        }
    };

    const handleCalculate = async () => {
        setLoading(true);
        setError(null);
        
        // Small delay to allow UI to update (loader)
        await new Promise(resolve => setTimeout(resolve, 50));

        calculateTensor();
        if (compileFunctions()) {
            updateVisualization();
        }
        
        setLoading(false);
    };

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const key = e.target.value as PresetKey | "";
        setSelectedPreset(key);
        if (key && PRESETS[key]) {
            setU(PRESETS[key].u);
            setV(PRESETS[key].v);
            setW(PRESETS[key].w);
            // Trigger calculation in effect or verify if user needs to click?
            // Usually better to auto-trigger or let user click. Let's auto-trigger via effect if desire
            // But since handleCalculate is async and depends on state, we might need a useEffect monitoring [u,v,w] 
            // OR just let the user click "Calculate". The original app auto-submit on change.
            // Let's defer calculation to user or a specific effect if we want auto-update.
            // We'll leave it manual for now to avoid race conditions, or add a short timeout.
        }
    };

    // --- Visualization Logic ---
    const initThree = () => {
        if (!canvasRef.current) return;
        
        // Clean up previous renderer if any remaining in DOM
        while (canvasRef.current.firstChild) {
            canvasRef.current.removeChild(canvasRef.current.firstChild);
        }
        
        // Scene Setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a); // slate-950 (dark theme)
        sceneRef.current = scene;

        // Camera
        const width = canvasRef.current.clientWidth;
        const height = canvasRef.current.clientHeight;
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
        camera.position.set(2, 2, 4);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        canvasRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controlsRef.current = controls;

        // Lights (tuned for dark background)
        const hemiLight = new THREE.HemisphereLight(0x334155, 0x0f172a, 1.2);
        scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xc4d8ff, 1.2);
        dirLight.position.set(5, 10, 7.5);
        scene.add(dirLight);
        const dirLight2 = new THREE.DirectionalLight(0x8b9cf7, 0.4);
        dirLight2.position.set(-5, -3, -5);
        scene.add(dirLight2);

        // Grid & Objects
        createGrids(scene);

        // Helper
        const axesHelper = new THREE.AxesHelper(1.5);
        scene.add(axesHelper);

        // Resize Listener
        window.addEventListener('resize', onWindowResize);

        // Animation Loop
        const animate = () => {
            frameIdRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();
    };

    const createGrids = (scene: THREE.Scene) => {
        const originalGroup = new THREE.Group();
        const deformedGroup = new THREE.Group();
        
        originalGroupRef.current = originalGroup;
        deformedGroupRef.current = deformedGroup;

        const { divisions, size, sphereRadius } = GRID_CONFIG;
        const step = size / (divisions - 1);
        const offset = size / 2;
        const subdivisions = divisions - 1;

        const sphereGeom = new THREE.SphereGeometry(sphereRadius, 16, 16);
        
        const matOriginal = new THREE.MeshStandardMaterial({
            color: 0x22d3ee, // cyan-400
            transparent: true,
            opacity: 0.5,
            metalness: 0.2,
            roughness: 0.4,
            emissive: 0x06b6d4, // cyan-500
            emissiveIntensity: 0.3
        });
        const matDeformedSpheres = new THREE.MeshStandardMaterial({
            color: 0xc084fc, // purple-400
            metalness: 0.3, 
            roughness: 0.3,
            emissive: 0xa855f7, // purple-500
            emissiveIntensity: 0.4
        });
        const matDeformedSurface = new THREE.MeshStandardMaterial({
            color: 0xc084fc, // purple-400
            metalness: 0.3,
            roughness: 0.3,
            transparent: true,
            opacity: 0.3, 
            side: THREE.DoubleSide,
            emissive: 0x7c3aed, // violet-600
            emissiveIntensity: 0.3
        });

        // 1. Spheres
        for (let i = 0; i < divisions; i++) {
            for (let j = 0; j < divisions; j++) {
                for (let k = 0; k < divisions; k++) {
                    const x = i * step - offset;
                    const y = j * step - offset;
                    const z = k * step - offset;
                    const posVec = new THREE.Vector3(x, y, z);
                    
                    // Original Sphere
                    const sphereOrig = new THREE.Mesh(sphereGeom, matOriginal);
                    sphereOrig.position.copy(posVec);
                    originalGroup.add(sphereOrig);
                    
                    // Deformed Sphere placeholder
                    const sphereDeformed = new THREE.Mesh(sphereGeom, matDeformedSpheres);
                    sphereDeformed.position.copy(posVec);
                    sphereDeformed.userData.originalPosition = posVec.clone();
                    deformedGroup.add(sphereDeformed);
                }
            }
        }

        // 2. Original Wireframe
        const boxGeom = new THREE.BoxGeometry(size, size, size);
        const edgesGeom = new THREE.EdgesGeometry(boxGeom);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, opacity: 0.5, transparent: true }); // cyan-400
        const wireframe = new THREE.LineSegments(edgesGeom, lineMat);
        originalGroup.add(wireframe);

        // 3. Deformed Surface (Mesh)
        const deformedBoxGeom = new THREE.BoxGeometry(size, size, size, subdivisions, subdivisions, subdivisions);
        deformedBoxGeom.userData.originalPositions = deformedBoxGeom.attributes.position.clone();
        
        const deformedSurfaceMesh = new THREE.Mesh(deformedBoxGeom, matDeformedSurface);
        deformedSurfaceMeshRef.current = deformedSurfaceMesh;
        deformedGroup.add(deformedSurfaceMesh);

        scene.add(originalGroup);
        scene.add(deformedGroup);
    };

    const updateVisualization = () => {
        if (!compiledURef.current || !compiledVRef.current || !compiledWRef.current || !deformedGroupRef.current) return;

        const deformedGroup = deformedGroupRef.current;
        const deformedSurfaceMesh = deformedSurfaceMeshRef.current;
        
        let errorOccurred = false;

        // Update Spheres
        deformedGroup.children.forEach(child => {
            if (child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry) {
                const sphere = child;
                const origPos = sphere.userData.originalPosition;
                const scope = { x: origPos.x, y: origPos.y, z: origPos.z };
                
                try {
                    let dx = compiledURef.current!.evaluate(scope);
                    let dy = compiledVRef.current!.evaluate(scope);
                    let dz = compiledWRef.current!.evaluate(scope);
                    
                    // Sanity checks
                    if (typeof dx !== 'number' || isNaN(dx) || !isFinite(dx)) dx = 0;
                    if (typeof dy !== 'number' || isNaN(dy) || !isFinite(dy)) dy = 0;
                    if (typeof dz !== 'number' || isNaN(dz) || !isFinite(dz)) dz = 0;

                    const newX = origPos.x + dx;
                    const newY = origPos.y + dy;
                    const newZ = origPos.z + dz;

                    if (isFinite(newX) && isFinite(newY) && isFinite(newZ)) {
                        sphere.position.set(newX, newY, newZ);
                        sphere.visible = true;
                    } else {
                        sphere.visible = false;
                    }
                } catch (err: any) {
                    sphere.visible = false;
                    if (!errorOccurred) {
                        console.warn("Viz Eval Error", err);
                        // Only show one error to avoid spam
                        errorOccurred = true; 
                    }
                }
            }
        });

        // Update Surface Mesh
        if (deformedSurfaceMesh) {
            const positions = deformedSurfaceMesh.geometry.attributes.position;
            const originalPositions = deformedSurfaceMesh.geometry.userData.originalPositions; // Note: Use typed array or clone?
            // userData.originalPositions is a BufferAttribute in our logic above
            
            for (let i = 0; i < positions.count; i++) {
                const origX = originalPositions.getX(i);
                const origY = originalPositions.getY(i);
                const origZ = originalPositions.getZ(i);
                const scope = { x: origX, y: origY, z: origZ };
                
                try {
                    let dx = compiledURef.current!.evaluate(scope);
                    let dy = compiledVRef.current!.evaluate(scope);
                    let dz = compiledWRef.current!.evaluate(scope);

                    if (typeof dx !== 'number' || isNaN(dx) || !isFinite(dx)) dx = 0;
                    if (typeof dy !== 'number' || isNaN(dy) || !isFinite(dy)) dy = 0;
                    if (typeof dz !== 'number' || isNaN(dz) || !isFinite(dz)) dz = 0;

                    positions.setXYZ(i, origX + dx, origY + dy, origZ + dz);
                } catch (e) {
                    // Ignore
                }
            }
            positions.needsUpdate = true;
            deformedSurfaceMesh.geometry.computeVertexNormals();
        }
    };

    const onWindowResize = () => {
        if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
        const width = canvasRef.current.clientWidth;
        const height = canvasRef.current.clientHeight;
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
    };

    // --- Render Helpers ---
    const renderStaticMath = () => {
        if (formulaRef.current) {
            katex.render("\\boldsymbol{\\epsilon} = \\frac{1}{2} (\\nabla \\mathbf{u} + (\\nabla \\mathbf{u})^T)", formulaRef.current, { throwOnError: false });
        }
    };

    // Component for rendering LaTeX strings safely
    const MathTex = ({ tex }: { tex: string }) => {
        const ref = useRef<HTMLDivElement>(null);
        useEffect(() => {
            if (ref.current) {
                katex.render(tex || "-", ref.current, { throwOnError: false });
            }
        }, [tex]);
        return <div ref={ref} className="text-center overflow-x-auto min-h-[1.5em]" />;
    };

    return (
        <div className="w-full text-slate-200 font-sans relative">
            {/* Portrait: Floating config toggle */}
            {isPortrait && (
                <button
                    onClick={() => setConfigOpen(!configOpen)}
                    className="fixed bottom-4 right-4 z-50 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-900/40 transition-all"
                >
                    {configOpen ? <X size={22} /> : <Settings size={22} />}
                </button>
            )}

            {/* Portrait backdrop */}
            {isPortrait && configOpen && (
                <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setConfigOpen(false)} />
            )}

            <div className={`max-w-7xl mx-auto gap-3 p-1 md:p-2 ${
                isPortrait 
                    ? 'flex flex-col' 
                    : 'grid grid-cols-1 lg:grid-cols-2 gap-3 h-full'
            }`}>
                
                {/* Control Panel */}
                <div className={`bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-xl space-y-2 ${
                    isPortrait 
                        ? `fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto transform transition-transform duration-300 ease-in-out ${configOpen ? 'translate-y-0' : 'translate-y-full'} rounded-b-none` 
                        : ''
                }`}>
                    <div className="border-b border-slate-800 pb-2">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                           <Activity className="text-blue-400" size={20}/> Calculadora de Deformación
                        </h1>
                    </div>

                    {/* Formula Display */}
                    <div ref={formulaRef} className="bg-slate-800/50 p-2 rounded-lg flex justify-center text-sm text-slate-300"></div>

                    {/* Presets */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                            <Check size={14} /> Cargar Ejemplo
                        </label>
                        <div className="relative">
                            <select 
                                value={selectedPreset}
                                onChange={handlePresetChange}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm appearance-none focus:outline-none focus:border-blue-500 transition-colors cursor-pointer text-slate-300"
                            >
                                <option value="">-- Personalizado --</option>
                                {Object.entries(PRESETS).map(([key, val]) => (
                                    <option key={key} value={key}>{val.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-4 text-slate-500 pointer-events-none"/>
                        </div>
                    </div>

                    {/* Syntax Help */}
                    <div>
                        <button 
                            onClick={() => setShowHelp(!showHelp)}
                            className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium text-slate-400"
                        >
                            <span className="flex items-center gap-2"><HelpCircle size={16}/> Ayuda de Sintaxis</span>
                            <ChevronDown size={16} className={`transition-transform ${showHelp ? 'rotate-180' : ''}`}/>
                        </button>
                        {showHelp && (
                            <div className="mt-2 p-4 bg-slate-800/30 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-2 animate-in fade-in slide-in-from-top-2">
                                <p>Variables: <code className="text-yellow-400">x y z</code>. Operadores: <code className="text-yellow-400">+ - * / ^</code></p>
                                <p>Funciones: <code className="text-cyan-400">sin cos tan sqrt exp log abs</code></p>
                                <p>Constantes: <code className="text-rose-400">pi e</code></p>
                                <p>Ejemplo: <code className="text-green-400">0.5 * sin(x) + y^2</code></p>
                            </div>
                        )}
                    </div>

                    {/* Inputs */}
                    <div className="space-y-2">
                        {[
                            { label: "u", val: u, set: setU, color: "text-rose-400" },
                            { label: "v", val: v, set: setV, color: "text-blue-400" },
                            { label: "w", val: w, set: setW, color: "text-emerald-400" },
                        ].map(({label, val, set, color}) => (
                           <div key={label} className="group">
                               <label className={`block text-xs font-bold mb-0.5 ${color}`}>{label}(x,y,z) =</label>
                               <input 
                                 value={val}
                                 onChange={(e) => set(e.target.value)}
                                 className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors text-slate-200"
                                 placeholder="0"
                               />
                           </div>
                        ))}
                    </div>

                    <button 
                        onClick={handleCalculate}
                        disabled={loading}
                        className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Play size={18} fill="currentColor"/>}
                        {loading ? "Calculando..." : "Calcular y Visualizar"}
                    </button>

                    {error && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/50 rounded-lg text-rose-400 text-sm flex items-center gap-2">
                            <AlertTriangle size={16}/> {error}
                        </div>
                    )}

                    {/* Tensor Output */}
                    <div className="pt-2 border-t border-slate-800">
                        <h3 className="text-center font-bold text-slate-400 text-sm mb-2">Tensor de Deformación Resultante</h3>
                        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                            {['e11', 'e12', 'e13', 'e21', 'e22', 'e23', 'e31', 'e32', 'e33'].map((key) => (
                                <div key={key} className="bg-slate-900/50 rounded p-1 flex items-center justify-center border border-slate-800/50 min-h-[2rem] text-sm">
                                    <MathTex tex={tensor[key as keyof TensorState]} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Visualization Panel */}
                <div className={`bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-xl flex flex-col relative overflow-hidden ${
                    isPortrait ? 'h-[60vh]' : 'min-h-0'
                }`}>
                    <div className="flex-1 w-full h-full rounded-xl overflow-hidden bg-slate-950 relative">
                        {/* Canvas Container - Dedicated for Three.js */}
                        <div ref={canvasRef} className="absolute inset-0 w-full h-full" />
                        
                        {/* Overlay Controls */}
                        <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-400 pointer-events-none">
                            <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-cyan-400 opacity-60"/> Original</div>
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400"/> Deformado</div>
                        </div>
                    </div>
                    <div className="p-3 bg-slate-900 text-center text-xs text-slate-500">
                        Usa el mouse para rotar, mover y hacer zoom.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Deformations;
