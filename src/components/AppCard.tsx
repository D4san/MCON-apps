import { motion } from "framer-motion";
import { ExternalLink, Lock } from "lucide-react";
import type { AppDefinition } from "../data/apps";
import { cn } from "../lib/utils";

interface AppCardProps {
    app: AppDefinition;
}

export function AppCard({ app }: AppCardProps) {
    const isPlaceholder = app.isPlaceholder;

    return (
        <motion.div
            whileHover={!isPlaceholder ? { y: -5, boxShadow: "0 10px 30px -10px rgba(59, 130, 246, 0.5)" } : {}}
            transition={{ type: "spring", stiffness: 300 }}
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-surface p-6 transition-colors",
                !isPlaceholder && "hover:border-primary/50 cursor-pointer",
                isPlaceholder && "opacity-75 cursor-not-allowed border-dashed border-slate-700/50"
            )}
            onClick={() => {
                if (!isPlaceholder && app.url) {
                    window.open(app.url, "_blank");
                }
            }}
        >
            <div className="mb-4 flex items-center justify-between">
                <div className={cn(
                    "rounded-lg p-3",
                    !isPlaceholder ? "bg-primary/20 text-primary" : "bg-slate-700/50 text-slate-400"
                )}>
                    <app.icon className="h-6 w-6" />
                </div>
                {isPlaceholder ? (
                    <span className="flex items-center text-xs font-medium text-slate-500">
                        <Lock className="mr-1 h-3 w-3" /> Próximamente
                    </span>
                ) : (
                    <ExternalLink className="h-5 w-5 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
            </div>

            <h3 className="mb-2 text-xl font-bold text-slate-100 group-hover:text-primary transition-colors">
                {app.title}
            </h3>
            
            <p className="mb-4 flex-grow text-sm text-slate-400 leading-relaxed">
                {app.description}
            </p>

            <div className="mt-auto flex flex-wrap gap-2">
                {app.tags.map((tag) => (
                    <span 
                        key={tag} 
                        className="rounded-full bg-slate-900/50 px-2 py-1 text-xs font-medium text-slate-400 border border-slate-800"
                    >
                        {tag}
                    </span>
                ))}
            </div>
            
            {!isPlaceholder && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
        </motion.div>
    );
}
