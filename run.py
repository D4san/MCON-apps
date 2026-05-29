with open('src/apps/StressTensor/StressTensor.tsx', 'w', encoding='utf-8') as f:
    f.write('''import { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, Mountain, Plane, Box, ArrowDown, Activity, Settings, X, LocateFixed } from 'lucide-react';
import { useIsPortrait } from '../../hooks/useIsPortrait';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const InlineMath = ({ tex }: { tex: string }) => (
  <span dangerouslySetInnerHTML={{ __html: katex.renderToString(tex, { throwOnError: false }) }} />
);

interface StressState {
  xx: number; xy: number; xz: number;
  yx: number; yy: number; yz: number;
  zx: number; zy: number; zz: number;
}

const DEFAULT_STRESS: StressState = {
  xx: 0, xy: 0, xz: 0,
  yx: 0, yy: 0, yz: 0,
  zx: 0, zy: 0, zz: 0
};

const MohrCircle = ({ prime, cx, R, minX, maxX, minY, maxY, vBoxW, vBoxH }: any) => {
  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex justify-between items-center text-slate-300">
        <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 border border-blue-400" />
          Círculo de Mohr (XY)
        </h3>
      </div>
      <div className="w-full aspect-video bg-slate-950/80 rounded-lg border border-slate-700/50 p-2 relative overflow-hidden flex items-center justify-center">
        <svg width="100%" height="100%" viewBox={\\ \ \ \\} className="drop-shadow-lg">
          <line x1={minX} y1={0} x2={maxX} y2={0} stroke="#475569" strokeWidth={vBoxW*0.005} strokeDasharray={\\ \\} />
          <line x1={0} y1={minY} x2={0} y2={maxY} stroke="#475569" strokeWidth={vBoxW*0.005} strokeDasharray={\\ \\} />
          
          <circle cx={cx} cy={0} r={R} fill="none" stroke="#3b82f6" strokeWidth={vBoxW * 0.01} className="opacity-70" />
          
          <line x1={prime.xx} y1={prime.xy} x2={prime.yy} y2={-prime.xy} stroke="#f59e0b" strokeWidth={vBoxW * 0.008} />
          <circle cx={cx} cy={0} r={vBoxW * 0.015} fill="#f59e0b" />
          <circle cx={prime.xx} cy={prime.xy} r={vBoxW * 0.02} fill="#ef4444" />
          <circle cx={prime.yy} cy={-prime.xy} r={vBoxW * 0.02} fill="#0ea5e9" />
        </svg>
      </div>
    </div>
  );
};

const StressTensor = () => {
  const isPortrait = useIsPortrait();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [stress, setStress] = useState<StressState>({ ...DEFAULT_STRESS, xx: 50, xy: 30, yx: 30 });
  const [theta, setTheta] = useState<number>(0);
  const [showDeformation, setShowDeformation] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mainGroupRef = useRef<THREE.Group | null>(null);
  const arrowsGroupRef = useRef<THREE.Group | null>(null);
  const baseCubeRef = useRef<THREE.Mesh | null>(null);
  const deformedCubeRef = useRef<THREE.Mesh | null>(null);

  const cubeSize = 2;
  const arrowScale = 0.03;

  const handleMatrixChange = (key: keyof StressState, value: string) => {
    const num = parseFloat(value) || 0;
    const newStress = { ...stress, [key]: num };
    if (key === 'xy') newStress.yx = num;
    if (key === 'yx') newStress.xy = num;
    if (key === 'xz') newStress.zx = num;
    if (key === 'zx') newStress.xz = num;
    if (key === 'yz') newStress.zy = num;
    if (key === 'zy') newStress.yz = num;
    setStress(newStress);
  };

  const applyPreset = (preset: Partial<StressState>) => {
    setStress({ ...DEFAULT_STRESS, ...preset });
    setTheta(0);
    if (controlsRef.current) controlsRef.current.reset();
  };

  const alignToPrincipal = () => {
    if (Math.abs(stress.xx - stress.yy) < 0.001) {
      setTheta(45);
    } else {
      const angleRad = 0.5 * Math.atan2(2 * stress.xy, stress.xx - stress.yy);
      setTheta((angleRad * 180) / Math.PI);
    }
  };

  const prime = useMemo(() => {
    const rad = (theta * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const c2 = Math.cos(2 * rad);
    const s2 = Math.sin(2 * rad);
    
    const xx = (stress.xx + stress.yy)/2 + ((stress.xx - stress.yy)/2) * c2 + stress.xy * s2;
    const yy = (stress.xx + stress.yy)/2 - ((stress.xx - stress.yy)/2) * c2 - stress.xy * s2;
    const xy = -((stress.xx - stress.yy)/2) * s2 + stress.xy * c2;

    return {
      ...stress,
      xx, yy, xy, yx: xy,
    };
  }, [stress, theta]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(6, 4, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const axesHelper = new THREE.AxesHelper(4);
    scene.add(axesHelper);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    mainGroupRef.current = mainGroup;

    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const edges = new THREE.EdgesGeometry(geometry);
    const linesMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const baseCube = new THREE.LineSegments(edges, linesMat);
    mainGroup.add(baseCube);
    baseCubeRef.current = baseCube as unknown as THREE.Mesh;

    const deformedCube = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x818cf8 }));
    deformedCube.visible = false;
    mainGroup.add(deformedCube);
    deformedCubeRef.current = deformedCube as unknown as THREE.Mesh;

    const arrowsGroup = new THREE.Group();
    mainGroup.add(arrowsGroup);
    arrowsGroupRef.current = arrowsGroup;

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    
    window.addEventListener(\esize\, handleResize);
    handleResize();

    return () => {
      window.removeEventListener(\esize\, handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (mainGroupRef.current) {
      mainGroupRef.current.rotation.z = (theta * Math.PI) / 180;
    }
  }, [theta]);

  useEffect(() => {
    if (!arrowsGroupRef.current) return;
    const group = arrowsGroupRef.current;
    while (group.children.length > 0) group.remove(group.children[0]);

    const o = cubeSize / 2;
    const addArrow = (dir: THREE.Vector3, origin: THREE.Vector3, val: number, isNormal: boolean) => {
      if (Math.abs(val) < 0.1) return;
      const length = Math.max(Math.abs(val) * arrowScale, 0.4);
      let color = 0x00ff00;
      let actualDir = dir.clone();
      let actualOrigin = origin.clone();

      if (isNormal) {
        if (val > 0) { color = 0xf43f5e; } 
        else { color = 0x0ea5e9; actualDir.negate(); actualOrigin.add(dir.clone().multiplyScalar(length)); }
      } else {
        color = 0xeab308;
        if (val < 0) actualDir.negate();
        actualOrigin.add(dir.clone().cross(new THREE.Vector3(1,1,1)).normalize().multiplyScalar(0.1));
      }
      group.add(new THREE.ArrowHelper(actualDir, actualOrigin, length, color, 0.2, 0.1));
    };

    addArrow(new THREE.Vector3(1,0,0), new THREE.Vector3(o,0,0), prime.xx, true);
    addArrow(new THREE.Vector3(0,1,0), new THREE.Vector3(o,0,0), prime.xy, false);
    addArrow(new THREE.Vector3(0,0,1), new THREE.Vector3(o,0,0), prime.xz, false);

    addArrow(new THREE.Vector3(0,1,0), new THREE.Vector3(0,o,0), prime.yy, true);
    addArrow(new THREE.Vector3(1,0,0), new THREE.Vector3(0,o,0), prime.yx, false);
    addArrow(new THREE.Vector3(0,0,1), new THREE.Vector3(0,o,0), prime.yz, false);

    addArrow(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,o), prime.zz, true);
    addArrow(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,o), prime.zx, false);
    addArrow(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,o), prime.zy, false);

    addArrow(new THREE.Vector3(-1,0,0), new THREE.Vector3(-o,0,0), prime.xx, true);
    addArrow(new THREE.Vector3(0,-1,0), new THREE.Vector3(-o,0,0), prime.xy, false);
    addArrow(new THREE.Vector3(0,0,-1), new THREE.Vector3(-o,0,0), prime.xz, false);
    
    addArrow(new THREE.Vector3(0,-1,0), new THREE.Vector3(0,-o,0), prime.yy, true);
    addArrow(new THREE.Vector3(-1,0,0), new THREE.Vector3(0,-o,0), prime.yx, false);
    addArrow(new THREE.Vector3(0,0,-1), new THREE.Vector3(0,-o,0), prime.yz, false);
    
    addArrow(new THREE.Vector3(0,0,-1), new THREE.Vector3(0,0,-o), prime.zz, true);
    addArrow(new THREE.Vector3(-1,0,0), new THREE.Vector3(0,0,-o), prime.zx, false);
    addArrow(new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,-o), prime.zy, false);

  }, [prime]);

  useEffect(() => {
    if (!baseCubeRef.current || !deformedCubeRef.current) return;
    if (showDeformation) {
      deformedCubeRef.current.visible = true;
      (baseCubeRef.current.material as THREE.Material).opacity = 0.1;
      const k = 0.005; 
      const m = new THREE.Matrix4();
      m.set(
        1 + prime.xx*k, prime.xy*k, prime.xz*k, 0,
        prime.yx*k, 1 + prime.yy*k, prime.yz*k, 0,
        prime.zx*k, prime.zy*k, 1 + prime.zz*k, 0,
        0, 0, 0, 1
      );
      deformedCubeRef.current.matrixAutoUpdate = false;
      deformedCubeRef.current.matrix.copy(m);
    } else {
      deformedCubeRef.current.visible = false;
      (baseCubeRef.current.material as THREE.Material).opacity = 0.3;
    }
  }, [showDeformation, prime]);

  const cx = (prime.xx + prime.yy) / 2;
  const R = Math.sqrt(Math.pow((prime.xx - prime.yy) / 2, 2) + Math.pow(prime.xy, 2));
  const minX = Math.min(0, cx - R - 20) || -10;
  const maxX = Math.max(0, cx + R + 20) || 10;
  const minY = Math.min(0, -R - 20, -prime.xy - 20, prime.xy - 20) || -10;
  const maxY = Math.max(0, R + 20, -prime.xy + 20, prime.xy + 20) || 10;
  const vBoxW = parseFloat((maxX - minX).toFixed(2));
  const vBoxH = parseFloat((maxY - minY).toFixed(2));

  return (
    <div className="flex flex-col md:flex-row w-full h-[calc(100vh-64px)] bg-slate-900 text-slate-200 overflow-hidden font-sans relative">
      <div className={\lex flex-col w-full md:w-80 bg-slate-900 border-r border-slate-800 shadow-xl z-20 flex-shrink-0 transition-transform duration-300 \\}>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg"><Box className="w-5 h-5" /></div>
              <h2 className="font-semibold text-white truncate flex items-center gap-2">Tensor de Esfuerzos</h2>
            </div>
            {isPortrait && (
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-1">Casos Físicos</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => applyPreset({ xx: 100 })} className="p-2 text-xs bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/50 flex flex-col items-center gap-1"><Activity className="w-4 h-4 text-rose-400" /> Tracción</button>
              <button onClick={() => applyPreset({ yy: -120 })} className="p-2 text-xs bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/50 flex flex-col items-center gap-1"><Mountain className="w-4 h-4 text-emerald-400" /> Compresión</button>
              <button onClick={() => applyPreset({ xx: -80, yy: -80, zz: -80 })} className="p-2 text-xs bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/50 flex flex-col items-center gap-1"><ArrowDown className="w-4 h-4 text-cyan-400" /> Fluidostática</button>
              <button onClick={() => applyPreset({ xy: 60, yx: 60 })} className="p-2 text-xs bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700/50 flex flex-col items-center gap-1"><Plane className="w-4 h-4 text-amber-400" /> Corte Puro</button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-1 flex justify-between items-center">
              <span>Matriz Base (θ=0°)</span>
            </h3>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-2 rounded border border-slate-800">
              {['xx', 'xy', 'xz', 'yx', 'yy', 'yz', 'zx', 'zy', 'zz'].map((key) => {
                const isDiag = key[0] === key[1];
                return (
                  <div key={key} className="flex flex-col gap-1 items-center">
                    <span className="text-[10px] text-slate-500 font-mono">{isDiag ? \σ_\\ : \τ_\\}</span>
                    <input type="number" value={stress[key as keyof StressState]} onChange={(e) => handleMatrixChange(key as keyof StressState, e.target.value)} className={\w-full bg-slate-800 border \ rounded px-1 py-1 text-center text-sm font-mono focus:outline-none focus:border-cyan-400\} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-lg">
             <h3 className="text-sm font-semibold text-amber-400 flex items-center justify-between">
               <span>Rotar Ejes (Plano XY)</span>
               <button onClick={alignToPrincipal} className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-1 rounded border border-amber-500/30 flex items-center gap-1 hover:bg-amber-500/30 transition">
                  <LocateFixed className="w-3 h-3" /> Principales
               </button>
             </h3>
             <div className="flex items-center gap-3">
               <span className="text-xs font-mono w-8">{theta.toFixed(0)}°</span>
               <input type="range" min="-90" max="90" step="1" value={theta} onChange={(e) => setTheta(parseFloat(e.target.value))} className="flex-1 accent-amber-500" />
             </div>

             <div className="mt-2 p-2 bg-amber-950/30 rounded border border-amber-900/50">
               <div className="text-xs text-amber-200/80 mb-2 flex justify-between items-center font-medium">
                 <span>Matriz Rotada</span>
                 {Math.abs(prime.xy) < 0.1 && theta !== 0 && (
                   <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded">Autovalores!</span>
                 )}
               </div>
               <div className="grid grid-cols-3 gap-1">
                 {['xx', 'xy', 'xz', 'yx', 'yy', 'yz', 'zx', 'zy', 'zz'].map((key) => {
                   const val = prime[key as keyof StressState];
                   const isDiag = key[0] === key[1];
                   const isZero = Math.abs(val) < 0.1;
                   return (
                     <div key={\prime-\\} className={\px-1 py-1 text-center text-xs font-mono rounded \ \ bg-slate-900 border border-slate-800\}>
                       {isZero ? '0' : val.toFixed(1)}
                     </div>
                   );
                 })}
               </div>
             </div>
          </div>

          <MohrCircle prime={prime} cx={cx} R={R} minX={minX} maxX={maxX} minY={minY} maxY={maxY} vBoxW={vBoxW} vBoxH={vBoxH} />

        </div>
      </div>

      <div className="flex-1 relative bg-[#0a0f1c] flex flex-col" ref={containerRef}>
        <canvas ref={canvasRef} className="w-full h-full block touch-none" />
        {isPortrait && !isMobileMenuOpen && (
          <button onClick={() => setIsMobileMenuOpen(true)} className="absolute bottom-4 right-4 z-10 bg-indigo-600 text-white p-3 rounded-full shadow-lg border border-indigo-400">
             <Settings className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
};
export default StressTensor;''')
