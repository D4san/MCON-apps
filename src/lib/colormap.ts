// Generates a Viridis color for a normalized value (0.0 to 1.0)
// Using an approximate polynomial/LUT for the viridis colormap
export function getViridisColor(t: number): [number, number, number, number] {
    // Clamping just in case
    t = Math.max(0, Math.min(1, t));
    
    // Viridis approximated keyframes
    const keyframes = [
        [0.0, [68, 1, 84]],
        [0.1, [72, 35, 116]],
        [0.2, [64, 67, 135]],
        [0.3, [52, 94, 141]],
        [0.4, [41, 120, 142]],
        [0.5, [32, 144, 140]],
        [0.6, [34, 168, 132]],
        [0.7, [68, 191, 112]],
        [0.8, [121, 209, 81]],
        [0.9, [189, 223, 38]],
        [1.0, [253, 231, 36]]
    ];

    if (t <= 0) return [68, 1, 84, 255];
    if (t >= 1) return [253, 231, 36, 255];

    let i = 0;
    while (i < keyframes.length - 2 && t > (keyframes[i + 1][0] as number)) {
        i++;
    }

    const t0 = keyframes[i][0] as number;
    const t1 = keyframes[i + 1][0] as number;
    const c0 = keyframes[i][1] as number[];
    const c1 = keyframes[i + 1][1] as number[];

    const localT = (t - t0) / (t1 - t0);

    const r = Math.round(c0[0] + (c1[0] - c0[0]) * localT);
    const g = Math.round(c0[1] + (c1[1] - c0[1]) * localT);
    const b = Math.round(c0[2] + (c1[2] - c0[2]) * localT);

    return [r, g, b, 255];
}

// Map a pressure value between Pmin and Pmax to an rgba css string
export function pressureToViridisCSS(p: number, pMin: number, pMax: number, alpha: number = 1.0): string {
    const t = pMax > pMin ? (p - pMin) / (pMax - pMin) : 0.5;
    const [r, g, b] = getViridisColor(t);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
