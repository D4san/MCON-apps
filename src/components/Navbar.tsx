import { ChevronLeft, Home, Droplets, Cuboid, Waves, Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { cn } from "../lib/utils";

export function Navbar() {
    const location = useLocation();
    const isHome = location.pathname === "/";
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navLinks = [
        { path: "/category/fluidos-en-reposo", label: "Fluidos", icon: Droplets },
        { path: "/category/solidos-y-esfuerzos", label: "Sólidos", icon: Cuboid },
        { path: "/category/hidrodinamica", label: "Hidrodinámica", icon: Waves },
    ];

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-xl shadow-lg">
            <div className="container mx-auto flex h-16 items-center px-4 md:px-6 justify-between">
                
                {/* Left: Branding & Back Navigation */}
                <div className="flex items-center gap-4">
                    {!isHome && (
                        <Link 
                            to="/" 
                            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                            title="Volver al Inicio"
                            aria-label="Volver al inicio"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                    )}
                    
                    <Link to="/" className="flex items-center gap-2 sm:gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 rounded-lg">
                        <div className="relative flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                             <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
                            <img src="/logo.png" alt="MConHub Logo" className="h-10 sm:h-12 w-auto object-contain relative z-10" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base sm:text-lg font-bold tracking-tight text-white leading-none">
                                MCon<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Hub</span>
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider sm:tracking-widest group-hover:text-slate-400 transition-colors">
                                Interactivo
                            </span>
                        </div>
                    </Link>
                </div>

                {/* Center: Categories (Desktop) */}
                <div className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                    {navLinks.map((link) => {
                        const isActive = location.pathname === link.path;
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70",
                                    isActive 
                                        ? "bg-white/10 text-white" 
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {link.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3 sm:gap-4">
                    <Link 
                        to="/"
                        className={cn(
                            "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70",
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
                        className="text-xs font-bold text-slate-500 hover:text-emerald-400 transition-colors tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 rounded-sm hidden sm:block"
                    >
                        UdeA
                    </a>

                    {/* Mobile Menu Toggle */}
                    <button 
                        className="lg:hidden flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border border-blue-500/20 text-blue-400 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 rounded-full"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <span className="text-xs font-bold uppercase tracking-wider">Secciones</span>
                        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
                <div className="lg:hidden absolute top-16 left-0 w-full bg-slate-900 border-b border-slate-800 shadow-2xl animate-in slide-in-from-top-2">
                    <div className="flex flex-col p-4 gap-2">
                        {navLinks.map((link) => {
                            const isActive = location.pathname === link.path;
                            const Icon = link.icon;
                            return (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                        isActive 
                                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                                            : "text-slate-300 hover:bg-slate-800"
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                    {link.label}
                                </Link>
                            );
                        })}
                        <div className="h-px w-full bg-slate-800 my-2"></div>
                        <Link 
                            to="/"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-all"
                        >
                            <Home className="w-5 h-5" />
                            Inicio
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    );
}
