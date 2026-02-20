import { 
    Atom, 
    Wind, 
    Waves, 
    Box, 
    Activity,
    Route
} from "lucide-react";

export interface AppDefinition {
    id: string;
    title: string;
    description: string;
    icon: any; // Lucide icon
    image: string; // Preview image path
    url?: string; // Internal route
    externalUrl?: string; // For legacy HTML apps if needed
    tags: string[];
    color: string; // Tailwinc color class equivalent for gradients
    isPlaceholder?: boolean;
}

export const apps: AppDefinition[] = [
    {
        id: "discreto-continuo",
        title: "Discreto vs Continuo",
        description: "¿A qué escala la materia se comporta como un continuo? Selecciona volúmenes de control y observa cómo la densidad converge al promedio global.",
        icon: Box,
        image: "/previews/discreto_continuo.png",
        url: "/apps/discreto-continuo",
        tags: ["Fundamentos", "Densidad", "Simulación"],
        color: "from-cyan-400 to-blue-500"
    },
    {
        id: "camino-libre",
        title: "Camino Libre Medio",
        description: "Navega tu partícula a través de un gas ideal. Experimenta colisiones elásticas y mide empíricamente el camino libre medio λ.",
        icon: Atom,
        image: "/previews/camino_libre.png",
        url: "/apps/camino-libre-medio",
        tags: ["Termodinámica", "Estadística", "Gases"],
        color: "from-emerald-400 to-teal-500"
    },
    {
        id: "meniscos",
        title: "Deducción de Menisco",
        description: "Derivación interactiva paso a paso de la ecuación del menisco capilar, con visualización del perfil y las fuerzas de tensión superficial.",
        icon: Waves,
        image: "/previews/meniscos.png",
        url: "/apps/meniscos",
        tags: ["Fluidos", "Tensión Superficial"],
        color: "from-blue-400 to-indigo-500"
    },
    {
        id: "deformaciones",
        title: "Tensor de Deformaciones",
        description: "Define campos de desplazamiento u(x,y,z) y visualiza en 3D la deformación de un cubo. Calcula automáticamente el tensor ε con derivación simbólica.",
        icon: Activity,
        image: "/previews/deformaciones.png",
        url: "/apps/calc-deformaciones",
        tags: ["Mecánica Sólidos", "Tensores", "3D"],
        color: "from-rose-400 to-pink-500"
    },
    {
        id: "velocidades",
        title: "Campo de Velocidades",
        description: "Visualiza líneas de corriente, trayectorias y líneas de traza simultáneamente. Define tu propio campo v(x,y,t) o explora 7 presets clásicos.",
        icon: Wind,
        image: "/previews/velocidades.png",
        url: "/apps/velocity-field",
        tags: ["Cinemática", "Fluidos", "Vectores"],
        color: "from-amber-400 to-orange-500"
    },
    {
        id: "euler-lagrange",
        title: "Euler vs Lagrange",
        description: "Compara lado a lado las perspectivas Euleriana (campo fijo) y Lagrangiana (partícula marcada) con 9 flujos canónicos y visualización de divergencia.",
        icon: Route,
        image: "/previews/euler_lagrange.png",
        url: "/apps/perspectiva-euler-lagrange",
        tags: ["Teoría", "Referenciales", "Fluidos"],
        color: "from-purple-400 to-violet-500"
    }
];
