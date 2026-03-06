import { Droplets, Cuboid, Waves } from "lucide-react";

export const categories = [
    {
        id: "fluidos-en-reposo",
        title: "Fluidos en Reposo",
        description: "Estudio de los fluidos en equilibrio, presión hidrostática, tensión superficial y el comportamiento de la materia a nivel discreto y continuo.",
        icon: Droplets,
        color: "from-cyan-500 to-blue-600",
        theme: "fluidos",
        apps: ["discreto-continuo", "camino-libre", "meniscos", "hydrostatic-pressure", "parallel-atmospheres"]
    },
    {
        id: "solidos-y-esfuerzos",
        title: "Sólidos y Esfuerzos",
        description: "Análisis de la deformación de los cuerpos sólidos bajo la acción de fuerzas, tensores de esfuerzos y deformaciones.",
        icon: Cuboid,
        color: "from-rose-500 to-pink-600",
        theme: "solidos",
        apps: ["deformaciones"]
    },
    {
        id: "hidrodinamica",
        title: "Hidrodinámica",
        description: "Dinámica de los fluidos en movimiento, campos de velocidades, líneas de corriente y las perspectivas de Euler y Lagrange.",
        icon: Waves,
        color: "from-amber-500 to-orange-600",
        theme: "hidrodinamica",
        apps: ["velocidades", "euler-lagrange"]
    }
];
