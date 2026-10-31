'use client';
import * as React from 'react';
import { HTMLMotionProps, motion } from 'motion/react';
import { cn } from '@/lib/utils';

type GridSize = '4:4' | '5:5' | '6:6' | '6:8' | '8:8' | '8:12' | '10:10' | '12:12' | '12:16' | '16:16';

type GridBackgroundProps = HTMLMotionProps<'div'> & {
  children?: React.ReactNode;
  gridSize?: GridSize;
  colors?: {
    background?: string;
    borderColor?: string;
    borderSize?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
  };
  beams?: {
    count?: number;
    colors?: string[];
    size?: string;
    shadow?: string;
    speed?: number;
  };
};

function GridBackground({
  className,
  children,
  gridSize = '10:10',
  colors = {},
  beams = {},
  ...props
}: GridBackgroundProps) {
  const {
    background = 'bg-neutral-50',
    borderColor = 'border-gray-200/80',
    borderSize = '1px',
    borderStyle = 'solid',
  } = colors;

  const {
    count = 8,
    colors: beamColors = [
      'bg-beam-1',
      'bg-beam-2',
      'bg-beam-3',
      'bg-beam-4',
      'bg-beam-5',
      'bg-beam-1',
      'bg-beam-2',
      'bg-beam-3'
    ],
    shadow = 'shadow-md shadow-lime-400/30 rounded-full',
    speed = 4,
  } = beams;

  // Parse grid dimensions
  const [cols, rows] = gridSize.split(':').map(Number);

  // Generate beam configurations - deterministic to avoid hydration mismatch
  const animatedBeams = React.useMemo(
    () =>
      Array.from({ length: Math.min(count, 12) }, (_, i) => {
        // Use deterministic values based on index instead of Math.random()
        const direction = (i % 2) === 0 ? 'horizontal' : 'vertical';
        const startPosition = (i % 3) === 0 ? 'start' : 'end';

        // Predefined grid line positions for consistency (avoiding edges)
        const gridLineOptions = direction === 'horizontal'
          ? [2, 3, 4, 5, 6, 7, 8] // row indices
          : [2, 3, 4, 5, 6, 7, 8]; // column indices

        return {
          id: i,
          color: beamColors[i % beamColors.length],
          direction,
          startPosition,
          gridLine: gridLineOptions[i % gridLineOptions.length],
          delay: (i * 0.5) % 2, // Deterministic delay based on index
          duration: speed + (i * 0.3) % 2, // Deterministic duration
        };
      }),
    [count, beamColors, speed, cols, rows],
  );

  const gridStyle = {
    '--border-style': borderStyle,
  } as React.CSSProperties;

  return (
    <motion.div
      data-slot="grid-background"
      className={cn('relative size-full overflow-hidden', background, className)}
      style={gridStyle}
      {...props}
    >
      {/* Grid Container */}
      <div
        className="absolute inset-0 size-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {/* Grid Cells */}
        {Array.from({ length: cols * rows }).map((_, index) => (
          <div
            key={index}
            className={cn('relative', borderColor)}
            style={{
              borderRightWidth: borderSize,
              borderBottomWidth: borderSize,
              borderRightStyle: borderStyle,
              borderBottomStyle: borderStyle,
            }}
          />
        ))}
      </div>

      {/* Animated Beams */}
      {animatedBeams.map((beam) => {
        // Calculate exact grid line positions as percentages
        const horizontalPosition = (beam.gridLine / rows) * 100;
        const verticalPosition = (beam.gridLine / cols) * 100;

        return (
          <motion.div
            key={beam.id}
            className={cn(
              'absolute rounded-full backdrop-blur-sm z-20',
              beam.color,
              beam.direction === 'horizontal' ? 'w-6 h-0.5' : 'w-0.5 h-6',
              shadow,
            )}
            style={{
              ...(beam.direction === 'horizontal'
                ? {
                    // Position exactly on the horizontal grid line
                    top: `${horizontalPosition}%`,
                    left: beam.startPosition === 'start' ? '-12px' : 'calc(100% + 12px)',
                    transform: 'translateY(-50%)', // Center on the line
                  }
                : {
                    // Position exactly on the vertical grid line
                    left: `${verticalPosition}%`,
                    top: beam.startPosition === 'start' ? '-12px' : 'calc(100% + 12px)',
                    transform: 'translateX(-50%)', // Center on the line
                  }),
            }}
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: [0, 0.4, 0.4, 0],
              ...(beam.direction === 'horizontal'
                ? {
                    // Move across the full width of the container
                    x: beam.startPosition === 'start' ? [0, 'calc(100vw + 24px)'] : [0, 'calc(-100vw - 24px)'],
                  }
                : {
                    // Move across the full height of the container
                    y: beam.startPosition === 'start' ? [0, 'calc(100vh + 24px)'] : [0, 'calc(-100vh - 24px)'],
                  }),
            }}
            transition={{
              duration: beam.duration,
              delay: beam.delay,
              repeat: Infinity,
              repeatDelay: Math.random() * 3 + 2, // 2-5s pause between repeats
              ease: 'linear',
              times: [0, 0.1, 0.9, 1], // Quick fade in, maintain, quick fade out
            }}
          />
        );
      })}

      {/* Content Layer */}
      <div className="relative z-10 size-full">{children}</div>
    </motion.div>
  );
}

export { GridBackground, type GridBackgroundProps };
