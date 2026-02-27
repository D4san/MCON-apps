import { useParams, Link, Navigate } from "react-router-dom";
import { categories } from "../data/categories";
import { apps } from "../data/apps";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

export function CategoryPage() {
    const { categoryId } = useParams();
    const category = categories.find(c => c.id === categoryId);

    if (!category) {
        return <Navigate to="/" replace />;
    }

    const categoryApps = category.apps.map(appId => apps.find(a => a.id === appId)).filter(Boolean);

    return (
        <div className="min-h-screen relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
                <Link to="/" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors group">
                    <ArrowLeft className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-1" />
                    Volver al inicio
                </Link>

                <div className="mb-12 md:mb-16 animate-[fadeIn_0.8s_ease-out]">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={cn("p-3 rounded-2xl bg-gradient-to-br", category.color)}>
                            <category.icon className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight">
                            {category.title}
                        </h1>
                    </div>
                    <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
                        {category.description}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {categoryApps.map((app, index) => {
                        if (!app) return null;
                        
                        return (
                            <Link 
                                key={app.id} 
                                to={app.url || "#"}
                                className="group relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 rounded-2xl"
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <div className={cn(
                                    "h-full relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm transition-all duration-500 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-900/20 hover:-translate-y-2",
                                    "animate-[slideUp_0.6s_ease-out_forwards] opacity-0 flex flex-col"
                                )}>
                                    
                                    {/* Image Preview */}
                                    <div className="relative h-48 sm:h-56 w-full overflow-hidden border-b border-white/5 bg-slate-950">
                                        <img 
                                            src={app.image} 
                                            alt={`Captura de ${app.title}`} 
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                                            onError={(e) => {
                                                // Fallback if image is missing
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 p-6 relative z-10 flex flex-col">
                                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                                            {app.title}
                                        </h3>
                                        <p className="text-sm text-slate-300 leading-relaxed flex-1">
                                            {app.description}
                                        </p>
                                        
                                        <div className="pt-6 flex justify-end items-center mt-auto border-t border-white/5">
                                            <div className="flex items-center gap-2 text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                                                Abrir Simulación <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
