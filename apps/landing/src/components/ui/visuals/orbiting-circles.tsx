import React from "react"
import { cn } from "@/lib/utils"

export interface OrbitingCirclesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  children?: React.ReactNode
  reverse?: boolean
  duration?: number
  delay?: number
  radius?: number
  path?: boolean
  iconSize?: number
  speed?: number
}

export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  radius = 160,
  path = true,
  iconSize = 30,
  speed = 1,
  ...props
}: OrbitingCirclesProps) {
  const calculatedDuration = duration / speed
  const childCount = React.Children.count(children)

  return (
    <div className={cn("relative flex h-full w-full items-center justify-center", className)} {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        version="1.1"
        className="pointer-events-none absolute inset-0 size-full"
        viewBox="-400 -400 800 800"
      >
        <defs>
          <path
            id="orbit-path"
            d={`M 0, -${radius} A ${radius},${radius} 0 1,1 0,${radius} A ${radius},${radius} 0 1,1 0,-${radius}`}
          />
        </defs>

        {path && (
          <circle
            className="stroke-black/10 stroke-1 dark:stroke-white/10"
            cx="0"
            cy="0"
            r={radius}
            fill="none"
          />
        )}

        {/* Instead of absolute positioned DOM elements forcing layout recalcs,
            we map foreignObject nodes mapped explicitly to the orbit path using SVG animateMotion. */}
        {React.Children.map(children, (child, index) => {
          // Negative offset calculates staggered intervals mapping perfectly to circumference
          const beginTime = -(calculatedDuration * (index / childCount))

          return (
            <g>
              <foreignObject
                x={-iconSize / 2}
                y={-iconSize / 2}
                width={iconSize}
                height={iconSize}
                className="flex items-center justify-center rounded-full"
              >
                {child}
              </foreignObject>
              <animateMotion
                href={undefined} /* Target implicit parent <g> */
                dur={`${calculatedDuration}s`}
                repeatCount="indefinite"
                path={`M 0, -${radius} A ${radius},${radius} 0 1,1 0,${radius} A ${radius},${radius} 0 1,1 0,-${radius}`}
                begin={`${beginTime}s`}
                // In reverse, we animate along the same path but with keypoints starting at 1 towards 0.
                keyPoints={reverse ? "1;0" : "0;1"}
                keyTimes="0;1"
                calcMode="linear"
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
