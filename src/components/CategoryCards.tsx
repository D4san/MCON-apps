import { Link } from "react-router-dom";
import { categories } from "../data/categories";
import { ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";

const FluidosBackground = () => (
    <div className="absolute inset-0 overflow-hidden opacity-40 group-hover:opacity-70 transition-opacity duration-700">
        <motion.svg
            viewBox="0 0 800 400"
            className="absolute w-[200%] h-[200%] -top-[50%] -left-[50%]"
            preserveAspectRatio="none"
            animate={{
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 1],
            }}
            transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear"
            }}
        >
            <defs>
                <linearGradient id="fluid-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#2563eb" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#0369a1" stopOpacity="0.8" />
                </linearGradient>
                <filter id="blur-fluid">
                    <feGaussianBlur stdDeviation="20" />
                </filter>
            </defs>
            <motion.path
                d="M0,200 C150,300 250,100 400,200 C550,300 650,100 800,200 L800,400 L0,400 Z"
                fill="url(#fluid-grad)"
                filter="url(#blur-fluid)"
                animate={{
                    d: [
                        "M0,200 C150,300 250,100 400,200 C550,300 650,100 800,200 L800,400 L0,400 Z",
                        "M0,200 C150,100 250,300 400,200 C550,100 650,300 800,200 L800,400 L0,400 Z",
                        "M0,200 C150,300 250,100 400,200 C550,300 650,100 800,200 L800,400 L0,400 Z"
                    ]
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
            <motion.path
                d="M0,250 C200,150 300,350 500,250 C700,150 800,350 1000,250 L1000,400 L0,400 Z"
                fill="url(#fluid-grad)"
                filter="url(#blur-fluid)"
                opacity="0.6"
                animate={{
                    d: [
                        "M0,250 C200,150 300,350 500,250 C700,150 800,350 1000,250 L1000,400 L0,400 Z",
                        "M0,250 C200,350 300,150 500,250 C700,350 800,150 1000,250 L1000,400 L0,400 Z",
                        "M0,250 C200,150 300,350 500,250 C700,150 800,350 1000,250 L1000,400 L0,400 Z"
                    ]
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
        </motion.svg>
    </div>
);

const SolidosBackground = () => (
    <div className="absolute inset-0 overflow-hidden opacity-30 group-hover:opacity-60 transition-opacity duration-700">
        <motion.svg
            viewBox="0 0 400 400"
            className="absolute w-full h-full"
            animate={{
                rotateZ: [0, 90],
            }}
            transition={{
                duration: 40,
                repeat: Infinity,
                ease: "linear"
            }}
        >
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(244, 63, 94, 0.3)" strokeWidth="1" />
                </pattern>
                <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#881337" stopOpacity="0" />
                </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <motion.circle 
                cx="200" cy="200" r="150" 
                fill="url(#glow)"
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5]
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
            {/* Animated stress lines */}
            <motion.path
                d="M 100 100 L 300 300 M 300 100 L 100 300"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeDasharray="10 10"
                animate={{
                    strokeDashoffset: [0, 100]
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "linear"
                }}
            />
        </motion.svg>
    </div>
);

const HidrodinamicaBackground = () => (
    <div className="absolute inset-0 overflow-hidden opacity-40 group-hover:opacity-70 transition-opacity duration-700">
        <svg viewBox="0 0 400 400" className="absolute w-full h-full">
            <defs>
                <linearGradient id="stream-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                    <stop offset="50%" stopColor="#ea580c" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#9a3412" stopOpacity="0" />
                </linearGradient>
            </defs>
            {Array.from({ length: 15 }).map((_, i) => (
                <motion.path
                    key={i}
                    d={`M -100 ${50 + i * 20} Q ${100 + Math.random() * 100} ${50 + i * 20 + (Math.random() * 40 - 20)} 500 ${50 + i * 20}`}
                    fill="none"
                    stroke="url(#stream-grad)"
                    strokeWidth={Math.random() * 3 + 1}
                    strokeDasharray="200 200"
                    animate={{
                        strokeDashoffset: [400, -400]
                    }}
                    transition={{
                        duration: Math.random() * 3 + 2,
                        repeat: Infinity,
                        ease: "linear",
                        delay: Math.random() * 2
                    }}
                />
            ))}
        </svg>
    </div>
);

const Backgrounds = {
    "fluidos-en-reposo": FluidosBackground,
    "solidos-y-esfuerzos": SolidosBackground,
    "hidrodinamica": HidrodinamicaBackground
};

export function CategoryCards() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 px-2 md:px-0">
            {categories.map((category, index) => {
                const Icon = category.icon;
                const Background = Backgrounds[category.id as keyof typeof Backgrounds];
                
                return (
                    <motion.div
                        key={category.id}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                            duration: 0.7, 
                            delay: index * 0.15,
                            ease: [0.21, 0.47, 0.32, 0.98]
                        }}
                    >
                        <Link 
                            to={`/category/${category.id}`}
                            className="group relative block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 rounded-3xl"
                        >
                            <div className={cn(
                                "h-full relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl transition-all duration-500",
                                "hover:border-white/20 hover:shadow-2xl hover:-translate-y-2 flex flex-col",
                                category.id === "fluidos-en-reposo" && "hover:shadow-blue-500/20",
                                category.id === "solidos-y-esfuerzos" && "hover:shadow-rose-500/20",
                                category.id === "hidrodinamica" && "hover:shadow-orange-500/20"
                            )}>
                                {/* Noise overlay for the whole card */}
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 mix-blend-overlay pointer-events-none z-20" />
                                
                                {/* Visual Header */}
                                <div className={cn(
                                    "relative h-56 sm:h-64 w-full overflow-hidden border-b border-white/5",
                                    "bg-gradient-to-br",
                                    category.color
                                )}>
                                    <div className="absolute inset-0 bg-slate-950/60 mix-blend-multiply" />
                                    
                                    {Background && <Background />}

                                    <div className="relative h-full w-full flex items-center justify-center z-10">
                                        {/* Decorative outer rings */}
                                        <motion.div 
                                            className={cn(
                                                "absolute w-40 h-40 rounded-full border opacity-0 group-hover:opacity-100 transition-opacity duration-700",
                                                category.id === "fluidos-en-reposo" && "border-blue-400/30",
                                                category.id === "solidos-y-esfuerzos" && "border-rose-400/30",
                                                category.id === "hidrodinamica" && "border-orange-400/30"
                                            )}
                                            animate={{ rotate: 360, scale: [0.95, 1.05, 0.95] }}
                                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                        />
                                        <motion.div 
                                            className={cn(
                                                "absolute w-32 h-32 rounded-full border border-dashed opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100",
                                                category.id === "fluidos-en-reposo" && "border-blue-300/40",
                                                category.id === "solidos-y-esfuerzos" && "border-rose-300/40",
                                                category.id === "hidrodinamica" && "border-orange-300/40"
                                            )}
                                            animate={{ rotate: -360, scale: [1.05, 0.95, 1.05] }}
                                            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                        />

                                        {/* Main Icon Container */}
                                        <motion.div
                                            whileHover={{ scale: 1.1, rotate: category.id === "solidos-y-esfuerzos" ? 10 : 0 }}
                                            animate={{ y: [-4, 4, -4] }}
                                            transition={{ 
                                                y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                                                scale: { type: "spring", stiffness: 300, damping: 15 },
                                                rotate: { type: "spring", stiffness: 300, damping: 15 }
                                            }}
                                            className={cn(
                                                "relative flex items-center justify-center w-24 h-24 rounded-[2rem] backdrop-blur-md border shadow-2xl overflow-hidden transition-all duration-500",
                                                "bg-white/5 border-white/10 group-hover:border-white/30",
                                                category.id === "fluidos-en-reposo" && "group-hover:shadow-blue-500/50",
                                                category.id === "solidos-y-esfuerzos" && "group-hover:shadow-rose-500/50",
                                                category.id === "hidrodinamica" && "group-hover:shadow-orange-500/50"
                                            )}
                                            style={{
                                                boxShadow: `0 10px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.2), inset 0 0 20px 0 rgba(255,255,255,0.05)`
                                            }}
                                        >
                                            {/* Inner dynamic glow */}
                                            <div className={cn(
                                                "absolute inset-0 opacity-40 group-hover:opacity-80 transition-opacity duration-500 blur-xl",
                                                category.id === "fluidos-en-reposo" && "bg-blue-500/40",
                                                category.id === "solidos-y-esfuerzos" && "bg-rose-500/40",
                                                category.id === "hidrodinamica" && "bg-orange-500/40"
                                            )} />
                                            
                                            {/* Glass reflection */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-50" />

                                            {/* The Icon */}
                                            <Icon 
                                                className={cn(
                                                    "w-12 h-12 relative z-10 transition-colors duration-500 drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                                                    "text-white/90 group-hover:text-white"
                                                )} 
                                                strokeWidth={1.5} 
                                            />
                                        </motion.div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-8 relative z-10 flex flex-col bg-gradient-to-b from-transparent to-slate-950/50">
                                    <h3 className={cn(
                                        "text-3xl font-extrabold text-white mb-4 tracking-tight transition-colors duration-300",
                                        category.id === "fluidos-en-reposo" && "group-hover:text-blue-400",
                                        category.id === "solidos-y-esfuerzos" && "group-hover:text-rose-400",
                                        category.id === "hidrodinamica" && "group-hover:text-orange-400"
                                    )}>
                                        {category.title}
                                    </h3>
                                    <p className="text-base text-slate-400 leading-relaxed flex-1 font-medium">
                                        {category.description}
                                    </p>
                                    
                                    {/* Footer */}
                                    <div className="pt-8 flex justify-between items-center mt-auto">
                                        <div className="flex items-center gap-3">
                                            <span className={cn(
                                                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-inner",
                                                category.id === "fluidos-en-reposo" && "bg-blue-500/20 text-blue-300",
                                                category.id === "solidos-y-esfuerzos" && "bg-rose-500/20 text-rose-300",
                                                category.id === "hidrodinamica" && "bg-orange-500/20 text-orange-300"
                                            )}>
                                                {category.apps.length}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                {category.apps.length === 1 ? 'Simulación' : 'Simulaciones'}
                                            </span>
                                        </div>
                                        <div className={cn(
                                            "flex items-center gap-2 text-sm font-bold transition-colors duration-300",
                                            category.id === "fluidos-en-reposo" && "text-blue-500 group-hover:text-blue-400",
                                            category.id === "solidos-y-esfuerzos" && "text-rose-500 group-hover:text-rose-400",
                                            category.id === "hidrodinamica" && "text-orange-500 group-hover:text-orange-400"
                                        )}>
                                            Explorar 
                                            <motion.div
                                                className="inline-block"
                                                whileHover={{ x: 5 }}
                                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                            >
                                                <ArrowRight className="w-5 h-5" />
                                            </motion.div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </Link>
                    </motion.div>
                );
            })}
        </div>
    );
}
