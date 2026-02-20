import { Link } from "react-router-dom";
import { apps } from "../data/apps";
import { ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

// App Imports for Live Previews
import DiscreteContinuous from "../apps/DiscreteContinuous/DiscreteContinuous";
import MeanFreePath from "../apps/MeanFreePath/MeanFreePath";
import Meniscus from "../apps/Meniscus/Meniscus";
import Deformations from "../apps/Deformations/Deformations";
import VelocityField from "../apps/VelocityField/VelocityField";
import EulerLagrange from "../apps/EulerLagrange/EulerLagrange";

const APP_COMPONENTS: Record<string, React.ComponentType<any>> = {
    "discreto-continuo": DiscreteContinuous,
    "camino-libre": MeanFreePath,
    "meniscos": Meniscus,
    "deformaciones": Deformations,
    "velocidades": VelocityField,
    "euler-lagrange": EulerLagrange
};

export function Dashboard() {
    return (
        <div className="space-y-12">
            
            {/* Hero Section */}
            <div className="text-center space-y-4 py-8 animate-[fadeIn_0.8s_ease-out]">
                <div className="flex justify-center mb-8">
                    <img src="/logo.png" alt="MConHub Logo" className="h-48 w-auto object-contain animate-[float_6s_ease-in-out_infinite] drop-shadow-2xl" />
                </div>
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white drop-shadow-2xl">
                    MCon<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Hub</span>
                    <span className="block text-3xl md:text-5xl mt-2 text-slate-300 font-light">Interactivo</span>
                </h1>
                <p className="max-w-2xl mx-auto text-lg text-slate-400 leading-relaxed">
                    Explore conceptos fundamentales de la mecánica del medio continuo a través de visualizaciones dinámicas y herramientas computacionales avanzadas.
                </p>
            </div>

            {/* Apps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 px-2 md:px-0">
                {apps.map((app, index) => {
                    const AppComponent = APP_COMPONENTS[app.id];
                    
                    return (
                        <Link 
                            key={app.id} 
                            to={app.url || "#"}
                            className="group relative block"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className={cn(
                                "h-full relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 transition-all duration-500 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-900/20 hover:-translate-y-2",
                                "animate-[slideUp_0.6s_ease-out_forwards] opacity-0 flex flex-col" // Entry animation
                            )}>
                                
                                {/* Live Preview Container */}
                                <div className="relative h-56 w-full overflow-hidden bg-slate-950 border-b border-white/5">
                                    {/* The App Component Scaled Down */}
                                    {AppComponent && (
                                        <div className="absolute inset-0 w-[200%] h-[200%] origin-top-left transform scale-50 pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                                            <AppComponent />
                                            {/* Overlay to ensure no interactions drift through and ensures uniform look */}
                                            <div className="absolute inset-0 bg-transparent z-50"></div>
                                        </div>
                                    )}
                                    
                                    {/* Gradient Overlay for Fade Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent pointer-events-none" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-6 relative z-10 flex flex-col">
                                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                                        {app.title}
                                    </h3>
                                    <p className="text-sm text-slate-300 leading-relaxed flex-1">
                                        {app.description}
                                    </p>
                                    
                                    {/* Footer: Learn More Link Only (Tags Removed) */}
                                    <div className="pt-6 flex justify-end items-center mt-auto border-t border-white/5">
                                        <div className="flex items-center gap-2 text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                                            Explorar <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
