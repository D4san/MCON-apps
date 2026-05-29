import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRenderProps {
    math: string;
    inline?: boolean;
    className?: string;
}

export function MathRender({ math, inline = false, className = '' }: MathRenderProps) {
    const html = useMemo(() => {
        try {
            return katex.renderToString(math, {
                displayMode: !inline,
                throwOnError: false,
                output: 'html',
                strict: false,
            });
        } catch (error) {
            console.error("KaTeX error:", error);
            return math;
        }
    }, [math, inline]);

    const Component = inline ? 'span' : 'div';

    return (
        <Component
            className={`math-render ${className}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
