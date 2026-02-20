import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react';

const Equation = ({ tex }: { tex: string }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) {
            katex.render(tex, ref.current, { throwOnError: false, displayMode: true });
        }
    }, [tex]);
    return <div ref={ref} className="my-4 overflow-x-auto" />;
};

const InlineEquation = ({ tex }: { tex: string }) => {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (ref.current) {
            katex.render(tex, ref.current, { throwOnError: false, displayMode: false });
        }
    }, [tex]);
    return <span ref={ref} />;
};

const Meniscus = () => {
    // --- State for Progressive Disclosure ---
    const [showSection1, setShowSection1] = useState(false);
    const [showSection3, setShowSection3] = useState(false); // Physics
    const [showSection5, setShowSection5] = useState(false); // Conclusion
    
    // Auto-scroll helper
    const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
        setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    };

    const section1Ref = useRef<HTMLDivElement>(null);
    const section3Ref = useRef<HTMLDivElement>(null);
    const section5Ref = useRef<HTMLDivElement>(null);

    return (
        <div className="w-full text-slate-200 font-sans pb-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <header className="text-center p-8 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-500/20 rounded-2xl shadow-xl backdrop-blur-sm">
                    <h1 className="text-4xl md:text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Deducción Interactiva</h1>
                    <h2 className="text-2xl md:text-3xl font-light opacity-90 text-blue-200">La Ecuación del Menisco</h2>
                    <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto">
                        Un viaje interactivo uniendo Geometría, Física y Cálculo para entender cómo los líquidos trepan por las paredes.
                    </p>
                </header>

                {/* Section 1: Phenomenon */}
                <section className="bg-slate-900/50 p-6 md:p-8 rounded-2xl shadow-lg border border-slate-800 transition-all hover:border-slate-700">
                    <h3 className="text-2xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                        El Fenómeno Físico
                    </h3>
                    <p className="text-lg text-slate-300 mb-6">
                        Cuando un líquido "trepa" por una pared, forma una curva llamada <strong>menisco</strong>. 
                        Esta forma es el resultado de un equilibrio perfecto entre fuerzas opuestas.
                    </p>
                    
                    {!showSection1 ? (
                        <button 
                            onClick={() => { setShowSection1(true); scrollToRef(section1Ref); }}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-all group border border-slate-700"
                        >
                            <span>Revelar las fuerzas</span>
                            <ChevronDown className="group-hover:translate-y-1 transition-transform"/>
                        </button>
                    ) : (
                        <div ref={section1Ref} className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
                             <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-5 bg-slate-800/50 rounded-xl border border-slate-700">
                                    <h4 className="font-bold text-lg text-slate-200 mb-2">1. La Gravedad</h4>
                                    <p className="text-slate-400 text-sm">Tira del líquido hacia abajo, buscando minimizar la energía potencial (una superficie plana).</p>
                                </div>
                                <div className="p-5 bg-slate-800/50 rounded-xl border border-slate-700">
                                    <h4 className="font-bold text-lg text-slate-200 mb-2">2. Tensión Superficial</h4>
                                    <p className="text-slate-400 text-sm">Actúa como una piel elástica que tira del líquido hacia arriba al adherirse a la pared.</p>
                                </div>
                             </div>

                             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex justify-center">
                                <svg viewBox="0 0 200 120" className="w-full max-w-lg overflow-visible">
                                    {/* Axes */}
                                    <line x1="10" y1="110" x2="190" y2="110" stroke="#475569" strokeWidth="1"/> 
                                    <line x1="20" y1="10" x2="20" y2="120" stroke="#475569" strokeWidth="1"/> 
                                    <text x="180" y="105" className="text-xs fill-slate-500 font-mono">x</text>
                                    <text x="5" y="20" className="text-xs fill-slate-500 font-mono">z</text>
                                    <text x="25" y="105" className="text-xs fill-slate-400">Pared</text>

                                    {/* Water Level */}
                                    <line x1="20" y1="90" x2="190" y2="90" stroke="#64748b" strokeWidth="1" strokeDasharray="4 4"/>
                                    <text x="170" y="85" className="text-xs fill-slate-500">z = 0</text>
                                    
                                    {/* Curve */}
                                    <path d="M 20 20 Q 40 88, 190 90" stroke="#38bdf8" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                    <text x="80" y="60" className="text-sm font-bold fill-sky-400">z(x)</text>
                                </svg>
                             </div>
                             <p className="text-center font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                                Objetivo: Encontrar la ecuación matemática <InlineEquation tex="z(x)" /> para esta curva.
                             </p>
                        </div>
                    )}
                </section>

                {/* Section 2: Geometry */}
                <section className="bg-slate-900/50 p-6 md:p-8 rounded-2xl shadow-lg border border-slate-800 transition-all hover:border-slate-700">
                    <h3 className="text-2xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                        La Herramienta Geométrica
                    </h3>
                    <p className="text-lg text-slate-300 mb-4">
                        Necesitamos describir la curvatura <InlineEquation tex="\kappa"/> (inverso del radio <InlineEquation tex="R"/>).
                    </p>
                    <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                         <Equation tex="\kappa = \frac{1}{R}" />
                    </div>

                    <details className="group bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden mt-4">
                        <summary className="font-bold text-slate-400 p-4 cursor-pointer hover:bg-slate-900 flex items-center justify-between select-none">
                            <span>Deducción de la Curvatura (Opcional)</span>
                            <ChevronRight className="group-open:rotate-90 transition-transform text-slate-500"/>
                        </summary>
                        <div className="p-6 border-t border-slate-800 space-y-6 text-slate-400">
                             <p>
                                La fórmula estándar es compleja. Usaremos una relación con el ángulo <InlineEquation tex="\theta"/>.
                                La pendiente es <InlineEquation tex="z' = \tan\theta"/>.
                             </p>
                             
                             <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-center">
                                 <svg viewBox="0 0 150 120" className="w-48 overflow-visible">
                                     <polygon points="20,100 120,100 120,20" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5"/>
                                     <line x1="20" y1="100" x2="120" y2="20" stroke="#38bdf8" strokeWidth="2"/>
                                     <text x="70" y="115" className="text-xs fill-slate-400" textAnchor="middle">1</text>
                                     <text x="135" y="60" className="text-xs fill-slate-400" textAnchor="middle">z&apos;</text>
                                     <path d="M 30 100 A 10 10 0 0 1 38.6 95" fill="none" stroke="#f43f5e" strokeWidth="1"/>
                                     <text x="45" y="90" className="text-xs fill-rose-500 font-bold">θ</text>
                                 </svg>
                             </div>

                             <div className="space-y-4">
                                <p>De la trigonometría:</p>
                                <div className="bg-slate-900/50 p-2 rounded">
                                    <Equation tex="\cos\theta = \frac{1}{\sqrt{1 + (z')^2}}" />
                                </div>
                                <p>Derivando con respecto a z (Regla de la Cadena):</p>
                                <div className="bg-yellow-500/10 p-3 rounded border border-yellow-500/20 text-sm text-yellow-200">
                                    <span className="font-bold text-yellow-400">Truco:</span> Usamos <InlineEquation tex="\frac{d}{dz} = \frac{1}{z'} \frac{d}{dx}"/> para cambiar la variable de integración.
                                </div>
                                <div className="bg-slate-900/50 p-2 rounded">
                                     <Equation tex="\frac{d}{dz}(\cos\theta) = - \frac{z''}{(1 + (z')^2)^{3/2}} = -\kappa" />
                                </div>
                                <p className="font-bold text-center text-slate-300">Resultado Clave:</p>
                                <div className="bg-slate-800 p-2 rounded border border-slate-700">
                                     <Equation tex="\kappa = - \frac{d}{dz}(\cos\theta)" />
                                </div>
                             </div>
                        </div>
                    </details>
                </section>

                {/* Section 3: Physics */}
                <section className="bg-slate-900/50 p-6 md:p-8 rounded-2xl shadow-lg border border-slate-800 transition-all hover:border-slate-700">
                    <h3 className="text-2xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                        El Principio Físico
                    </h3>
                    <p className="text-lg text-slate-300 mb-6">
                        En cada punto, la presión hidrostática debe equilibrar la presión de tensión superficial (Ley de Laplace).
                    </p>

                    {!showSection3 ? (
                        <button 
                            onClick={() => { setShowSection3(true); scrollToRef(section3Ref); }}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-all group border border-slate-700"
                        >
                            <span>Ver el balance</span>
                            <ChevronDown className="group-hover:translate-y-1 transition-transform"/>
                        </button>
                    ) : (
                        <div ref={section3Ref} className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
                             <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                                    <h4 className="font-bold text-slate-300">Presión Hidrostática</h4>
                                    <Equation tex="P = \rho g z" />
                                </div>
                                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                                    <h4 className="font-bold text-slate-300">Presión de Laplace</h4>
                                    <Equation tex="\Delta P = \alpha \kappa" />
                                </div>
                             </div>

                             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex justify-center">
                                <svg viewBox="0 0 200 120" className="w-full max-w-lg overflow-visible">
                                    <line x1="20" y1="110" x2="190" y2="110" stroke="#475569" strokeDasharray="4 4"/>
                                    <text x="170" y="105" className="text-xs fill-slate-500">z = 0</text>
                                    <line x1="20" y1="10" x2="20" y2="120" stroke="#475569" strokeWidth="1.5"/>
                                    <path d="M 20 20 Q 40 88, 190 90" stroke="#38bdf8" strokeWidth="2.5" fill="rgba(56, 189, 248, 0.2)"/>
                                    
                                    {/* Point */}
                                    <circle cx="80" cy="70" r="3" fill="#ef4444"/>
                                    <text x="90" y="70" className="text-xs fill-slate-400">(x, z)</text>

                                    {/* Arrows */}
                                    <line x1="80" y1="70" x2="80" y2="110" stroke="#94a3b8" strokeWidth="1.5"/>
                                    <text x="85" y="95" className="text-xs font-bold font-mono fill-slate-300">ρgz</text>
                                    
                                    {/* Laplace Arrow (Normal) */}
                                    <line x1="80" y1="70" x2="55" y2="45" stroke="#3b82f6" strokeWidth="1.5"/>
                                    <text x="40" y="40" className="text-xs font-bold fill-blue-400 font-mono">ακ</text>
                                </svg>
                             </div>

                             <div className="p-4 bg-blue-900/20 border border-blue-500/20 rounded-lg text-center">
                                  <p className="font-bold text-blue-300 mb-2">Ecuación de Equilibrio:</p>
                                  <Equation tex="\rho g z = \alpha \kappa" />
                             </div>
                        </div>
                    )}
                </section>

                {/* Section 4: Synthesis */}
                <section className="bg-slate-900/50 p-6 md:p-8 rounded-2xl shadow-lg border border-slate-800 transition-all hover:border-slate-700">
                    <h3 className="text-2xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
                        La Síntesis Matemática
                    </h3>
                    <p className="text-lg text-slate-300 mb-4">
                        Unimos las ecuaciones. Sustituimos <InlineEquation tex="\kappa"/>:
                    </p>
                    <div className="bg-slate-800/50 p-2 rounded">
                        <Equation tex="\rho g z = \alpha \left( - \frac{d}{dz}(\cos\theta) \right)" />
                    </div>
                    
                    <p className="text-slate-400 mt-4">Definiendo la longitud capilar <InlineEquation tex="R_c^2 = \alpha / \rho g"/> y reordenando:</p>
                    <div className="bg-slate-800/50 p-2 rounded">
                         <Equation tex="\frac{z}{R_c^2} = - \frac{d}{dz} (\cos\theta)" />
                    </div>
                    
                    <p className="text-slate-400 mt-4">Integrando respecto a <InlineEquation tex="z"/>:</p>
                    <div className="bg-black/40 text-green-400 p-6 rounded-xl font-mono text-sm overflow-x-auto shadow-inner border border-slate-800">
                        <Equation tex="\int \frac{z}{R_c^2} dz = \int - d(\cos\theta)" />
                        <Equation tex="\frac{z^2}{2R_c^2} + C = -\cos\theta" />
                    </div>
                </section>

                {/* Section 5: Conclusion */}
                <section className="bg-slate-900/50 p-6 md:p-8 rounded-2xl shadow-lg border border-slate-800 transition-all hover:border-slate-700">
                    <h3 className="text-2xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 w-8 h-8 rounded-full flex items-center justify-center text-sm">5</span>
                        Conclusión
                    </h3>
                    
                    {!showSection5 ? (
                        <button 
                            onClick={() => { setShowSection5(true); scrollToRef(section5Ref); }}
                            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-emerald-900/20"
                        >
                            <span>Ver Resultado Final</span>
                            <Eye className="w-5 h-5"/>
                        </button>
                    ) : (
                        <div ref={section5Ref} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                             <p className="text-lg text-slate-300">
                                 Usando la condición de borde (lejos de la pared, <InlineEquation tex="z=0, \theta=0 \implies C=-1"/>), obtenemos la altura en cualquier punto:
                             </p>
                             
                             <div className="p-6 bg-emerald-900/20 border border-emerald-500/30 rounded-xl text-center shadow-sm">
                                <h4 className="text-emerald-400 font-bold mb-4 uppercase tracking-wider text-sm">Altura Máxima en la Pared</h4>
                                <Equation tex="z_0 = \sqrt{2} R_c \sqrt{1 - \sin\alpha_c}" />
                                <p className="text-xs text-emerald-500/70 mt-2">(Donde <InlineEquation tex="\alpha_c"/> es el ángulo de contacto)</p>
                             </div>
                             
                             <div className="bg-slate-800 p-4 rounded-lg text-sm text-slate-400 text-center border border-slate-700">
                                 Esta ecuación permite predecir exactamente cuánto subirá el agua en un vaso o tubo capilar.
                             </div>
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
};

export default Meniscus;
