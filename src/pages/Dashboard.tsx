import { Link } from "react-router-dom";
import { categories } from "../data/categories";
import { ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

export function Dashboard() {
    return (
        <div className="space-y-10 md:space-y-12">
            
            {/* Hero Section */}
            <div className="text-center space-y-4 py-4 md:py-8 animate-[fadeIn_0.8s_ease-out]">
                <div className="flex justify-center mb-5 md:mb-8">
                    <img src="/logo.png" alt="MConHub Logo" className="h-28 sm:h-36 md:h-48 w-auto object-contain animate-[float_6s_ease-in-out_infinite] drop-shadow-2xl" />
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white drop-shadow-2xl">
                    MCon<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Hub</span>
                    <span className="block text-2xl sm:text-3xl md:text-5xl mt-2 text-slate-300 font-light">Interactivo</span>
                </h1>
                <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-400 leading-relaxed px-2">
                    Explore conceptos fundamentales de la mecánica del medio continuo a través de visualizaciones dinámicas y herramientas computacionales avanzadas.
                </p>
            </div>

            {/* Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 px-2 md:px-0">
                {categories.map((category, index) => {
                    const Icon = category.icon;
                    
                    return (
                        <Link 
                            key={category.id} 
                            to={`/category/${category.id}`}
                            className="group relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 rounded-2xl"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className={cn(
                                "h-full relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 transition-all duration-500 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-900/20 hover:-translate-y-2",
                                "animate-[slideUp_0.6s_ease-out_forwards] opacity-0 flex flex-col" // Entry animation
                            )}>
                                
                                {/* Visual Header */}
                                <div className={cn(
                                    "relative h-48 sm:h-56 w-full overflow-hidden border-b border-white/5",
                                    "bg-gradient-to-br",
                                    category.color
                                )}>
                                    <div className="absolute inset-0 bg-slate-950/55" />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_45%)]" />
                                    <div className="relative h-full w-full flex items-center justify-center">
                                        <Icon className="w-20 h-20 text-white/90 drop-shadow-[0_8px_25px_rgba(0,0,0,0.45)] transition-transform duration-500 group-hover:scale-110" />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-6 relative z-10 flex flex-col">
                                    <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">
                                        {category.title}
                                    </h3>
                                    <p className="text-base text-slate-300 leading-relaxed flex-1">
                                        {category.description}
                                    </p>
                                    
                                    {/* Footer */}
                                    <div className="pt-6 flex justify-between items-center mt-auto border-t border-white/5">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            {category.apps.length} {category.apps.length === 1 ? 'Simulación' : 'Simulaciones'}
                                        </span>
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
