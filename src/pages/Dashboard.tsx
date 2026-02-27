import { CategoryCards } from "../components/CategoryCards";

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
            <CategoryCards />
        </div>
    );
}
