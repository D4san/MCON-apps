import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { FluidBackground } from "./FluidBackground";

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen font-sans text-slate-200 flex flex-col relative overflow-hidden">
            {/* Interactive Fluid Background */}
            <FluidBackground />

            <Navbar />
            
            <main className="flex-1 container mx-auto px-4 py-8 md:px-6 lg:py-12 relative z-10">
                {children}
            </main>
            
            <footer className="border-t border-white/5 py-8 mt-auto backdrop-blur-sm bg-slate-950/30">
                <div className="container mx-auto px-4 text-center">
                    <p className="text-sm text-slate-500">
                        &copy; {new Date().getFullYear()} Curso de Medios Continuos &bull; <span className="text-slate-400">Universidad de Antioquia</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-2">
                        Desarrollado para fines educativos e investigación.
                    </p>
                </div>
            </footer>
        </div>
    );
}
