import React from "react"
import { cn } from "@/lib/utils"

export interface AnimatedGridPatternProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
    width?: number;
    height?: number;
    strokeDasharray?: any;
    numBeams?: number;
}

export function AnimatedGridPattern({
    className,
    width = 40,
    height = 40,
    strokeDasharray = "0",
    numBeams = 4,
    ...props
}: AnimatedGridPatternProps) {
    // Beams colors from brand gradient: 
    // lime, softer lime, dark green, light green
    const beamColors = ["#9AE83E", "#8BD835", "#7c995c", "#b7d09a"]

    return (
        <svg
            aria-hidden="true"
            className={cn(
                "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-400/30",
                className
            )}
            {...props}
        >
            <defs>
                <pattern
                    id="grid-pattern"
                    width={width}
                    height={height}
                    patternUnits="userSpaceOnUse"
                    x="50%"
                    y="100%"
                    patternTransform="translate(0 -1)"
                >
                    <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
                </pattern>
            </defs>

            {/* Grid Background */}
            <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern)" />

            {/* SVG Native Beams */}
            <svg x="0" y="0" className="overflow-visible">
                {Array.from({ length: numBeams }).map((_, i) => {
                    // Generate unique characteristics for each beam to avoid CSS overhead
                    const dur = 10 + i * 2;
                    const delay = i * 2;
                    // Distribute initial positions
                    const xPos = ["10%", "80%", "30%", "60%"][i % 4];

                    return (
                        <rect
                            key={i}
                            width={width - 1}
                            height={height * 3}
                            x={xPos}
                            y={-height * 4}
                            fill={beamColors[i % beamColors.length]}
                            opacity="0"
                            style={{
                                rx: "4px"
                            }}
                        >
                            {/* Fade in/out relative to position */}
                            <animate
                                attributeName="opacity"
                                values="0;0.8;1;0.8;0"
                                keyTimes="0;0.1;0.5;0.9;1"
                                dur={`${dur}s`}
                                begin={`${delay}s`}
                                repeatCount="indefinite"
                            />
                            {/* Fall downwards aligned to grid */}
                            <animate
                                attributeName="y"
                                values={`-${height * 4};100%`}
                                dur={`${dur}s`}
                                begin={`${delay}s`}
                                repeatCount="indefinite"
                            />
                        </rect>
                    )
                })}
            </svg>
        </svg>
    )
}
