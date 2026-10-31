"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface WavyBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  colors?: string[];
  waveWidth?: number;
  backgroundFill?: string;
  blur?: number;
  speed?: "slow" | "fast";
  waveOpacity?: number;
}

export function WavyBackground({
  children,
  className,
  containerClassName,
  colors = ["#9AE83E", "#8BD835", "#7CC82E", "#6DB827"],
  waveWidth = 50,
  backgroundFill = "white",
  blur = 10,
  speed = "fast",
  waveOpacity = 0.3,
}: WavyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let t = 0;

    const render = () => {
      t += speed === "fast" ? 0.002 : 0.0005;
      
      ctx.fillStyle = backgroundFill;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      const drawWave = (color: string, amplitude: number, frequency: number, phase: number) => {
        ctx.beginPath();
        ctx.moveTo(0, dimensions.height);

        for (let x = 0; x <= dimensions.width; x += 10) {
          const y =
            dimensions.height / 2 +
            Math.sin(x * frequency + t + phase) * amplitude +
            Math.sin(x * frequency * 2 + t * 2) * (amplitude / 2);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(dimensions.width, dimensions.height);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = waveOpacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      };

      colors.forEach((color, index) => {
        drawWave(
          color,
          waveWidth + index * 10,
          0.003 - index * 0.0003,
          index * (Math.PI / colors.length)
        );
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [dimensions, colors, waveWidth, backgroundFill, speed, waveOpacity]);

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0 z-0"
        style={{
          filter: `blur(${blur}px)`,
        }}
      />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
}

