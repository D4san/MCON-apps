import { useState, useEffect } from 'react';

/**
 * Detects if the screen is in portrait orientation.
 * Returns true when the viewport is taller than wide (portrait/vertical).
 */
export function useIsPortrait(): boolean {
    const [isPortrait, setIsPortrait] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(orientation: portrait)').matches;
    });

    useEffect(() => {
        const mq = window.matchMedia('(orientation: portrait)');
        const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return isPortrait;
}
