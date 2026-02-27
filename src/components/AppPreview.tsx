import { cn } from "../lib/utils";

interface AppPreviewProps {
    appId: string;
    colorClass: string;
}

export function AppPreview({ appId, colorClass }: AppPreviewProps) {
    const renderPreview = () => {
        switch (appId) {
            case "discreto-continuo":
                return (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.3),transparent_70%)]" />
                        <div className="relative w-32 h-32 flex flex-wrap gap-1.5 animate-[morph_5s_ease-in-out_infinite_alternate] p-2">
                            {Array.from({ length: 64 }).map((_, i) => (
                                <div key={i} className="w-2.5 h-2.5 rounded-full bg-cyan-400/90 shadow-[0_0_8px_rgba(34,211,238,0.6)] transition-all duration-1000" />
                            ))}
                        </div>
                        <style>{`
                            @keyframes morph {
                                0% { gap: 6px; border-radius: 50%; transform: scale(0.8) rotate(0deg); }
                                50% { gap: 2px; border-radius: 20%; transform: scale(1) rotate(45deg); }
                                100% { gap: 0px; border-radius: 0%; transform: scale(1.2) rotate(90deg); filter: blur(1px); }
                            }
                        `}</style>
                    </div>
                );

            case "camino-libre":
                return (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.3),transparent_70%)]" />
                        {/* Static particles */}
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div key={i} className="absolute w-2 h-2 rounded-full bg-slate-700/50 backdrop-blur-sm" 
                                 style={{ 
                                     left: \`\${15 + (i * 27) % 70}%\`, 
                                     top: \`\${10 + (i * 31) % 80}%\` 
                                 }} 
                            />
                        ))}
                        {/* Moving particle */}
                        <div className="absolute w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,1)] animate-[bouncePath_8s_linear_infinite]" />
                        <style>{`
                            @keyframes bouncePath {
                                0% { transform: translate(-60px, -50px); }
                                20% { transform: translate(40px, -20px); }
                                40% { transform: translate(70px, 50px); }
                                60% { transform: translate(-10px, 70px); }
                                80% { transform: translate(-70px, 20px); }
                                100% { transform: translate(-60px, -50px); }
                            }
                        `}</style>
                    </div>
                );

            case "meniscos":
                return (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.3),transparent_70%)]" />
                        {/* Capillary tube */}
                        <div className="relative w-20 h-32 border-x-2 border-b-2 border-slate-600/50 rounded-b-xl flex items-end justify-center overflow-hidden backdrop-blur-sm bg-white/[0.02]">
                            {/* Water level */}
                            <div className="w-full bg-blue-500/40 relative animate-[rise_5s_ease-in-out_infinite_alternate]">
                                {/* Meniscus curve */}
                                <div className="absolute -top-3 left-0 w-full h-6 bg-slate-950 rounded-[50%]" />
                                <div className="absolute inset-0 bg-gradient-to-t from-blue-600/60 to-transparent" />
                                {/* Surface tension arrows */}
                                <div className="absolute -top-4 left-1 w-0.5 h-4 bg-blue-400/80 rotate-45" />
                                <div className="absolute -top-4 right-1 w-0.5 h-4 bg-blue-400/80 -rotate-45" />
                            </div>
                        </div>
                        <style>{`
                            @keyframes rise {
                                0% { height: 30px; }
                                100% { height: 90px; }
                            }
                        `}</style>
                    </div>
                );

            case "deformaciones":
                return (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950 perspective-[1000px]">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,rgba(244,63,94,0.3),transparent_70%)]" />
                        <div className="relative w-20 h-20 animate-[deform_6s_ease-in-out_infinite_alternate] preserve-3d">
                            {/* 3D Cube faces */}
                            <div className="absolute inset-0 border border-rose-400/60 bg-rose-500/10 translate-z-[40px] backdrop-blur-sm" />
                            <div className="absolute inset-0 border border-rose-400/60 bg-rose-500/10 -translate-z-[40px] backdrop-blur-sm" />
                            <div className="absolute inset-0 border border-rose-400/60 bg-rose-500/10 rotate-y-90 translate-x-[40px] backdrop-blur-sm" />
                            <div className="absolute inset-0 border border-rose-400/60 bg-rose-500/10 rotate-y-90 -translate-x-[40px] backdrop-blur-sm" />
                            <div className="absolute inset-0 border border-rose-400/60 bg-rose-500/10 rotate-x-90 translate-y-[40px] backdrop-blur-sm" />
                            <div className="absolute inset-0 border border-rose-400/60 bg-rose-500/10 rotate-x-90 -translate-y-[40px] backdrop-blur-sm" />
                        </div>
                        <style>{`
                            .preserve-3d { transform-style: preserve-3d; }
                            .translate-z-\\[40px\\] { transform: translateZ(40px); }
                            .-translate-z-\\[40px\\] { transform: translateZ(-40px); }
                            .rotate-y-90 { transform: rotateY(90deg); }
                            .rotate-x-90 { transform: rotateX(90deg); }
                            @keyframes deform {
                                0% { transform: rotateX(45deg) rotateY(45deg) scale3d(1, 1, 1) skew(0deg, 0deg); }
                                50% { transform: rotateX(70deg) rotateY(20deg) scale3d(1.3, 0.7, 1.1) skew(15deg, 5deg); }
                                100% { transform: rotateX(20deg) rotateY(70deg) scale3d(0.8, 1.4, 0.8) skew(-10deg, -15deg); }
                            }
                        `}</style>
                    </div>
                );

            case "velocidades":
                return (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.3),transparent_70%)]" />
                        <svg className="w-full h-full opacity-80" viewBox="0 0 200 100" preserveAspectRatio="none">
                            <path d="M-20,30 Q80,60 220,20" fill="none" stroke="url(#grad1)" strokeWidth="2" strokeDasharray="15 15" strokeDashoffset="0">
                                <animate attributeName="stroke-dashoffset" values="30;0" dur="1.5s" repeatCount="indefinite" />
                            </path>
                            <path d="M-20,50 Q80,80 220,40" fill="none" stroke="url(#grad2)" strokeWidth="3" strokeDasharray="20 20" strokeDashoffset="0">
                                <animate attributeName="stroke-dashoffset" values="40;0" dur="2s" repeatCount="indefinite" />
                            </path>
                            <path d="M-20,70 Q80,100 220,60" fill="none" stroke="url(#grad3)" strokeWidth="1.5" strokeDasharray="10 10" strokeDashoffset="0">
                                <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
                            </path>
                            <defs>
                                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                                    <stop offset="50%" stopColor="#f59e0b" stopOpacity="1" />
                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
                                    <stop offset="50%" stopColor="#fbbf24" stopOpacity="1" />
                                    <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#d97706" stopOpacity="0" />
                                    <stop offset="50%" stopColor="#d97706" stopOpacity="1" />
                                    <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                );

            case "euler-lagrange":
                return (
                    <div className="relative w-full h-full flex overflow-hidden bg-slate-950">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.3),transparent_70%)]" />
                        {/* Euler (Left) - Fixed Grid */}
                        <div className="flex-1 border-r border-white/10 relative flex items-center justify-center bg-slate-900/50">
                            <div className="grid grid-cols-3 gap-5 opacity-70">
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <div key={i} className="w-1 h-1 rounded-full bg-purple-500 relative">
                                        <div className="absolute top-1/2 left-1/2 w-5 h-0.5 bg-gradient-to-r from-purple-500 to-transparent origin-left -translate-y-1/2 animate-[spin_4s_linear_infinite]" style={{ animationDelay: \`\${i * 0.3}s\` }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Lagrange (Right) - Moving Particle */}
                        <div className="flex-1 relative flex items-center justify-center">
                            <div className="absolute w-3 h-3 rounded-full bg-purple-400 shadow-[0_0_20px_rgba(168,85,247,1)] animate-[lagrangePath_5s_ease-in-out_infinite_alternate] z-10" />
                            <svg className="absolute inset-0 w-full h-full opacity-40">
                                <path d="M20,80 Q60,20 100,80 T180,20" fill="none" stroke="currentColor" className="text-purple-400" strokeWidth="2" strokeDasharray="4 4" />
                            </svg>
                        </div>
                        <style>{`
                            @keyframes lagrangePath {
                                0% { transform: translate(-40px, 30px); }
                                50% { transform: translate(0px, -30px); }
                                100% { transform: translate(40px, 30px); }
                            }
                        `}</style>
                    </div>
                );

            default:
                return (
                    <div className={cn("w-full h-full bg-gradient-to-br opacity-50", colorClass)} />
                );
        }
    };

    return (
        <div className="absolute inset-0 w-full h-full pointer-events-none">
            {renderPreview()}
        </div>
    );
}
