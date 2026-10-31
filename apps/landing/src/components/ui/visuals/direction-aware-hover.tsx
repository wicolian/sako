"use client";

import { useRef, useState } from "react";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export const DirectionAwareHover = ({
  imageUrl,
  children,
  childrenClassName,
  imageClassName,
  className,
}: {
  imageUrl: string;
  children: React.ReactNode | string;
  childrenClassName?: string;
  imageClassName?: string;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [direction, setDirection] = useState<
    "top" | "bottom" | "left" | "right" | string
  >("left");

  const handleMouseEnter = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (!ref.current) return;

    // Use requestAnimationFrame to avoid forced reflow
    requestAnimationFrame(() => {
      const direction = getDirection(event, ref.current!);
      switch (direction) {
        case 0:
          setDirection("top");
          break;
        case 1:
          setDirection("right");
          break;
        case 2:
          setDirection("bottom");
          break;
        case 3:
          setDirection("left");
          break;
        default:
          setDirection("left");
          break;
      }
    });
  };

  const getDirection = (
    ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
    obj: HTMLElement
  ) => {
    const { width: w, height: h, left, top } = obj.getBoundingClientRect();
    const x = ev.clientX - left - (w / 2) * (w > h ? h / w : 1);
    const y = ev.clientY - top - (h / 2) * (h > w ? w / h : 1);
    const d = Math.round(Math.atan2(y, x) / 1.57079633 + 5) % 4;
    return d;
  };

  return (
    <motion.div
      onMouseEnter={handleMouseEnter}
      ref={ref}
      className={cn(
        "h-80 w-full bg-transparent rounded-lg overflow-hidden group/card relative",
        className
      )}
    >
      {/* Static overlay + content for mobile (always visible) */}
      <div className="absolute inset-0 z-20 md:hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className={cn("absolute bottom-4 left-4 right-4 text-white", childrenClassName)}>
          {children}
        </div>
      </div>

      {/* Animated version for desktop */}
      <AnimatePresence mode="wait">
        <motion.div
          className="relative h-full w-full"
          initial="initial"
          whileHover={direction}
          exit="exit"
        >
          {/* Overlay for desktop hover */}
          <motion.div 
            className="hidden md:block absolute inset-0 w-full h-full bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10 opacity-0 group-hover/card:opacity-100 transition duration-500"
          />
          <motion.div
            variants={variants}
            className="h-full w-full relative bg-neutral-900"
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="image"
              className={cn(
                "h-full w-full object-cover object-center scale-[1.15]",
                imageClassName
              )}
              width="1000"
              height="1000"
              src={imageUrl}
              loading="lazy"
              decoding="async"
            />
          </motion.div>
          {/* Animated content for desktop */}
          <motion.div
            variants={textVariants}
            transition={{
              duration: 0.5,
              ease: "easeOut",
            }}
            className={cn(
              "hidden md:block text-white absolute bottom-4 left-4 right-4 z-40",
              childrenClassName
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

const variants = {
  initial: {
    x: 0,
  },

  exit: {
    x: 0,
    y: 0,
  },
  top: {
    y: 20,
  },
  bottom: {
    y: -20,
  },
  left: {
    x: 20,
  },
  right: {
    x: -20,
  },
};

const textVariants = {
  initial: {
    y: 0,
    x: 0,
    opacity: 0,
  },
  exit: {
    y: 0,
    x: 0,
    opacity: 0,
  },
  top: {
    y: -20,
    opacity: 1,
  },
  bottom: {
    y: 2,
    opacity: 1,
  },
  left: {
    x: -2,
    opacity: 1,
  },
  right: {
    x: 20,
    opacity: 1,
  },
};
