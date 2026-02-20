import { Atom, ChevronLeft, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

export function Navbar() {
    const location = useLocation();
    const isHome = location.pathname === "/";

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-xl shadow-lg">
            <div className="container mx-auto flex h-16 items-center px-4 md:px-6 justify-between">
                
                {/* Left: Branding & Back Navigation */}
                <div className="flex items-center gap-4">
                    {!isHome && (
                        <Link 
                            to="/" 
                            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            title="Volver al Inicio"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                    )}
                    
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
                            <div className="relative rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-2 shadow-inner group-hover:scale-105 transition-transform duration-300">
                                <Atom className="h-6 w-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-bold tracking-tight text-white leading-none">
                                MCON <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Hub</span>
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors">
                                Medios Continuos
                            </span>
                        </div>
                    </Link>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4">
                    <Link 
                        to="/"
                        className={cn(
                            "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                            isHome 
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                                : "text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Home className="h-3.5 w-3.5" />
                        <span>Inicio</span>
                    </Link>

                    <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

                    <a 
                        href="https://www.udea.edu.co" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-bold text-slate-500 hover:text-emerald-400 transition-colors tracking-wide"
                    >
                        UdeA
                    </a>
                </div>
            </div>
        </nav>
    );
}
