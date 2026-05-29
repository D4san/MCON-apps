import { useState } from "react";
import { Gauge, Activity, Droplet, Layers } from "lucide-react";
import PitotTab from "./components/PitotTab";
import VenturiTab from "./components/VenturiTab";
import BucketTab from "./components/BucketTab";
import EulerSandbox from "./components/EulerSandbox";

type TabId = "pitot" | "venturi" | "bucket" | "sandbox";

export default function EulerFlowTable() {
    const [activeTab, setActiveTab] = useState<TabId>("pitot");

    const tabs = [
        { id: "pitot", label: "Tubo de Pitot", icon: Gauge, component: PitotTab },
        { id: "venturi", label: "Tubo de Venturi", icon: Activity, component: VenturiTab },
        { id: "bucket", label: "Depósito (Torricelli)", icon: Droplet, component: BucketTab },
        { id: "sandbox", label: "Sandbox (Tablero)", icon: Layers, component: EulerSandbox },
    ];

    const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component || PitotTab;

    return (
        <div className="flex h-[calc(100vh-4rem)] w-full flex-col bg-[#05070d] text-slate-200 overflow-hidden">
            {/* Barra de Navegación Superior */}
            <header className="flex h-14 w-full items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 backdrop-blur-md flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <Activity size={18} />
                    </div>
                    <div>
                        <h1 className="text-sm font-black tracking-tight text-white uppercase sm:text-base">
                            Mesa de Flujo de Euler
                        </h1>
                        <p className="hidden text-[10px] uppercase tracking-widest text-slate-400 sm:block">
                            Simulación de Fluidos Ideales y Reales
                        </p>
                    </div>
                </div>

                {/* Selector de Pestañas */}
                <nav className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                type="button"
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabId)}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                                    isActive
                                        ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/20"
                                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                }`}
                            >
                                <Icon size={14} />
                                <span className="hidden md:inline">{tab.label}</span>
                                <span className="inline md:hidden">{tab.label.split(" ")[0]}</span>
                            </button>
                        );
                    })}
                </nav>
            </header>

            {/* Contenedor de la Simulación Activa */}
            <main className="flex-1 min-h-0 w-full relative">
                <ActiveComponent />
            </main>
        </div>
    );
}
