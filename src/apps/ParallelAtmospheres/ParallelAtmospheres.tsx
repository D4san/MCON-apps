import { useMemo, useState } from 'react';
import { Plus, Trash2, Mountain, Wind, Thermometer, Droplets } from 'lucide-react';
import { cn } from '../../lib/utils';

type PlanetId = 'earth' | 'mars' | 'venus' | 'jupiter';
type FieldId = 'temperature' | 'pressure' | 'density';
type CurveModel = 'lapse_rate' | 'isothermal' | 'incompressible' | 'homentropic';

interface PlanetConfig {
  id: PlanetId;
  name: string;
  gravity: number;
  p0: number; // Pa
  t0: number; // K
  molarMass: number; // kg/mol
  subtitle: string;
}

const GAS_R = 8.31446261815324;
const SAMPLE_COUNT = 200;
const Z_MAX_KM = 80;

const PLANETS: PlanetConfig[] = [
  { id: 'earth', name: 'Tierra', gravity: 9.81, p0: 101325, t0: 288.15, molarMass: 0.02897, subtitle: '1 g • 1 atm • N₂/O₂' },
  { id: 'mars', name: 'Marte', gravity: 3.72, p0: 610, t0: 210, molarMass: 0.04334, subtitle: '0.38 g • 0.006 atm • CO₂' },
  { id: 'venus', name: 'Venus', gravity: 8.87, p0: 9.2e6, t0: 737, molarMass: 0.04345, subtitle: '0.9 g • 92 atm • Efecto invernadero' },
  { id: 'jupiter', name: 'Júpiter', gravity: 24.79, p0: 100000, t0: 165, molarMass: 0.0023, subtitle: '2.5 g • Gigante gaseoso' },
];

const MODEL_META: Record<CurveModel, { color: string; bgClass: string; borderClass: string; textClass: string; name: string }> = {
  lapse_rate: { color: '#fbbf24', bgClass: 'bg-amber-500/10 border-amber-500/30', borderClass: 'border-amber-500', textClass: 'text-amber-400', name: 'Gradiente Constante (dT/dz)' },
  isothermal: { color: '#38bdf8', bgClass: 'bg-sky-500/10 border-sky-500/30', borderClass: 'border-sky-500', textClass: 'text-sky-400', name: 'Isotérmico (T cte)' },
  incompressible: { color: '#94a3b8', bgClass: 'bg-slate-500/10 border-slate-500/30', borderClass: 'border-slate-500', textClass: 'text-slate-400', name: 'Incompresible (ρ cte)' },
  homentropic: { color: '#f472b6', bgClass: 'bg-pink-500/10 border-pink-500/30', borderClass: 'border-pink-500', textClass: 'text-pink-400', name: 'Adiabático / Homentrópico' },
};

interface SegmentData {
  id: string;
  model: CurveModel;
  zMax: number;
  lapseRate: number; // K/km
  gamma: number;
}

interface CurvePoint {
  zKm: number;
  pKPa: number;
  rho: number;
  tC: number; // Celsius
}

const VENUS_PROFILE_TABLE = [
  { zKm: 0, tC: 462, pAtm: 92.1 },
  { zKm: 5, tC: 424, pAtm: 66.65 },
  { zKm: 10, tC: 385, pAtm: 47.39 },
  { zKm: 15, tC: 348, pAtm: 33.04 },
  { zKm: 20, tC: 306, pAtm: 22.52 },
  { zKm: 25, tC: 264, pAtm: 14.93 },
  { zKm: 30, tC: 222, pAtm: 9.851 },
  { zKm: 35, tC: 180, pAtm: 5.917 },
  { zKm: 40, tC: 143, pAtm: 3.501 },
  { zKm: 45, tC: 110, pAtm: 1.979 },
  { zKm: 50, tC: 75, pAtm: 1.066 },
  { zKm: 55, tC: 27, pAtm: 0.5314 },
  { zKm: 60, tC: -10, pAtm: 0.2357 },
  { zKm: 65, tC: -30, pAtm: 0.09765 },
  { zKm: 70, tC: -43, pAtm: 0.0369 },
  { zKm: 80, tC: -76, pAtm: 0.00476 },
];

function makeAltitudeGrid() {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => (i / (SAMPLE_COUNT - 1)) * Z_MAX_KM);
}

function buildEarthReferenceProfile(): CurvePoint[] {
  const g0 = 9.80665;
  const M = 0.0289644;
  const layers = [0, 11000, 20000, 32000, 47000, 51000, 71000];
  const layerTops = [11000, 20000, 32000, 47000, 51000, 71000, 84852];
  const lapseRates = [-0.0065, 0, 0.001, 0.0028, 0, -0.0028, -0.002];
  const baseT = [288.15, 216.65, 216.65, 228.65, 270.65, 270.65, 214.65];
  const baseP = [101325, 22632.1, 5474.89, 868.019, 110.906, 66.9389, 3.95642];

  return makeAltitudeGrid().map((zKm) => {
    const h = zKm * 1000;
    let idx = layers.length - 1;
    for (let i = 0; i < layers.length; i++) {
        if (h >= layers[i] && h <= layerTops[i]) { idx = i; break; }
    }
    const hb = layers[idx], tb = baseT[idx], pb = baseP[idx], lapse = lapseRates[idx];
    const dh = Math.max(0, h - hb);
    let tK = tb, pPa = pb;
    
    if (Math.abs(lapse) < 1e-12) {
      pPa = pb * Math.exp((-g0 * M * dh) / (GAS_R * tb));
    } else {
      tK = tb + lapse * dh;
      pPa = pb * Math.pow(tb / tK, (g0 * M) / (GAS_R * lapse));
    }
    return { zKm, pKPa: pPa / 1000, rho: (pPa * M) / (GAS_R * tK), tC: tK - 273.15 };
  });
}

function buildMarsReference(): CurvePoint[] {
  const H = 11100, lapse_Km = 2.5, t0 = 210, p0 = 610, M = 0.04334;
  return makeAltitudeGrid().map((zKm) => {
    const tK = Math.max(130, t0 - lapse_Km * zKm);
    const pPa = p0 * Math.exp(-(zKm * 1000) / H);
    return { zKm, pKPa: pPa / 1000, rho: (pPa * M) / (GAS_R * tK), tC: tK - 273.15 };
  });
}

function buildVenusReference(M: number): CurvePoint[] {
  const zGrid = makeAltitudeGrid();
  return zGrid.map((zKm) => {
    let i = 0;
    while (i < VENUS_PROFILE_TABLE.length - 2 && zKm > VENUS_PROFILE_TABLE[i + 1].zKm) i++;
    const a = VENUS_PROFILE_TABLE[i], b = VENUS_PROFILE_TABLE[Math.min(i + 1, VENUS_PROFILE_TABLE.length - 1)];
    const ratio = b.zKm === a.zKm ? 0 : (zKm - a.zKm) / (b.zKm - a.zKm);
    const tC = a.tC + ratio * (b.tC - a.tC);
    const pAtm = a.pAtm + ratio * (b.pAtm - a.pAtm);
    const tK = tC + 273.15, pPa = pAtm * 101325;
    return { zKm, pKPa: pPa / 1000, rho: (pPa * M) / (GAS_R * tK), tC };
  });
}

function buildJupiterReference(M: number): CurvePoint[] {
  return makeAltitudeGrid().map((zKm) => {
    let tK = 0, pBar = 0;
    if (zKm <= 50) {
      tK = 165 + ((110 - 165) * zKm) / 50;
      pBar = Math.exp(Math.log(1) + ((Math.log(0.1) - Math.log(1)) * zKm) / 50);
    } else {
      tK = 110 + ((200 - 110) * (zKm - 50)) / (320 - 50);
      pBar = 0.1 * Math.exp((Math.log(1e-6 / 0.1) * (zKm - 50)) / (320 - 50));
    }
    const pPa = pBar * 1e5;
    return { zKm, pKPa: pPa / 1000, rho: (pPa * M) / (GAS_R * tK), tC: tK - 273.15 };
  });
}

function buildReferenceProfile(planet: PlanetConfig): CurvePoint[] {
  if (planet.id === 'earth') return buildEarthReferenceProfile();
  if (planet.id === 'mars') return buildMarsReference();
  if (planet.id === 'venus') return buildVenusReference(planet.molarMass);
  return buildJupiterReference(planet.molarMass);
}

function interpolateRefPressure(referencePts: CurvePoint[], targetZ: number) {
  if (!referencePts || referencePts.length === 0) return 0;
  if (targetZ <= referencePts[0].zKm) return referencePts[0].pKPa;
  if (targetZ >= referencePts[referencePts.length - 1].zKm) return referencePts[referencePts.length - 1].pKPa;

  for (let i = 0; i < referencePts.length - 1; i++) {
    if (targetZ >= referencePts[i].zKm && targetZ <= referencePts[i+1].zKm) {
      const p1 = referencePts[i];
      const p2 = referencePts[i+1];
      const t = (targetZ - p1.zKm) / (p2.zKm - p1.zKm);
      return p1.pKPa + t * (p2.pKPa - p1.pKPa);
    }
  }
  return 0;
}

function getFieldValue(point: CurvePoint, field: FieldId) {
  if (field === 'pressure') return point.pKPa;
  if (field === 'density') return point.rho;
  return point.tC;
}

function formatTick(val: number) {
  if (Math.abs(val) >= 10000) return val.toExponential(1);
  if (Math.abs(val) < 0.01 && val !== 0) return val.toExponential(1);
  return Number.isInteger(val) ? val.toString() : val.toFixed(1);
}

function formatPressTick(val: number) {
  if (val > 999) return (val/1000).toFixed(1) + 'M';
  if (val < 0.01 && val > 0) return val.toExponential(0);
  if (val < 1) return val.toFixed(2);
  return val.toFixed(0);
}

function PlanetIcon({ id, className }: { id: string; className?: string }) {
  const styles: Record<string, string> = {
    earth: 'bg-gradient-to-br from-[#3b82f6] to-[#10b981] shadow-[0_0_8px_rgba(59,130,246,0.3)]',
    mars: 'bg-gradient-to-br from-[#ef4444] to-[#fb923c] shadow-[0_0_8px_rgba(239,68,68,0.3)]',
    venus: 'bg-gradient-to-br from-[#fcd34d] to-[#f97316] shadow-[0_0_8px_rgba(245,158,11,0.3)]',
    jupiter: 'bg-gradient-to-br from-[#d97706] via-[#fcd34d] to-[#a8a29e] shadow-[0_0_8px_rgba(217,119,6,0.3)]',
  };
  return <div className={cn('rounded-full border border-white/20 relative overflow-hidden', styles[id] || 'bg-slate-500', className)} />;
}

// ------ BACKGROUND LANDSCAPES WITH ANIMATIONS ------
function PlanetLandscape({ planetId }: { planetId: PlanetId }) {
  switch (planetId) {
    case 'earth':
      return (
        <svg className="absolute inset-0 w-full h-[120%] pointer-events-none preserve-aspect-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="earth-atm" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
              <stop offset="40%" stopColor="#0284c7" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#earth-atm)" />

          {/* Nubes movedizas transparentosas */}
          <g fill="#ffffff" opacity="0.25">
            <path d="M 0,20 Q 5,18 10,21 T 20,20 T 30,23 T 25,26 Q 15,28 10,25 T 0,20 Z" filter="blur(1px)">
               <animateTransform attributeName="transform" type="translate" from="-40,0" to="110,0" dur="40s" repeatCount="indefinite" />
            </path>
            <path d="M 10,40 Q 18,35 25,38 T 40,40 T 35,44 Q 25,48 18,44 T 10,40 Z" filter="blur(1.5px)" opacity="0.15">
               <animateTransform attributeName="transform" type="translate" from="-60,0" to="120,0" dur="55s" repeatCount="indefinite" />
            </path>
            <path d="M 0,60 Q 8,55 15,58 T 30,60 T 25,64 Q 15,68 8,64 T 0,60 Z" filter="blur(2px)" opacity="0.3">
               <animateTransform attributeName="transform" type="translate" from="-20,0" to="130,0" dur="25s" repeatCount="indefinite" />
            </path>
          </g>

          {/* Suelo Terrestre verde */}
          <g transform="translate(0, 75) scale(1, 0.25)">
            <path d="M0,100 L0,50 Q15,40 30,60 T60,50 T100,55 L100,100 Z" fill="#065f46" />
            <path d="M0,100 L0,70 Q20,60 40,80 T80,60 L100,75 L100,100 Z" fill="#064e3b" />
          </g>
        </svg>
      );
    case 'mars':
      return (
        <svg className="absolute inset-0 w-full h-[120%] pointer-events-none preserve-aspect-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="mars-atm" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#c2410c" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#9a3412" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#mars-atm)" />

          {/* Ondas de polvo rojizo */}
          <g opacity="0.3" fill="none" stroke="#ea580c" strokeWidth="8" filter="blur(4px)">
             <path d="M-20,40 Q 20,30 50,45 T 120,40">
                <animateTransform attributeName="transform" type="translate" from="-10,0" to="10,0" dur="8s" repeatCount="indefinite" direction="alternate" />
             </path>
             <path d="M-20,60 Q 30,70 60,55 T 120,60" opacity="0.5" stroke="#f97316" strokeWidth="12">
                <animateTransform attributeName="transform" type="translate" from="0,0" to="15,0" dur="12s" repeatCount="indefinite" direction="alternate" />
             </path>
          </g>

          <g transform="translate(0, 70) scale(1, 0.3)">
            <path d="M0,100 L0,50 L10,35 L25,45 L40,25 L60,55 L80,40 L100,60 L100,100 Z" fill="#7c2d12" />
            <path d="M0,100 L0,70 L20,60 L45,80 L70,50 L100,75 L100,100 Z" fill="#431407" />
          </g>
        </svg>
      );
    case 'venus':
      return (
        <svg className="absolute inset-0 w-full h-[120%] pointer-events-none preserve-aspect-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ven-atm" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ca8a04" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#854d0e" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#422006" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="#451a03" opacity="0.5" />
          <rect width="100" height="100" fill="url(#ven-atm)" />
          
          <g fill="#fef08a" opacity="0.15" filter="blur(3px)">
             <path d="M-20,30 Q 30,20 60,40 T 120,35 L120,50 L-20,50 Z">
               <animateTransform attributeName="transform" type="translate" from="-10,0" to="20,0" dur="15s" repeatCount="indefinite" direction="alternate" />
             </path>
          </g>
          
          <g transform="translate(0, 85) scale(1, 0.15)">
             <path d="M0,100 L0,50 Q20,30 40,70 T80,40 L100,60 L100,100 Z" fill="#291202" />
          </g>
        </svg>
      );
    case 'jupiter':
      return (
        <svg className="absolute inset-0 w-full h-[120%] pointer-events-none preserve-aspect-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect width="100" height="100" fill="#78350f" opacity="0.5" />
          <defs>
            <linearGradient id="jup-atm" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#9a3412" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#jup-atm)" />

          {/* Bandas de gas moviéndose en direcciones opuestas */}
          <g fill="none" strokeWidth="15" filter="blur(3px)" opacity="0.4">
             <path d="M-20,20 Q 30,25 60,15 T 120,20" stroke="#fcd34d">
                <animateTransform attributeName="transform" type="translate" from="0,0" to="30,0" dur="20s" repeatCount="indefinite" />
             </path>
             <path d="M-20,45 Q 40,40 70,50 T 130,45" stroke="#ea580c">
                <animateTransform attributeName="transform" type="translate" from="30,0" to="0,0" dur="25s" repeatCount="indefinite" />
             </path>
             <path d="M-20,70 Q 20,75 50,65 T 120,70" stroke="#fef08a" opacity="0.3">
                <animateTransform attributeName="transform" type="translate" from="-10,0" to="40,0" dur="18s" repeatCount="indefinite" />
             </path>
             <path d="M-20,90 Q 30,85 80,95 T 130,90" stroke="#c2410c">
                <animateTransform attributeName="transform" type="translate" from="25,0" to="-5,0" dur="30s" repeatCount="indefinite" />
             </path>
          </g>
        </svg>
      );
    default:
      return null;
  }
}

export default function ParallelAtmospheres() {
  const [planetId, setPlanetId] = useState<PlanetId>('earth');
  const [field, setField] = useState<FieldId>('temperature');
  const [showRef, setShowRef] = useState(true);

  const planet = useMemo(() => PLANETS.find((item) => item.id === planetId) ?? PLANETS[0], [planetId]);

  // Superficie base custom
  const [surface, setSurface] = useState({ t0: 288.15, p0: 101.325 });
  
  // Tramos consecutivos
  const [segments, setSegments] = useState<SegmentData[]>([
    { id: 's1', model: 'lapse_rate', zMax: 11, lapseRate: -6.5, gamma: 1.4 },
    { id: 's2', model: 'isothermal', zMax: 20, lapseRate: 0, gamma: 1.4 }
  ]);

  const handlePlanetChange = (nextPlanetId: PlanetId) => {
    const p = PLANETS.find((item) => item.id === nextPlanetId) ?? PLANETS[0];
    setPlanetId(p.id);
    setSurface({ t0: p.t0, p0: p.p0 / 1000 });
  };

  // Referencia
  const referencePts = useMemo(() => buildReferenceProfile(planet), [planet]);

  // Perfil Estudiante Dividido por Grupos de Color (Modelos)
  const customProfileGroups = useMemo(() => {
    if (segments.length === 0) return [];
    const groups: { id: string; model: CurveModel; points: CurvePoint[] }[] = [];
    
    let z0 = 0;
    let t0 = Math.max(10, surface.t0);
    const mP0 = Math.max(0.001, surface.p0);
    let p0_Pa = mP0 * 1000;
    const g = planet.gravity;
    const M = planet.molarMass;

    for (const seg of segments) {
      const zMax = Math.max(z0 + 0.1, seg.zMax);
      const steps = Math.min(100, Math.ceil((zMax - z0) * 10)); 
      const zStep = (zMax - z0) / steps;
      let pts: CurvePoint[] = [];

      // Conectar visualmente con el tramo anterior
      if (groups.length > 0) {
        const prevGroup = groups[groups.length - 1].points;
        const lastPt = prevGroup[prevGroup.length - 1];
        pts.push({ ...lastPt });
      } else {
        pts.push({ zKm: 0, pKPa: p0_Pa / 1000, rho: (p0_Pa * M) / (GAS_R * t0), tC: t0 - 273.15 });
      }

      for(let i = 1; i <= steps; i++) {
        const zKm = z0 + i * zStep;
        const dz_m = (zKm - z0) * 1000;

        let pPa = 0;
        let tK = t0;
        let rho = 0;

        if (seg.model === 'isothermal') {
          tK = t0;
          const H = (GAS_R * tK) / (M * g);
          pPa = p0_Pa * Math.exp(-dz_m / H);
        } else if (seg.model === 'lapse_rate') {
          const L_Km = seg.lapseRate / 1000;
          tK = Math.max(10, t0 + seg.lapseRate * (zKm - z0));
          if (Math.abs(L_Km) < 1e-10) {
            pPa = p0_Pa * Math.exp((-g * M * dz_m) / (GAS_R * t0));
          } else {
            pPa = p0_Pa * Math.pow(t0 / tK, (g * M) / (GAS_R * L_Km));
          }
        } else if (seg.model === 'incompressible') {
          const rhoConst = (p0_Pa * M) / (GAS_R * t0);
          pPa = Math.max(0.001, p0_Pa - rhoConst * g * dz_m);
          tK = t0; // Assume isothermal for density logic fallback
        } else if (seg.model === 'homentropic') {
          const gamma = Math.max(1.01, seg.gamma);
          const cp = (gamma / (gamma - 1)) * (GAS_R / M);
          const dTdz_m = g / cp;
          tK = Math.max(10, t0 - dTdz_m * dz_m);
          const ratio = tK / t0;
          pPa = p0_Pa * Math.pow(ratio, gamma / (gamma - 1));
        }

        rho = (pPa * M) / (GAS_R * tK);
        pts.push({ zKm, pKPa: pPa / 1000, rho, tC: tK - 273.15 });
      }

      groups.push({ id: seg.id, model: seg.model, points: pts });

      if (pts.length > 0) {
        const last = pts[pts.length - 1];
        z0 = zMax;
        t0 = last.tC + 273.15;
        p0_Pa = last.pKPa * 1000;
      }
    }
    return groups;
  }, [segments, surface, planet]);

  const customProfileFlat = useMemo(() => customProfileGroups.flatMap(g => g.points), [customProfileGroups]);

  const bounds = useMemo(() => {
    const allPts = [...(showRef ? referencePts : []), ...customProfileFlat];
    if (allPts.length === 0) return { xMin: 0, xMax: 100, yMin: 0, yMax: Z_MAX_KM };

    const xVals = allPts.map(p => getFieldValue(p, field));
    const yVals = allPts.map(p => p.zKm); // Y axis is always height now

    const xMinOrig = Math.min(...xVals);
    const xMaxOrig = Math.max(...xVals);
    const yMinOrig = Math.min(...yVals);
    const yMaxOrig = Math.max(...yVals);

    const dx = xMaxOrig - xMinOrig || 1;
    const dy = yMaxOrig - yMinOrig || 1;

    return {
      xMin: xMinOrig - dx * 0.05,
      xMax: xMaxOrig + dx * 0.05,
      yMin: yMinOrig, // Always start nicely from 0 or slightly below
      yMax: yMaxOrig + dy * 0.05,
    };
  }, [referencePts, customProfileFlat, field, showRef]);

  const xLabel = field === 'temperature' ? 'Temperatura [°C]' : field === 'pressure' ? 'Presión [kPa]' : 'Densidad [kg/m³]';
  
  const chartWidth = 900;
  const chartHeight = 600;
  // Make wide margins for Left (Altitude) and Right (Pressure reference)
  const margins = { top: 30, right: 90, bottom: 65, left: 80 }; 
  const innerW = chartWidth - margins.left - margins.right;
  const innerH = chartHeight - margins.top - margins.bottom;

  const mapX = (val: number) => margins.left + innerW * ((val - bounds.xMin) / (bounds.xMax - bounds.xMin || 1));
  const mapY = (val: number) => {
    const t = (val - bounds.yMin) / (bounds.yMax - bounds.yMin || 1);
    return margins.top + innerH * (1 - t); // Altitude normal direction (upwards)
  };

  const addSegment = () => {
    const lastZ = segments.length > 0 ? segments[segments.length - 1].zMax : 0;
    setSegments(prev => [...prev, { id: Date.now().toString(), model: 'isothermal', zMax: lastZ + 10, lapseRate: 0, gamma: 1.4 }]);
  };
  const updateSegment = (index: number, updates: Partial<SegmentData>) => {
    const newSegs = [...segments];
    newSegs[index] = { ...newSegs[index], ...updates };
    setSegments(newSegs);
  };
  const removeSegment = (index: number) => {
    setSegments(prev => prev.filter((_, i) => i !== index));
  };


  return (
    <div className="h-full min-h-0 flex flex-col gap-4 text-slate-100 font-sans p-2 overflow-hidden bg-[#020617]">
      {/* Pestañas Superiores */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-900 border border-white/5 p-3 rounded-2xl shrink-0 shadow-lg relative z-10">
        <div className="flex flex-wrap gap-2">
          {PLANETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePlanetChange(p.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-200',
                planetId === p.id
                  ? 'border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400/20'
                  : 'border-white/5 bg-slate-800/50 hover:bg-slate-800'
              )}
            >
              <PlanetIcon id={p.id} className="w-6 h-6 flex-shrink-0 border-2" />
              <div className="text-left hidden sm:block">
                <div className={cn('text-sm font-bold', planetId === p.id ? 'text-cyan-50' : 'text-slate-300')}>{p.name}</div>
                <div className="text-[10px] text-slate-500 max-w-[130px] truncate">{p.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-black/40 rounded-lg border border-white/5 shrink-0">
          <Mountain className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-mono text-slate-200 tracking-wider">g = {planet.gravity.toFixed(2)} m/s²</span>
        </div>
      </div>

      <section className="flex flex-col lg:flex-row gap-4 min-h-0 flex-1 relative z-0">
        
        {/* Editor de Tramos (Izquierda) */}
        <aside className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-4 min-h-0">
          
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col shadow-lg">
             <div className="flex gap-2">
                <button className={cn("flex-1 flex flex-col items-center justify-center gap-1 rounded-lg py-2 px-1 border transition-colors", field === 'temperature' ? 'border-amber-400/50 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-slate-950/50 text-slate-500')} onClick={() => setField('temperature')}>
                  <Thermometer className="w-4 h-4" /><span className="text-[10px] uppercase font-bold">Temp</span>
                </button>
                <button className={cn("flex-1 flex flex-col items-center justify-center gap-1 rounded-lg py-2 px-1 border transition-colors", field === 'pressure' ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-300' : 'border-white/10 bg-slate-950/50 text-slate-500')} onClick={() => setField('pressure')}>
                  <Wind className="w-4 h-4" /><span className="text-[10px] uppercase font-bold">Presión</span>
                </button>
                <button className={cn("flex-1 flex flex-col items-center justify-center gap-1 rounded-lg py-2 px-1 border transition-colors", field === 'density' ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-slate-950/50 text-slate-500')} onClick={() => setField('density')}>
                  <Droplets className="w-4 h-4" /><span className="text-[10px] uppercase font-bold">Densidad</span>
                </button>
             </div>
          </div>

          <div className="flex-1 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-lg">
            <div className="flex justify-between items-center py-3 px-4 border-b border-black/40 shadow-sm bg-slate-800/20">
              <h2 className="text-sm font-semibold text-slate-200">Constructor de Perfil</h2>
              <button 
                 onClick={addSegment} 
                 className="text-xs font-semibold flex items-center gap-1 bg-indigo-600 border border-indigo-500/50 text-white px-2.5 py-1.5 rounded-lg hover:bg-indigo-500 hover:scale-105 transition-all shadow-[0_0_10px_rgba(79,70,229,0.4)]"
              >
                <Plus className="w-3.5 h-3.5" /> Tramo
              </button>
            </div>

            <div className="p-3 space-y-3 overflow-y-auto min-h-0 flex-1 custom-scrollbar">
              
              {/* Condiciones Iniciales (Superficie) */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 relative shadow-inner">
                <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-md opacity-100 bg-slate-400" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex justify-between items-center pl-2">
                  <span>🌍 Superficie (z = 0 km)</span>
                </h3>
                <div className="grid grid-cols-2 gap-2 pl-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">Temperatura T₀ [K]</span>
                    <input type="number" step="1" value={surface.t0} onChange={e => setSurface(s => ({ ...s, t0: Number(e.target.value)}))} className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded px-2 py-1.5 outline-none focus:border-slate-400 transition-colors" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">Presión P₀ [kPa]</span>
                    <input type="number" step="0.1" value={surface.p0} onChange={e => setSurface(s => ({ ...s, p0: Number(e.target.value)}))} className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded px-2 py-1.5 outline-none focus:border-slate-400 transition-colors" />
                  </label>
                </div>
              </div>

              {/* Tramos Ensamblados */}
              {segments.map((seg, i) => {
                const zStart = i === 0 ? 0 : segments[i-1].zMax;
                const meta = MODEL_META[seg.model];
                
                return (
                  <div key={seg.id} className={cn("border rounded-xl p-3 relative group transition-all", meta.bgClass)}>
                    <div className={cn("absolute left-[-1px] top-3 bottom-0 w-1 opacity-80 border-l-2 border-dashed", meta.borderClass)} />
                    <div className="absolute left-[-3px] bottom-[-3px] w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    
                    <div className="flex items-center justify-between gap-2 pl-3 mb-3 border-b border-black/20 pb-2">
                      <span className={cn("text-xs font-bold uppercase tracking-wider", meta.textClass)}>Tramo {i+1}</span>
                      <button onClick={() => removeSegment(i)} className="text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pl-3 space-y-3">
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Modelo Físico Constante</span>
                          <select 
                            value={seg.model}
                            onChange={(e) => updateSegment(i, { model: e.target.value as CurveModel })}
                            className={cn(
                              "w-full text-xs font-bold border rounded-md px-2 py-1.5 outline-none appearance-none transition-colors",
                              meta.textClass, 
                              "bg-slate-900 border-black/30 hover:border-white/20 shadow-inner"
                            )}
                          >
                            <option value="lapse_rate" className="bg-slate-900 text-amber-400 font-medium">{MODEL_META.lapse_rate.name}</option>
                            <option value="isothermal" className="bg-slate-900 text-sky-400 font-medium">{MODEL_META.isothermal.name}</option>
                            <option value="incompressible" className="bg-slate-900 text-slate-300 font-medium">{MODEL_META.incompressible.name}</option>
                            <option value="homentropic" className="bg-slate-900 text-pink-400 font-medium">{MODEL_META.homentropic.name}</option>
                          </select>
                      </div>
                      
                      <div className="grid grid-cols-[1fr_80px] gap-2 items-end">
                         {/* Optional model parameters */}
                         <div className="flex-1">
                          {seg.model === 'lapse_rate' && (
                             <label className="flex flex-col gap-1">
                               <span className="text-[10px] uppercase font-bold text-slate-400">Gradiente dT/dz [K/km]</span>
                               <input type="number" step="0.5" value={seg.lapseRate} onChange={(e) => updateSegment(i, { lapseRate: Number(e.target.value) })} className="w-full text-xs font-mono bg-black/40 border border-black/30 rounded px-2 py-1.5 outline-none" />
                             </label>
                          )}
                          {seg.model === 'homentropic' && (
                             <label className="flex flex-col gap-1">
                               <span className="text-[10px] uppercase font-bold text-slate-400">Coef. Adiabático γ</span>
                               <input type="number" step="0.05" min="1.01" value={seg.gamma} onChange={(e) => updateSegment(i, { gamma: Number(e.target.value) })} className="w-full text-xs font-mono bg-black/40 border border-black/30 rounded px-2 py-1.5 outline-none" />
                             </label>
                          )}
                          {(seg.model === 'isothermal' || seg.model === 'incompressible') && (
                            <div className="text-[10px] text-slate-500 font-mono italic flex h-full items-center">
                              No requiere parámetros extra. Usa T₀ o ρ₀ inicial.
                            </div>
                          )}
                         </div>

                         <label className="flex flex-col gap-1">
                           <span className={cn("text-[10px] uppercase font-bold", meta.textClass)}>Hasta [Km]</span>
                           <input type="number" step="1" value={seg.zMax} min={zStart + 0.1} onChange={(e) => updateSegment(i, { zMax: Number(e.target.value) })} className={cn("w-full text-xs font-mono font-bold bg-black/50 border rounded px-2 py-1.5 outline-none", meta.borderClass, meta.textClass)} />
                         </label>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {segments.length === 0 && (
                <div className="text-center text-xs text-slate-500/70 italic p-6 border-2 border-dashed border-white/5 rounded-xl m-2">
                  No hay tramos construidos.<br/>Añade capas basales con "+ Tramo".
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Panel Principal: Gráfica + Paisaje Mejorado */}
        <div className="flex-1 bg-black/50 border border-white/10 rounded-2xl relative overflow-hidden shadow-2xl flex flex-col min-h-[400px]">
          
          <PlanetLandscape planetId={planetId} />

          {/* Opciones Visibles Sobre la Gráfica */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 pointer-events-none">
            <label className="pointer-events-auto flex items-center justify-end gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full shadow-lg cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => setShowRef(!showRef)}>
              <span className="text-xs font-semibold text-slate-300">Perfil de Referencia {planet.name}</span>
              <div className={cn("w-8 h-4 rounded-full p-0.5 transition-colors", showRef ? "bg-cyan-500" : "bg-slate-700")}>
                <div className={cn("w-3 h-3 rounded-full bg-white transition-transform", showRef ? "translate-x-4" : "")} />
              </div>
            </label>
             <div className="pointer-events-auto flex items-center justify-end gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full shadow-lg">
              <span className="text-xs font-bold text-indigo-400">Tu Perfil Ensamblado</span>
              <div className="flex items-center gap-[1px]">
                  {customProfileGroups.map((g, idx) => (
                    <div key={`dot-${idx}`} className="w-2 h-2 rounded-full" style={{backgroundColor: MODEL_META[g.model].color}} /> 
                  ))}
                  {customProfileGroups.length === 0 && <div className="w-2 h-2 rounded-full bg-slate-600" />}
              </div>
            </div>
          </div>

          {/* Ejes Twin en el SVG */}
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full absolute inset-0 font-sans z-10" preserveAspectRatio="none">
            {/* Axis Grid y Twin Labels */}
            <g className="grid-lines">
              {/* X-axis grids (vertical lines) & Labels */}
              {Array.from({ length: 9 }).map((_, i) => {
                const t = i / 8;
                const val = bounds.xMin + t * (bounds.xMax - bounds.xMin);
                const x = mapX(val);
                return (
                  <g key={`x-${i}`}>
                    <line x1={x} y1={margins.top} x2={x} y2={chartHeight - margins.bottom} stroke="#334155" strokeWidth={1} strokeDasharray="4 6" strokeOpacity={0.4} />
                    <text x={x} y={chartHeight - margins.bottom + 18} fill="#94a3b8" fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="hanging">
                      {formatTick(val)}
                    </text>
                  </g>
                );
              })}
              
              {/* Y-axis grids (horizontal lines) -> Map Altitude and get Ref Pressure */}
              {Array.from({ length: 9 }).map((_, i) => {
                const t = i / 8;
                const zAlt = bounds.yMin + t * (bounds.yMax - bounds.yMin); // Altitud (km)
                const y = mapY(zAlt);
                
                // Twin Axis: Pressure at this altitude
                const p_ref = interpolateRefPressure(referencePts, zAlt);

                return (
                  <g key={`y-${i}`}>
                    <line x1={margins.left} y1={y} x2={chartWidth - margins.right} y2={y} stroke="#334155" strokeWidth={1} strokeDasharray="4 6" strokeOpacity={0.4} />
                    
                    {/* LEFT AXIS LABEL: ALTITUDE [km] */}
                    <text x={margins.left - 12} y={y} fill="#94a3b8" fontSize={11} fontWeight={600} textAnchor="end" dominantBaseline="middle">
                      {formatTick(zAlt)}
                    </text>
                    
                    {/* RIGHT AXIS LABEL: TWIN Y PRESSURE [kPa] */}
                    <text x={chartWidth - margins.right + 12} y={y} fill="#38bdf8" fontSize={11} fontWeight={600} textAnchor="start" dominantBaseline="middle">
                      {formatPressTick(p_ref)}
                    </text>
                  </g>
                );
              })}

              {/* Box Lines */}
              <line x1={margins.left} y1={margins.top} x2={margins.left} y2={chartHeight - margins.bottom} stroke="#cbd5e1" strokeWidth={2} />
              <line x1={chartWidth - margins.right} y1={margins.top} x2={chartWidth - margins.right} y2={chartHeight - margins.bottom} stroke="#0ea5e9" strokeOpacity="0.4" strokeWidth={2} />
              <line x1={margins.left} y1={chartHeight - margins.bottom} x2={chartWidth - margins.right} y2={chartHeight - margins.bottom} stroke="#cbd5e1" strokeWidth={2} />

              {/* Axis Titles */}
              <text x={margins.left + innerW / 2} y={chartHeight - 15} fill="#f8fafc" fontSize={13} fontWeight="bold" textAnchor="middle" letterSpacing={1.5}>
                {xLabel.toUpperCase()}
              </text>
              <text x={24} y={margins.top + innerH / 2} fill="#f8fafc" fontSize={13} fontWeight="bold" textAnchor="middle" transform={`rotate(-90 24 ${margins.top + innerH / 2})`} letterSpacing={1}>
                ALTURA Z [km]
              </text>
              <text x={chartWidth - 20} y={margins.top + innerH / 2} fill="#38bdf8" fontSize={12} fontWeight="bold" textAnchor="middle" transform={`rotate(90 ${chartWidth - 20} ${margins.top + innerH / 2})`} letterSpacing={1.5}>
                PRESIÓN REF. [kPa]
              </text>
            </g>

            {/* Curva de Referencia NASA - Continua */}
            {showRef && referencePts.length > 0 && (
              <polyline
                fill="none"
                stroke="#ffffff"
                strokeWidth={3}
                strokeDasharray="6 6"
                opacity={0.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                points={referencePts.map((p) => `${mapX(getFieldValue(p, field)).toFixed(1)},${mapY(p.zKm).toFixed(1)}`).join(' ')}
              />
            )}

            {/* Curva del Estudiante - Tramos Colorizados y Transparentes */}
            {customProfileGroups.length > 0 && (
              <g>
                {customProfileGroups.map((group, i) => {
                   const meta = MODEL_META[group.model];
                   return (
                     <polyline
                       key={`seg-line-${i}`}
                       fill="none"
                       stroke={meta.color}
                       strokeWidth={5}
                       strokeOpacity={0.7} // Trasparencia solicitada
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       className="transition-all duration-300"
                       style={{ filter: `drop-shadow(0px 0px 8px ${meta.color}80)` }}
                       points={group.points.map((p) => `${mapX(getFieldValue(p, field)).toFixed(1)},${mapY(p.zKm).toFixed(1)}`).join(' ')}
                     />
                   );
                })}

                {/* Nodos de Intersección */}
                {customProfileGroups.map((group, i) => {
                  const pt = group.points[group.points.length - 1];
                  const cx = mapX(getFieldValue(pt, field));
                  const cy = mapY(pt.zKm);
                  return (
                    <g key={`pt-${i}`}>
                       <circle cx={cx} cy={cy} r={5} fill="#0f172a" stroke={MODEL_META[group.model].color} strokeWidth={2.5} className="shadow-lg" />
                       <text x={cx + 10} y={cy + 4} fill={MODEL_META[group.model].color} fontSize={10} fontWeight={700} className="drop-shadow-md">T{i+1}</text>
                    </g>
                  );
                })}
                
                {/* Punto Inicial (Superficie) */}
                {(() => {
                  const firstGroup = customProfileGroups[0];
                  if (!firstGroup || firstGroup.points.length === 0) return null;
                  const p0 = firstGroup.points[0];
                  const cx = mapX(getFieldValue(p0, field));
                  const cy = mapY(p0.zKm);
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={6} fill="#slate-800" stroke="#fff" strokeWidth={2} />
                      <text x={cx + 12} y={cy + 4} fill="#fff" fontSize={10} fontWeight={700}>SUP</text>
                    </g>
                  )
                })()}
              </g>
            )}
          </svg>

        </div>
      </section>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
      `}</style>
    </div>
  );
}
