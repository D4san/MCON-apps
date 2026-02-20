import { Link } from "react-router-dom";
import { apps } from "../data/apps";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

export function Dashboard() {
    return (
        <div className="space-y-12">
            
            {/* Hero Section */}
            <div className="text-center space-y-4 py-8 animate-[fadeIn_0.8s_ease-out]">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4 animate-[float_4s_ease-in-out_infinite]">
                    <Sparkles className="w-3 h-3" /> Curso de Medios Continuos
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-lg">
                    Simulaciones <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">Interactivas</span>
                </h1>
                <p className="max-w-2xl mx-auto text-lg text-slate-400 leading-relaxed">
                    Explore conceptos fundamentales de la mecánica del medio continuo a través de visualizaciones dinámicas y herramientas computacionales avanzadas.
                </p>
            </div>

            {/* Apps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 px-2 md:px-0">
                {apps.map((app, index) => {
                    const Icon = app.icon;
                    return (
                        <Link 
                            key={app.id} 
                            to={app.url || "#"}
                            className="group relative block"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className={cn(
                                "h-full relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-500",
                                "hover:border-slate-600 hover:shadow-2xl hover:shadow-blue-900/20 hover:-translate-y-2",
                                "animate-[slideUp_0.6s_ease-out_forwards] opacity-0" // Entry animation
                            )}>
                                
                                {/* Background Gradient Blob */}
                                <div className={cn(
                                    "absolute -top-20 -right-20 w-48 h-48 rounded-full blur-[60px] opacity-20 transition-all duration-700 group-hover:opacity-40 group-hover:scale-150",
                                    `bg-gradient-to-br ${app.color}`
                                )} />

                                {/* Icon */}
                                <div className={cn(
                                    "relative w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 shadow-lg",
                                    `bg-gradient-to-br ${app.color}`
                                )}>
                                    <Icon className="w-7 h-7 text-white" strokeWidth={2} />
                                </div>

                                {/* Content */}
                                <div className="relative z-10 space-y-3">
                                    <h3 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                                        {app.title}
                                    </h3>
                                    <p className="text-sm text-slate-400 leading-relaxed min-h-[60px]">
                                        {app.description}
                                    </p>
                                    
                                    {/* Link Text */}
                                    <div className="pt-4 flex items-center gap-2 text-sm font-semibold text-white/70 group-hover:text-cyan-400 transition-colors">
                                        Explorar Simulación <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>

                                {/* Tags */}
                                <div className="absolute bottom-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                                    {app.tags.slice(0,1).map(tag => (
                                        <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-950/50 text-[10px] text-slate-300 border border-slate-700">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
