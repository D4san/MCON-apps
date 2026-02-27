import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { HomeBackground, SolidBackground, HydroBackground, RestFluidBackground } from "./ThemeBackgrounds";

interface LayoutProps {
    children: ReactNode;
}

function ThemeBackground() {
    const location = useLocation();
    const path = location.pathname;

    if (path === "/") {
        return <HomeBackground />;
    }

    if (path.includes("solidos-y-esfuerzos") || path.includes("calc-deformaciones")) {
        return <SolidBackground />;
    }

    if (path.includes("hidrodinamica") || path.includes("velocity-field") || path.includes("euler-lagrange")) {
        return <HydroBackground />;
    }

    // Default for Fluidos en reposo and its apps
    return <RestFluidBackground />;
}

export function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const isHome = location.pathname === "/";
    const isCategory = location.pathname.startsWith("/category/");

    return (
        <div className={`font-sans text-slate-200 flex flex-col relative min-h-dvh ${(isHome || isCategory) ? 'overflow-x-hidden' : 'overflow-hidden'}`}>
            {/* Interactive Theme Background */}
            <ThemeBackground />

            <Navbar />
            
            <main className={`flex-1 w-full relative z-10 min-h-0 ${(isHome || isCategory) ? 'container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-8 lg:py-12' : 'overflow-hidden flex flex-col h-[calc(100vh-4rem)]'}`}>
                {children}
            </main>
            
            {(isHome || isCategory) && (
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
            )}
        </div>
    );
}

